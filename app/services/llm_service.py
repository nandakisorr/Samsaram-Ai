"""



LLM Provider Service - Routes chat requests to different LLM providers.



"""



import os



import re



import asyncio
import json
import logging
import shutil
import subprocess
import sys
import tempfile
import threading



from pathlib import Path



from typing import Optional, List, Dict, Any, AsyncGenerator



from abc import ABC, abstractmethod



import httpx



from app.core.config import settings, PROJECT_ROOT



from app.core.exceptions import ChatException



logger = logging.getLogger(__name__)





_FRAMEWORK_TAG_RE = re.compile(

    r'<(environment_details|environment-details|file_refs|scm_refs|system_details|system-reminder|think|think_response)>.*?'

    r'(?:</(think|think_response|environment_details|environment-details|file_refs|scm_refs|system_details|system-reminder)>|<\\'

    r'/(think|think_response|environment_details|environment-details|file_refs|scm_refs|system_details|system-reminder)>)',

    re.DOTALL,

)



_MR_PAIR_RE = re.compile(r'<!--\\s*/?\\s*MR-[\\w-]+:.*?-->.*?<!--\\s*/?\\s*MR-[\\w-]+:.*?-->', re.DOTALL)

_MR_SINGLE_RE = re.compile(r'<!--\\s*/?\\s*MR-[\\w-]+:.*?-->', re.DOTALL)





_NPM_PREFIX_CANDIDATES = [

    r"C:\\Users\\nanda\\AppData\\Roaming\\npm",   # standard npm

    r"C:\\Program Files\\nodejs",

    os.path.expandvars(r"%LOCALAPPDATA%\\npm"),

    os.path.expandvars(r"%APPDATA%\\npm"),

]



_npm_global_prefix_cache: Optional[str] = None



def _get_npm_prefix() -> Optional[str]:

    global _npm_global_prefix_cache

    if _npm_global_prefix_cache:

        return _npm_global_prefix_cache

    npm_base = shutil.which("npm")

    if npm_base:

        shell_prefix = ["cmd", "/c", npm_base] if npm_base.lower().endswith(('.cmd', '.bat')) else [npm_base]

        result = subprocess.run(

            shell_prefix + ["prefix", "-g"],

            capture_output=True, text=True, check=False

        )

        if result.returncode == 0 and result.stdout.strip():

            p = result.stdout.strip()

            if os.path.isdir(p):

                _npm_global_prefix_cache = p

                return p

    for p in _NPM_PREFIX_CANDIDATES:

        if os.path.isdir(p):

            _npm_global_prefix_cache = p

            return p

    return None



def _resolve_cli_cmd(cmd: str) -> List[str]:

    """Return an argv list guaranteed to work in the current process."""

    # Fast path — executable on PATH

    found = shutil.which(cmd)

    if found and not found.lower().endswith(('.cmd', '.bat')):

        return [found]

    if found and found.lower().endswith(('.cmd', '.bat')):

        return ['cmd', '/c', found]

    # Fallback: prepend npm prefix to PATH and re-try

    npm_prefix = _get_npm_prefix()

    if npm_prefix:

        old_path = os.environ.get('PATH', '')

        os.environ['PATH'] = npm_prefix + os.pathsep + old_path

        try:

            found = shutil.which(cmd)

        finally:

            if old_path:

                os.environ['PATH'] = old_path

            else:

                del os.environ['PATH']

        if found:

            return (['cmd', '/c', found]

                    if found.lower().endswith(('.cmd', '.bat'))

                    else [found])

    return [cmd]  # last resort





def _sanitize(text: str) -> str:

    """Remove framework/metadata XML blocks and control bytes from LLM output."""

    text = _FRAMEWORK_TAG_RE.sub(' ', text)

    text = re.sub(r' {2,}', ' ', text)

    text = _MR_PAIR_RE.sub(' ', text)

    text = _MR_SINGLE_RE.sub(' ', text)

    text = text.replace('\\x1e', ' ')

    return text.lstrip('\\n\\r')



class LLMProvider(ABC):

    @abstractmethod

    async def stream_chat(self, message: str, history: List[Dict[str, Any]], language: str = "en") -> AsyncGenerator[str, None]:

        pass



    @abstractmethod

    async def chat(self, message: str, history: List[Dict[str, Any]], language: str = "en") -> str:

        pass



class KiloProvider(LLMProvider):

    """Kilo Code (CLI) provider — runs the Kilo CLI as a local subprocess."""



    BASE_SYSTEM = (

        "You are a friendly, helpful chatbot assistant. "

        "Answer naturally and conversationally. "

        "Do NOT describe the project structure, files, or codebase. "

        "Do NOT mention tooling, frameworks, or development practices. "

        "Keep your responses short and natural - like a real human chatting. "

        "Get straight to the point and be friendly."

    )



    def __init__(self, model: Optional[str] = None):

        self.model = model or getattr(settings, 'KILO_CODE_MODEL', 'deepseek/deepseek-v4-flash:free')

        # Always ensure the model ID passed to the Kilo CLI includes the "kilo/" prefix
        # (as shown by `kilo models`). This matches the IDs listed by the CLI and
        # is required for all providers including stepfun, deepseek, auto, etc.
        if not self.model.startswith("kilo/"):
            self.model = f"kilo/{self.model}"


        cmd = getattr(settings, 'KILO_CODE_CMD', 'kilo')

        cmd_args = _resolve_cli_cmd(cmd)
        self.cli_cmd = cmd_args[0]   # user-friendly command name (for log/display)
        self._cli_args = cmd_args    # full resolved argv ['cmd','/c','kollo.CMD']



        logger.info("KiloProvider.__init__: model=%r cli_cmd=%r (resolved=%r)", self.model, self.cli_cmd, cmd_args)



    @property

    def _clean_cwd(self) -> str:

        cwd = getattr(self, "_cached_cwd", None)

        if cwd is None:

            cwd = tempfile.mkdtemp(prefix="kilo_chat_")

            Path(cwd, ".kilo").mkdir(exist_ok=True)

            self._cached_cwd = cwd

        return cwd



    @staticmethod

    def _format_prompt(messages: List[Dict[str, Any]]) -> str:

        parts = [KiloProvider.BASE_SYSTEM]



        for msg in messages:

            role = msg.get("role", "user")

            content = msg.get("content", "")

            content = _sanitize(content)

            if not content:

                continue

            if role == "system":

                parts.append(f"[System] {content}")

            elif role == "assistant":

                parts.append(f"[Assistant] {content}")

            else:

                parts.append(f"[User] {content}")



        return "\\n\\n".join(parts)

    @staticmethod
    def _extract_text(event: Dict[str, Any]) -> Optional[str]:
        """Try multiple common locations for text in Kilo CLI JSON events.
        Different providers (deepseek, stepfun, auto, etc.) may use different keys.
        """
        if not isinstance(event, dict):
            return None
        # Common patterns observed across providers
        candidates = [
            event.get("text"),
            event.get("content"),
            event.get("delta", {}).get("text") if isinstance(event.get("delta"), dict) else None,
            event.get("message", {}).get("content") if isinstance(event.get("message"), dict) else None,
            event.get("part", {}).get("text") if isinstance(event.get("part"), dict) else None,
        ]
        for c in candidates:
            if isinstance(c, str) and c.strip():
                return c
        return None

    async def _run_kilo_once(self, messages: List[Dict[str, Any]], tried_fallback: bool = False) -> str:
        prompt = self._format_prompt(messages)
        cmd_args = self._cli_args + ["run", "--format", "json", "-m", self.model, prompt]

        def _run_sync():
            try:
                result = subprocess.run(
                    cmd_args,
                    capture_output=True,
                    text=False,
                    timeout=300,
                    cwd=self._clean_cwd,
                )
                return result
            except FileNotFoundError as e:
                logger.error("KiloProvider._run_kilo_once: CLI binary not found: %r", self.cli_cmd, exc_info=True)
                raise ChatException(
                    f"CLI binary '{self.cli_cmd}' not found in PATH.\n"
                    "Install it and ensure it's accessible, or set KILO_CODE_CMD to its full path."
                ) from e
            except subprocess.TimeoutExpired as e:
                raise ChatException(f"CLI timed out after 300 s") from e

        loop = asyncio.get_running_loop()
        try:
            result = await loop.run_in_executor(None, _run_sync)
        except ChatException:
            raise
        except Exception as e:
            raise ChatException(f"Failed to run CLI: {e}") from e

        if result.returncode != 0:
            err = (result.stderr or b"").decode("utf-8", errors="replace").strip()
            raise ChatException(f"CLI exited {result.returncode}: {err or 'no stderr'}") from None

        stdout_bytes = result.stdout or b""

        logger.info("KiloProvider._run_kilo_once: stdout len=%d first=%.200r", len(stdout_bytes), stdout_bytes[:200])

        if stdout_bytes.startswith(b'\xff\xfe'):
            output = stdout_bytes.decode('utf-16-le').strip()
        else:
            output = stdout_bytes.decode("utf-8", errors="replace").strip()

        output = _sanitize(output)

        logger.debug("KiloProvider._run_kilo_once: sanitized output len=%d first=%.100r", len(output), output[:100])

        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)

                # Explicitly handle error events from Kilo (e.g. credit limits for paid models like stepfun)
                if event.get("type") == "error":
                    err = event.get("error", {})
                    msg = (
                        err.get("data", {}).get("message")
                        or err.get("message")
                        or err.get("name")
                        or "Unknown Kilo error"
                    )
                    # Known routing error from openrouter/kilo: attempt a fallback to a safe free model
                    if isinstance(msg, str) and "No endpoints found that support the provided 'tool_choice'" in msg:
                        try:
                            fallback = None
                            allowlist = getattr(settings, 'KILO_FREE_MODEL_ALLOWLIST', [])
                            if allowlist:
                                fallback = allowlist[0]
                            # If we haven't already tried a fallback, attempt one by switching the model
                            if fallback and fallback != self.model:
                                if not locals().get('tried_fallback', False):
                                    logger.warning("Kilo routing error detected, retrying with fallback model: %s", fallback)
                                    original_model = self.model
                                    self.model = fallback
                                    try:
                                        return await self._run_kilo_once(messages, tried_fallback=True)
                                    except ChatException:
                                        # revert to original model on failure and propagate
                                        self.model = original_model
                                        raise
                        except Exception:
                            # ignore and raise original
                            pass
                    raise ChatException(f"Kilo error: {msg}")

                text = KiloProvider._extract_text(event)
                if text:
                    logger.debug("KiloProvider._run_kilo_once: got text=%r", text[:100])
                    return _sanitize(text)
            except json.JSONDecodeError:
                continue

        raise ChatException(f"No response received from CLI. Output was: {output[:200]}")

    async def stream_chat(self, message: str, history: List[Dict[str, Any]], language: str = "en") -> AsyncGenerator[str, None]:
        """Stream Kilo CLI output as JSON events arrive, chunk by chunk."""

        messages = history + [{"role": "user", "content": message}]
        prompt = self._format_prompt(messages)

        logger.debug("KiloProvider.stream_chat: prompt len=%s cli_cmd=%r model=%r", len(prompt), self.cli_cmd, self.model)

        cmd_args = self._cli_args + ["run", "--format", "json", "-m", self.model, prompt]

        logger.debug("KiloProvider.stream_chat: cmd_args=%r", cmd_args)

        def _run_sync_stream():
            try:
                result = subprocess.run(
                    cmd_args,
                    capture_output=True,
                    text=False,
                    timeout=300,
                    cwd=self._clean_cwd,
                )
                return result
            except FileNotFoundError as e:
                logger.error("KiloProvider.stream_chat: CLI binary not found: %r", self.cli_cmd, exc_info=True)
                raise ChatException(
                    f"CLI binary '{self.cli_cmd}' not found in PATH.\n"
                    "Install it and ensure it's accessible, or set KILO_CODE_CMD to its full path."
                ) from e
            except subprocess.TimeoutExpired as e:
                raise ChatException(f"CLI streaming timed out after 300 s") from e

        loop = asyncio.get_running_loop()
        try:
            result = await loop.run_in_executor(None, _run_sync_stream)
        except ChatException:
            raise
        except Exception as e:
            raise ChatException(f"Failed to stream from CLI: {e}") from e

        if result.returncode != 0:
            stderr = (result.stderr or b"").decode("utf-8", errors="replace")
            logger.error("KiloProvider.stream_chat: CLI exited %d: %s", result.returncode, stderr[:500])
            raise ChatException(f"CLI exited {result.returncode}: {stderr}") from None

        stdout_bytes = result.stdout or b""

        logger.info("KiloProvider.stream_chat: stdout len=%d stderr len=%d first=%.200r", 
                    len(stdout_bytes), len(result.stderr or b""), stdout_bytes[:200])
        
        if not stdout_bytes:
            stderr = (result.stderr or b"").decode("utf-8", errors="replace").strip()
            raise ChatException(f"No output from CLI. stderr: {stderr[:200]}") from None

        if stdout_bytes.startswith(b'\xff\xfe'):
            output = stdout_bytes.decode('utf-16-le').strip()
        else:
            output = stdout_bytes.decode("utf-8", errors="replace").strip()

        for line in output.splitlines():
            segment = line.strip()
            if not segment:
                continue
            try:
                event = json.loads(segment)

                # Explicitly handle error events (credit limits, auth, etc. for models like step-3.5)
                if event.get("type") == "error":
                    err = event.get("error", {})
                    msg = (
                        err.get("data", {}).get("message")
                        or err.get("message")
                        or err.get("name")
                        or "Unknown Kilo error"
                    )
                    raise ChatException(f"Kilo error: {msg}")

                text = KiloProvider._extract_text(event)
                if text:
                    logger.debug("KiloProvider.stream_chat: got text=%r", text[:100])
                    yield _sanitize(text)
            except json.JSONDecodeError:
                continue

        logger.warning("KiloProvider.stream_chat: No text parts found in output: %r", output[:500])

    async def chat(self, message: str, history: List[Dict[str, Any]], language: str = "en") -> str:
        """Non-streaming chat — runs the subprocess once and returns the complete response."""
        return await self._run_kilo_once(history + [{"role": "user", "content": message}])


class OllamaProvider(LLMProvider):

    """Ollama local LLM provider (HTTP API)."""



    def __init__(self, model: Optional[str] = None):

        self.model = model or getattr(settings, 'OLLAMA_MODEL', 'qwen3:8b')

        self.ollama_url = getattr(settings, 'OLLAMA_URL', 'http://localhost:11434')

        self.max_tokens = getattr(settings, 'OLLAMA_MAX_TOKENS', 1024)



    async def stream_chat(self, message: str, history: List[Dict[str, Any]], language: str = "en") -> AsyncGenerator[str, None]:

        from app.services.qwen_service import get_language_instruction



        messages = []

        lang_instruction = get_language_instruction(language)

        system_prompt = f"You are a helpful AI assistant. {lang_instruction}"

        messages.append({"role": "system", "content": system_prompt})



        for msg in history:

            role = msg.get("role", "user")

            api_role = "assistant" if role == "assistant" else "user"

            messages.append({"role": api_role, "content": msg.get("content", "")})



        messages.append({"role": "user", "content": message})



        payload = {

            "model": self.model,

            "messages": messages,

            "temperature": 0.7,

            "num_predict": self.max_tokens,

            "stream": True,

        }



        try:

            async with httpx.AsyncClient(timeout=settings.API_TIMEOUT) as client:

                async with client.stream(

                    "POST",

                    f"{self.ollama_url}/api/chat",

                    headers={"Content-Type": "application/json"},

                    json=payload

                ) as response:

                    if response.status_code != 200:

                        error_detail = await response.aread()

                        raise ChatException(f"Ollama API error: {response.status_code} - {error_detail.decode()}")



                    async for line in response.aiter_lines():

                        if not line.strip():

                            continue

                        try:

                            data = json.loads(line)

                            if data.get("done"):

                                if "message" in data:

                                    final_content = data["message"].get("content", "")

                                    if final_content:

                                        yield _sanitize(final_content)

                                break



                            content = data.get("message", {}).get("content", "")

                            if content:

                                yield _sanitize(content)

                        except json.JSONDecodeError:

                            logger.warning("Failed to parse Ollama stream line: %%s", line[:200])

                            continue



        except (httpx.ConnectError, httpx.TimeoutException) as e:

            raise ChatException(

                f"Cannot connect to Ollama at {self.ollama_url}.\\n"

                f"Ensure Ollama is running and model '{self.model}' is pulled."

            ) from e



        except Exception as e:

            raise ChatException(f"Failed to stream from Ollama: {str(e)}") from e



    async def chat(self, message: str, history: List[Dict[str, Any]], language: str = "en") -> str:

        from app.services.qwen_service import get_language_instruction



        messages = []

        lang_instruction = get_language_instruction(language)

        system_prompt = f"You are a helpful AI assistant. {lang_instruction}"

        messages.append({"role": "system", "content": system_prompt})



        for msg in history:

            role = msg.get("role", "user")

            api_role = "assistant" if role == "assistant" else "user"

            messages.append({"role": api_role, "content": msg.get("content", "")})



        messages.append({"role": "user", "content": message})



        payload = {

            "model": self.model,

            "messages": messages,

            "temperature": 0.7,

            "num_predict": self.max_tokens,

            "stream": False,

        }



        try:

            async with httpx.AsyncClient(timeout=settings.API_TIMEOUT) as client:

                response = await client.post(

                    f"{self.ollama_url}/api/chat",

                    headers={"Content-Type": "application/json"},

                    json=payload

                )

        except (httpx.ConnectError, httpx.TimeoutException) as e:

            raise ChatException(f"Cannot connect to Ollama: {str(e)}") from e



        if response.status_code != 200:

            raise ChatException(f"Ollama API error: {response.status_code} - {response.text}")



        try:

            result = response.json()

        except Exception as e:

            raise ChatException(f"Invalid JSON response from Ollama: {e}")



        response_text = result.get("message", {}).get("content", "")

        if not response_text:

            raise ChatException("Empty response from Ollama")



        return _sanitize(response_text)





def get_llm_provider(provider: str = "ollama", model: Optional[str] = None) -> LLMProvider:

    """

    Factory function to get the appropriate LLM provider.

    Canonical provider names are 'kilo_code' (Kilo CLI) and 'ollama' (HTTP API).
    The aliases 'kilo' and all backward-compatibility variants are normalised
    to 'kilo_code' in the alias table below.

    Args:

        provider: Provider name ('kilo_code' or 'ollama')

        model: Specific model to use (optional).



    Returns:

        LLMProvider instance

    """



    provider_raw = provider

    provider = provider.lower()



    # Strip nested model prefix from provider name

    provider_aliased = provider

    for prefix in ("kilo/", "killo/", "killoo/", "kill/", "kolloo/", "ollama/"):

        if provider.startswith(prefix + "/"):

            provider_aliased = provider[len(prefix) + 1:]

            break



    _PROVIDER_ALIASES: Dict[str, str] = {
        # Canonical Kilo CLI provider name
        "kilo":       "kilo_code",
        "kilo_code": "kilo_code",
        "kiloo_code": "kilo_code",
        # Aliases kept for backward compat
        "killl":      "kilo_code",
        "kill":       "kilo_code",  "kill_code":  "kilo_code",
        "kollll":     "kilo_code",  "kollll_code":"kilo_code",
        "killoo":     "kilo_code",  "killoo_code":"kilo_code",
        "killo":      "kilo_code",  "killo_code": "kilo_code",
        "kollooo":    "kilo_code",
        "kollooo_code":"kilo_code",
        "kolloo":     "kilo_code",
        "kolloo_code":"kilo_code",
        "kollo":      "kilo_code",  "kollo_code": "kilo_code",
        "kolo":       "kilo_code",  "kolo_code":  "kilo_code",
        "killlo":     "kilo_code",  "killlo_code":"kilo_code",
        "koll":       "kilo_code",  "koll_code":  "kilo_code",
    }

    provider = _PROVIDER_ALIASES.get(provider_aliased, provider_aliased)

    if provider == "kilo_code":

        return KiloProvider(model=model)

    elif provider == "ollama":

        return OllamaProvider(model=model)

    else:

        raise ChatException(

            f"Unsupported LLM provider: {provider_raw!r}. "

            f"Supported: 'kilo', 'kilo_code', 'ollama' (HTTP API)"

        )
