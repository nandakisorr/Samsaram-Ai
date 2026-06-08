from contextlib import asynccontextmanager
import asyncio
import sys
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
from datetime import datetime, date
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.db import close_db, get_db_session, AsyncSessionFactory
from app.routes import chat, auth, stt
from app.core.logging_config import setup_logging
from app.core.exceptions import (
    BadRequestException,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    UnprocessableEntityException,
    TooManyRequestsException,
    InternalServerErrorException,
    ServiceUnavailableException,
    NotImplementedException,
    BadGatewayException,
    GatewayTimeoutException,
    OpenAIException,
    DatabaseException,
    AuthenticationException,
    ValidationException,
    RateLimitException,
    TTSException,
    NetworkException,
    SessionException,
    ChatHistoryException,
    SecurityException,
    ConfigurationException
)
from app.services.birthday_service import send_birthday_emails_task
import logging

logger = logging.getLogger(__name__)

async def _preload_xtts(xtts_service):
    """Load XTTS model in background to avoid blocking startup."""
    try:
        logger = logging.getLogger(__name__)
        logger.info("Preloading XTTS model...")
        xtts_service.load()
        logger.info("XTTS model preloaded successfully")
    except Exception as e:
        logger.error(f"XTTS preload failed: {e}")

async def _birthday_scheduler():
    """
    Background task that runs daily to send birthday emails.
    Checks every 24 hours and sends to users whose birthday is today.
    """
    logger.info("Birthday scheduler started")
    while True:
        try:
            # Calculate time until next run (midnight)
            now = datetime.utcnow()
            next_run = now.replace(hour=0, minute=0, second=0, microsecond=0)
            if now >= next_run:
                next_run = next_run.replace(day=next_run.day + 1)
            
            seconds_until_next = (next_run - now).total_seconds()
            logger.info(f"Next birthday check scheduled in {seconds_until_next:.0f} seconds (at midnight)")
            
            await asyncio.sleep(seconds_until_next)
            
            # Run birthday email task
            logger.info("Running daily birthday email check")
            try:
                async with AsyncSessionFactory() as db:
                    result = await send_birthday_emails_task(db)
                    logger.info(f"Birthday email task completed: {result}")
            except Exception as e:
                logger.error(f"Birthday email task failed: {e}")
                
        except asyncio.CancelledError:
            logger.info("Birthday scheduler stopped")
            break
        except Exception as e:
            logger.error(f"Error in birthday scheduler: {e}")
            await asyncio.sleep(3600)  # Retry in 1 hour on error


async def _kilo_model_updater():
    """
    Background task that checks the Kilo CLI for free models every 6 hours and
    updates settings.KILO_CODE_MODEL (and persists to .env) when a new free
    model is found.
    """
    logger.info("Kilo model updater started")
    from app.services.llm_service import _resolve_cli_cmd
    from app.core.config import PROJECT_ROOT, settings as core_settings
    import json
    import re
    import subprocess

    while True:
        try:
            cmd = getattr(core_settings, 'KILO_CODE_CMD', 'kilo')
            cmd_args = _resolve_cli_cmd(cmd)

            # Try multiple possible 'kilo' commands/flags since CLI versions differ.
            # Prefer the simple plain-text list first (works on many installs), then try verbose/json forms
            attempted_cmds = [
                cmd_args + ["models"],
                cmd_args + ["models", "list"],
                cmd_args + ["models", "--verbose"],
                cmd_args + ["models", "list", "--verbose"],
                cmd_args + ["models", "--format", "json"],
                cmd_args + ["models", "list", "--format", "json"],
                cmd_args + ["models", "--json"],
                cmd_args + ["models", "list", "--json"],
                cmd_args + ["models", "--refresh"],
                cmd_args + ["models", "list", "--refresh"],
            ]

            stdout_text = None
            last_result = None

            def _run_cmd(c):
                try:
                    return subprocess.run(c, capture_output=True, text=True, timeout=60, cwd=None)
                except FileNotFoundError:
                    logger.error("Kilo CLI binary not found when listing models: %r", cmd)
                    return None
                except Exception as e:
                    logger.error("Error running kilo models command %r: %s", c, e)
                    return None

            loop = asyncio.get_running_loop()

            for c in attempted_cmds:
                result = await loop.run_in_executor(None, _run_cmd, c)
                last_result = result
                if not result:
                    continue
                # Prefer successful exit with stdout
                if result.returncode == 0 and result.stdout and result.stdout.strip():
                    stdout_text = result.stdout
                    logger.info("Kilo models command succeeded: %r", c)
                    break
                # If CLI printed JSON to stderr or non-zero but produced stdout, accept it
                if result.stdout and result.stdout.strip():
                    stdout_text = result.stdout
                    logger.warning("Kilo models command returned non-zero exit but produced stdout: %r (rc=%s)", c, result.returncode)
                    break
                # Log stderr for visibility
                if result.stderr and result.stderr.strip():
                    logger.debug("Kilo models command stderr (%r): %s", c, result.stderr.strip()[:400])

            candidates = []

            if stdout_text:
                stdout = stdout_text

                # Remove ANSI escape sequences and box-art lines
                stdout_clean = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", stdout)

                # First, try JSON parse
                try:
                    data = json.loads(stdout_clean)
                    entries = data if isinstance(data, list) else (list(data.values()) if isinstance(data, dict) else [])
                    for e in entries:
                        if not isinstance(e, dict):
                            continue
                        model_id = e.get("id") or e.get("model") or e.get("name")
                        if not model_id:
                            continue
                        is_free = False
                        if e.get("is_free") or e.get("free") or e.get("price") == 0:
                            is_free = True
                        if ":free" in str(model_id).lower() or "free" in str(model_id).lower():
                            is_free = True
                        if is_free:
                            candidates.append(model_id)
                except Exception:
                    pass

                # Extract any 'kilo/...' tokens from plain-text output
                if not candidates:
                    tokens = re.findall(r"(kilo/[^\s,;]+)", stdout_clean, flags=re.IGNORECASE)
                    # Preserve order, dedupe
                    seen = set()
                    tokens = [t for t in tokens if not (t.lower() in seen or seen.add(t.lower()))]

                    # Prefer tokens that explicitly indicate free (':free' or '/free' or containing 'free')
                    for t in tokens:
                        if ":free" in t.lower() or "/free" in t.lower() or "free" in t.lower():
                            candidates.append(t)

                    # If none explicitly free, fallback to any token containing ':free' suffix first
                    if not candidates:
                        for t in tokens:
                            if t.lower().endswith(":free"):
                                candidates.append(t)

                    # Final fallback: accept all tokens (will pick first)
                    if not candidates:
                        candidates.extend(tokens)

                # Last-resort fallback: scan lines for 'free' words and pick first token-like word
                if not candidates:
                    for line in stdout_clean.splitlines():
                        if 'free' in line.lower():
                            parts = line.strip().split()
                            for p in parts:
                                if p.startswith('kilo/'):
                                    candidates.append(p)
                                    break
                            if candidates:
                                break

            else:
                # No stdout captured from any attempted command — log details for debugging.
                if last_result is not None:
                    stderr = (last_result.stderr or "").strip() if isinstance(last_result.stderr, str) else ''
                    logger.warning("Kilo models command failed — last exit code: %s stderr: %s", getattr(last_result, 'returncode', None), stderr[:500])
                else:
                    logger.warning("Kilo models command failed or returned no output (no result) — attempted cmds: %s", attempted_cmds)

            if candidates:
                # Normalize candidates to lower-case for matching and preserve original tokens
                unique_candidates = []
                seen = set()
                for c in candidates:
                    token = c if isinstance(c, str) else str(c)
                    if not token:
                        continue
                    # strip punctuation
                    token = token.strip().strip(',')
                    if token.lower() in seen:
                        continue
                    seen.add(token.lower())
                    unique_candidates.append(token)

                # Apply allowlist from settings if present
                allowlist = getattr(core_settings, 'KILO_FREE_MODEL_ALLOWLIST', []) or []
                allowlist_norm = [a.lower() for a in allowlist]

                filtered = [u for u in unique_candidates if u.lower() in allowlist_norm]

                if not filtered:
                    logger.info("No allowlisted free models found in CLI output; no changes will be made")
                    candidates = []
                else:
                    chosen = filtered[0]
                    new_model = chosen
                    # Ensure kilo/ prefix
                    if not new_model.startswith("kilo/"):
                        new_model = f"kilo/{new_model}"

                    old_model = getattr(core_settings, 'KILO_CODE_MODEL', None)
                    if new_model != old_model:
                        # Update runtime setting
                        core_settings.KILO_CODE_MODEL = new_model
                        logger.info("Updated settings.KILO_CODE_MODEL: %s -> %s", old_model, new_model)

                        # Persist to .env for future runs
                        env_path = PROJECT_ROOT / '.env'
                        try:
                            env_text = env_path.read_text(encoding='utf-8') if env_path.exists() else ""
                        except Exception:
                            env_text = ""

                        if re.search(r'^KILO_CODE_MODEL\s*=.*$', env_text, flags=re.MULTILINE):
                            env_text = re.sub(r'^(KILO_CODE_MODEL\s*=).*$', r"\1" + new_model, env_text, flags=re.MULTILINE)
                        else:
                            if env_text and not env_text.endswith('\n'):
                                env_text += '\n'
                            env_text += f'KILO_CODE_MODEL={new_model}\n'

                        try:
                            env_path.write_text(env_text, encoding='utf-8')
                            logger.info("Persisted KILO_CODE_MODEL to %s", env_path)
                        except Exception as e:
                            logger.error("Failed to write .env with new KILO_CODE_MODEL: %s", e)

        except asyncio.CancelledError:
            logger.info("Kilo model updater stopped")
            break
        except Exception as e:
            logger.error(f"Error in kilo model updater: {e}")

        # Sleep for 6 hours
        await asyncio.sleep(6 * 3600)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    print("Application started with database connection pooling")
    
    # Start birthday scheduler in background if enabled
    if settings.BIRTHDAY_EMAILS_ENABLED:
        birthday_task = asyncio.create_task(_birthday_scheduler())
        app.state.birthday_task = birthday_task
        logger.info("Birthday email scheduler started (runs daily at midnight UTC)")
    else:
        logger.info("Birthday email scheduler disabled (BIRTHDAY_EMAILS_ENABLED=false)")
    
    # Start Kilo model updater in background
    try:
        kilo_task = asyncio.create_task(_kilo_model_updater())
        app.state.kilo_task = kilo_task
        logger.info("Kilo model updater started (checks every 6 hours)")
    except Exception as e:
        logger.error(f"Failed to start Kilo model updater: {e}")

    # Preload XTTS model at startup if using XTTS engine (avoids first-request delay)
    if settings.TTS_ENGINE == "xtts":
        try:
            from app.services.xtts_service import get_xtts_service
            xtts = get_xtts_service()
            # Trigger lazy load in background (non-blocking)
            asyncio.create_task(_preload_xtts(xtts))
        except Exception as e:
            print(f"Warning: Failed to preload XTTS: {e}")
    
    yield
    
    # Shutdown
    if hasattr(app.state, 'birthday_task'):
        app.state.birthday_task.cancel()
        try:
            await app.state.birthday_task
        except asyncio.CancelledError:
            pass
    if hasattr(app.state, 'kilo_task'):
        app.state.kilo_task.cancel()
        try:
            await app.state.kilo_task
        except asyncio.CancelledError:
            pass

    await close_db()
    print("Database connections closed")


app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register exception handlers
@app.exception_handler(BadRequestException)
async def handle_bad_request(request: Request, exc: BadRequestException):
    """Handle bad request exceptions."""
    logging.warning(f"Bad request: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )

@app.exception_handler(UnauthorizedException)
async def handle_unauthorized(request: Request, exc: UnauthorizedException):
    """Handle unauthorized exceptions."""
    logging.warning(f"Unauthorized access attempt: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )

@app.exception_handler(ForbiddenException)
async def handle_forbidden(request: Request, exc: ForbiddenException):
    """Handle forbidden exceptions."""
    logging.warning(f"Forbidden access: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )

@app.exception_handler(NotFoundException)
async def handle_not_found(request: Request, exc: NotFoundException):
    """Handle not found exceptions."""
    logging.info(f"Resource not found: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )

@app.exception_handler(UnprocessableEntityException)
async def handle_validation_error(request: Request, exc: ValidationException):
    """Handle validation exceptions."""
    logging.warning(f"Validation error: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )

@app.exception_handler(TooManyRequestsException)
async def handle_rate_limit(request: Request, exc: TooManyRequestsException):
    """Handle rate limit exceptions."""
    logging.warning(f"Rate limit exceeded: {exc.message}")
    response_content = exc.to_dict()
    headers = {}
    if hasattr(exc, 'retry_after') and exc.retry_after:
        headers['Retry-After'] = str(exc.retry_after)
        response_content['retry_after'] = exc.retry_after
    
    return JSONResponse(
        status_code=exc.status_code,
        content=response_content,
        headers=headers
    )

@app.exception_handler(InternalServerErrorException)
async def handle_internal_error(request: Request, exc: InternalServerErrorException):
    """Handle internal server error exceptions."""
    logging.error(f"Internal server error: {exc.message}", exc_info=True)
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )

@app.exception_handler(ServiceUnavailableException)
async def handle_service_unavailable(request: Request, exc: ServiceUnavailableException):
    """Handle service unavailable exceptions."""
    logging.error(f"Service unavailable: {exc.message}", exc_info=True)
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )

@app.exception_handler(BadGatewayException)
async def handle_bad_gateway(request: Request, exc: BadGatewayException):
    """Handle bad gateway exceptions."""
    logging.error(f"Bad gateway error: {exc.message}", exc_info=True)
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )

@app.exception_handler(GatewayTimeoutException)
async def handle_gateway_timeout(request: Request, exc: GatewayTimeoutException):
    """Handle gateway timeout exceptions."""
    logging.error(f"Gateway timeout error: {exc.message}", exc_info=True)
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )

@app.exception_handler(NotImplementedException)
async def handle_not_implemented(request: Request, exc: NotImplementedException):
    """Handle not implemented exceptions."""
    logging.warning(f"Not implemented: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )

# Include routers
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(stt.router, prefix="/api/v1/stt", tags=["stt"])

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Chatbot API is running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)