import io
import logging
import httpx
from typing import Optional, Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.exceptions import ChatException
from app.core.config import settings

logger = logging.getLogger(__name__)

# Language codes for Whisper (ISO 639-1)
WHISPER_LANGUAGE_CODES = {
    "en": "english",
    "es": "spanish",
    "fr": "french",
    "de": "german",
    "it": "italian",
    "pt": "portuguese",
    "ru": "russian",
    "zh": "chinese",
    "ja": "japanese",
    "ko": "korean",
    "ar": "arabic",
    "hi": "hindi",
    "tr": "turkish",
    "nl": "dutch",
    "pl": "polish",
    "sv": "swedish",
    "da": "danish",
    "no": "norwegian",
    "fi": "finnish",
    "el": "greek",
    "he": "hebrew",
    "th": "thai",
    "vi": "vietnamese",
    "id": "indonesian",
    "uk": "ukrainian",
    "cs": "czech",
    "hu": "hungarian",
    "ro": "romanian",
    "sk": "slovak",
    "bg": "bulgarian",
    "hr": "croatian",
    "sr": "serbian",
    "lt": "lithuanian",
    "lv": "latvian",
    "et": "estonian",
    "sl": "slovenian",
    "mk": "macedonian",
    "sq": "albanian",
    "mt": "maltese",
    "ga": "irish",
    "cy": "welsh",
    "is": "icelandic",
    "af": "afrikaans",
    "sw": "swahili",
    "zu": "zulu",
    "am": "amharic",
    "fa": "persian",
    "ur": "urdu",
    "bn": "bengali",
    "pa": "punjabi",
    "gu": "gujarati",
    "ta": "tamil",
    "te": "telugu",
    "kn": "kannada",
    "ml": "malayalam",
    "mr": "marathi",
    "or": "odia",
    "si": "sinhala",
    "my": "burmese",
    "ne": "nepali",
    "km": "khmer",
}


def get_whisper_language_code(language_code: str) -> Optional[str]:
    """
    Get Whisper's full language name from ISO 639-1 code.
    Returns None for auto-detection.
    """
    if language_code.lower() == "auto":
        return None  # Let Whisper auto-detect
    return WHISPER_LANGUAGE_CODES.get(language_code.lower())


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((httpx.ConnectError, httpx.TimeoutException)),
    reraise=True
)
async def transcribe_with_openai(
    audio_bytes: bytes,
    language: str = "en",
    model: str = "whisper-1"
) -> str:
    """
    Transcribe audio using OpenAI Whisper API.
    Requires OPENAI_API_KEY to be set.
    """
    if not settings.OPENAI_API_KEY:
        raise ChatException("OpenAI API key not configured. Set OPENAI_API_KEY in environment variables.")

    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "audio.wav"

    url = f"{settings.OPENAI_API_URL}/audio/transcriptions"
    lang_param = None if language.lower() == "auto" else language

    try:
        async with httpx.AsyncClient(timeout=settings.API_TIMEOUT) as client:
            files = {"file": audio_file}
            data = {"model": model}
            if lang_param:
                data["language"] = lang_param

            headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
            response = await client.post(url, files=files, data=data, headers=headers)

        if response.status_code != 200:
            error_detail = response.text
            logger.error(f"OpenAI Whisper error {response.status_code}: {error_detail}")
            raise ChatException(f"Whisper API error: {response.status_code} - {error_detail}")

        result = response.json()
        transcription = result.get("text", "").strip()

        if not transcription:
            raise ChatException("Empty transcription from Whisper")

        logger.info(f"OpenAI Whisper transcription successful, length: {len(transcription)} chars")
        return transcription

    except httpx.ConnectError:
        logger.error("Cannot connect to OpenAI API")
        raise ChatException("Cannot connect to OpenAI. Check your network connection and API key.")
    except httpx.TimeoutException:
        logger.error("OpenAI Whisper transcription timeout")
        raise ChatException("Audio transcription timed out")
    except Exception as e:
        logger.error(f"OpenAI Whisper error: {str(e)}")
        raise ChatException(f"Failed to transcribe audio: {str(e)}")


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((httpx.ConnectError, httpx.TimeoutException)),
    reraise=True
)
async def transcribe_with_ollama(
    audio_bytes: bytes,
    language: str = "en",
    model: Optional[str] = None,
    ollama_url: Optional[str] = None
) -> str:
    """
    Transcribe audio using Ollama Whisper model.
    """
    model = model or getattr(settings, 'OLLAMA_WHISPER_MODEL', 'whisper:small')
    ollama_url = ollama_url or getattr(settings, 'OLLAMA_URL', 'http://localhost:11434')
    whisper_lang = get_whisper_language_code(language)

    files = {
        'file': ('audio', audio_bytes, 'application/octet-stream'),
    }
    data = {
        'model': model,
    }
    if whisper_lang:
        data['language'] = whisper_lang
        data['translate'] = 'false'

    try:
        async with httpx.AsyncClient(timeout=settings.API_TIMEOUT) as client:
            endpoints = [
                f"{ollama_url}/api/transcribe",
                f"{ollama_url}/api/audio/transcribe",
            ]
            response = None
            last_error = None
            for endpoint in endpoints:
                try:
                    response = await client.post(
                        endpoint,
                        files=files,
                        data=data
                    )
                    if response.status_code == 200:
                        break
                    last_error = response.status_code
                except (httpx.RequestError, httpx.HTTPStatusError):
                    continue

            if response is None or response.status_code != 200:
                error_detail = response.text if response else "No response from Ollama"
                logger.error(f"Ollama Whisper error {last_error}: {error_detail}")
                raise ChatException(f"Whisper API error: {last_error or 'no response'} - {error_detail}")

            result = response.json()
            transcription = result.get("text", "").strip()

            if not transcription:
                raise ChatException("Empty transcription from Ollama")

            logger.info(f"Ollama Whisper transcription successful, length: {len(transcription)} chars")
            return transcription

    except httpx.ConnectError:
        logger.error("Cannot connect to Ollama for transcription")
        raise ChatException(
            "Cannot connect to Ollama. Ensure Ollama is running and Whisper model is pulled:\n"
            f"  ollama pull {model}"
        )
    except httpx.TimeoutException:
        logger.error("Whisper transcription timeout")
        raise ChatException("Audio transcription timed out")
    except Exception as e:
        logger.error(f"Ollama Whisper error: {str(e)}")
        raise ChatException(f"Failed to transcribe audio: {str(e)}")


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
async def transcribe_with_faster_whisper(
    audio_bytes: bytes,
    language: str = "en",
    model: Optional[str] = None,
    device: Optional[str] = None,
    compute: Optional[str] = None,
) -> str:
    """
    Transcribe audio using Faster-Whisper (CTranslate2).
    Free, offline, fast local transcription.
    """
    from app.services.faster_whisper_service import transcribe_with_faster_whisper as fw_transcribe

    model_name = model or settings.FASTER_WHISPER_MODEL
    device_type = device or settings.FASTER_WHISPER_DEVICE
    compute_type = compute or settings.FASTER_WHISPER_COMPUTE

    logger.info(f"Faster-Whisper: model={model_name}, device={device_type}, compute={compute_type}, lang={language}")
    return await fw_transcribe(
        audio_bytes=audio_bytes,
        language=language,
        model=model_name,
        device=device_type,
        compute=compute_type,
    )


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
async def transcribe_with_vosk(
    audio_bytes: bytes,
    language: str = "en",
    model_name: Optional[str] = None,
) -> str:
    """
    Transcribe audio using Vosk.
    Free, offline, lightweight transcription.
    """
    from app.services.vosk_service import transcribe_with_vosk as vs_transcribe

    model = model_name or settings.VOSK_MODEL_NAME
    logger.info(f"Vosk: model={model}, lang={language}")
    return await vs_transcribe(
        audio_bytes=audio_bytes,
        language=language,
        model_name=model,
    )


async def transcribe_audio(
    audio_bytes: bytes,
    language: str = "en",
    model: Optional[str] = None,
    ollama_url: Optional[str] = None,
    stt_backend: Optional[str] = None,
) -> str:
    """
    Transcribe audio using the configured STT backend.

    Available backends:
    - "faster_whisper" -- Faster-Whisper via CTranslate2 (free, offline, fastest) [DEFAULT]
    - "vosk" -- Vosk speech recognition (free, offline, lightweight)
    - "ollama" -- Ollama Whisper (free, offline, requires Ollama server)
    - "openai" -- OpenAI Whisper API (cloud, high accuracy, requires API key)
    """
    backend = stt_backend or settings.STT_BACKEND

    # Automatic fallback: try faster_whisper first, then vosk, then ollama
    if backend == "auto":
        backends_to_try = ["faster_whisper", "vosk", "ollama"]
        errors = []
        for b in backends_to_try:
            try:
                logger.info(f"STT auto-fallback: trying '{b}'")
                return await _transcribe_with_backend(
                    backend=b,
                    audio_bytes=audio_bytes,
                    language=language,
                    model=model,
                    ollama_url=ollama_url,
                )
            except ChatException as e:
                errors.append(f"{b}: {str(e)}")
                logger.warning(f"STT backend '{b}' failed: {e}")
                continue
        raise ChatException(f"All STT backends failed:\n" + "\n".join(errors))

    return await _transcribe_with_backend(
        backend=backend,
        audio_bytes=audio_bytes,
        language=language,
        model=model,
        ollama_url=ollama_url,
    )


async def _transcribe_with_backend(
    backend: str,
    audio_bytes: bytes,
    language: str,
    model: Optional[str],
    ollama_url: Optional[str],
) -> str:
    """Route to the correct STT backend."""
    if backend == "faster_whisper":
        return await transcribe_with_faster_whisper(
            audio_bytes=audio_bytes,
            language=language,
            model=model,
        )
    elif backend == "vosk":
        return await transcribe_with_vosk(
            audio_bytes=audio_bytes,
            language=language,
            model_name=model,
        )
    elif backend == "ollama":
        return await transcribe_with_ollama(
            audio_bytes=audio_bytes,
            language=language,
            model=model,
            ollama_url=ollama_url,
        )
    elif backend == "openai":
        return await transcribe_with_openai(
            audio_bytes=audio_bytes,
            language=language,
            model=model,
        )
    else:
        raise ChatException(
            f"Unknown STT backend: '{backend}'. "
            f"Supported: 'faster_whisper', 'vosk', 'ollama', 'openai', 'auto'"
        )


async def check_stt_availability() -> Dict[str, Any]:
    """
    Check if the configured STT backend is available.
    Returns status dict with backend info.
    """
    backend = settings.STT_BACKEND
    result = {
        "backend": backend,
        "status": "error",
    }

    if backend == "openai":
        if not settings.OPENAI_API_KEY:
            result["error"] = "OPENAI_API_KEY not configured"
            return result
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
                response = await client.get(f"{settings.OPENAI_API_URL}/models", headers=headers)
                if response.status_code == 200:
                    result["status"] = "ok"
                    result["model"] = settings.OPENAI_WHISPER_MODEL
                    result["url"] = settings.OPENAI_API_URL
                else:
                    result["error"] = f"HTTP {response.status_code}"
        except Exception as e:
            result["error"] = str(e)

    elif backend == "ollama":
        model = settings.OLLAMA_WHISPER_MODEL
        ollama_url = settings.OLLAMA_URL
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{ollama_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    models = [m["name"] for m in data.get("models", [])]
                    result["status"] = "ok"
                    result["ollama_running"] = True
                    result["available_models"] = models
                    result["whisper_available"] = model in models
                    result["model"] = model
                    result["url"] = ollama_url
                else:
                    result["error"] = f"HTTP {response.status_code}"
        except Exception as e:
            result["error"] = str(e)

    elif backend == "faster_whisper":
        try:
            from app.services.faster_whisper_service import _ensure_faster_whisper, _load_model
            _ensure_faster_whisper()
            model_name = settings.FASTER_WHISPER_MODEL
            _load_model(model_name, settings.FASTER_WHISPER_DEVICE, settings.FASTER_WHISPER_COMPUTE)
            result["status"] = "ok"
            result["model"] = model_name
            result["device"] = settings.FASTER_WHISPER_DEVICE
            result["compute"] = settings.FASTER_WHISPER_COMPUTE
        except ChatException as e:
            result["error"] = str(e)
        except Exception as e:
            result["error"] = f"Failed to load model: {str(e)}"

    elif backend == "vosk":
        try:
            from app.services.vosk_service import _ensure_vosk, _load_model
            _ensure_vosk()
            model_name = settings.VOSK_MODEL_NAME
            model_path = _load_model(model_name)
            result["status"] = "ok"
            result["model"] = model_name
            result["model_path"] = str(model_path)
        except ChatException as e:
            result["error"] = str(e)
        except Exception as e:
            result["error"] = f"Failed to load model: {str(e)}"

    else:
        result["error"] = f"Unsupported backend: {backend}"

    return result


# Backward compatibility aliases
check_whisper_availability = check_stt_availability
check_faster_whisper_availability = check_stt_availability
check_vosk_availability = check_stt_availability