from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db_session
from app.core.security import get_current_user_id
from app.services.stt_service import transcribe_audio, check_stt_availability
from app.core.exceptions import ChatException
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/transcribe")
async def transcribe_audio_endpoint(
    audio: UploadFile = File(..., description="Audio file to transcribe"),
    language: str = Form("auto", description="Language code (e.g., 'en', 'ml', 'hi') or 'auto' for detection"),
    stt_backend: str = Form(None, description="STT backend override: 'faster_whisper', 'vosk', 'ollama', or 'openai'"),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Transcribe an audio file using the configured STT backend.

    Supports: WAV, MP3, OGG, FLAC, M4A, etc.
    Requires JWT authentication.

    Backends:
    - faster_whisper: Free, offline, fastest (default). Uses CTranslate2.
    - vosk: Free, offline, lightweight. Pure Python.
    - ollama: Free, offline, requires Ollama server with Whisper model.
    - openai: Cloud-based Whisper API, requires API key.
    """
    try:
        # Read audio bytes
        audio_bytes = await audio.read()

        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file")

        # Transcribe using configured or overridden backend
        transcription = await transcribe_audio(
            audio_bytes=audio_bytes,
            language=language,
            stt_backend=stt_backend,
        )

        used_backend = stt_backend or "configured_default"

        return {
            "text": transcription,
            "language": language if language != "auto" else "auto-detected",
            "backend": used_backend,
            "success": True
        }

    except ChatException as e:
        logger.error(f"Transcription error ({stt_backend or 'default'} backend): {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected transcription error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}"
        )


@router.get("/health")
async def stt_health_check(
    stt_backend: str = Form(None, description="Check specific STT backend"),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Check STT backend availability and configuration.
    Optionally specify a backend to check: 'faster_whisper', 'vosk', 'ollama', 'openai'.
    """
    try:
        health = await check_stt_availability()
        return health
    except Exception as e:
        logger.error(f"STT health check error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check failed: {str(e)}"
        )


@router.get("/available-backends")
async def list_available_backends(
    current_user_id: str = Depends(get_current_user_id)
):
    """
    List all available STT backends with their current status.
    Useful for the frontend to show which options are available.
    """
    backends = ["faster_whisper", "vosk", "ollama", "openai"]
    results = []

    for backend in backends:
        try:
            health = await check_stt_availability()
            # Override the backend name in the result with the one we're iterating
            health["backend"] = backend
            results.append({
                "backend": backend,
                **health
            })
        except Exception:
            results.append({
                "backend": backend,
                "status": "error",
                "error": "Failed to check"
            })

    return {"backends": results}