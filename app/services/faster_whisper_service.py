"""Faster-Whisper STT service — free, offline, local speech-to-text via CTranslate2.

Supports: English, Spanish, French, German, Italian, Portuguese, Russian, Chinese,
Japanese, Korean, Arabic, Hindi, Turkish, Dutch, Polish, Swedish, Danish, Norwegian,
Finnish, Greek, Hebrew, Thai, Vietnamese, Indonesian, Ukrainian, Czech, Hungarian,
Romanian, Slovak, Bulgarian, Croatian, Serbian, Lithuanian, Latvian, Estonian,
Slovenian, Macedonian, Albanian, Maltese, Irish, Welsh, Icelandic, Afrikaans,
Swahili, Zulu, Amharic, Persian, Urdu, Bengali, Punjabi, Gujarati, Tamil, Telugu,
Kannada, Malayalam, Marathi, Odia, Sinhala, Burmese, Nepali, Khmer, and more.

Requires: pip install faster-whisper ctranslate2
Model download: https://huggingface.co/guillaumekm/faster-whisper-large-v3-ct2
"""
import logging
import os
from typing import Optional, Dict, Any
from pathlib import Path

from app.core.config import settings
from app.core.exceptions import ChatException

logger = logging.getLogger(__name__)

# Lazy import — only loaded when this backend is actually used
_faster_whisper_installed = False
_WhisperModel = None


def _ensure_faster_whisper():
    """Lazily import and initialize Faster-Whisper."""
    global _faster_whisper_installed, _WhisperModel
    if _WhisperModel is not None:
        return
    if not _faster_whisper_installed:
        try:
            from faster_whisper import WhisperModel
            _WhisperModel = WhisperModel
            _faster_whisper_installed = True
            logger.info("Faster-Whisper library loaded successfully")
        except ImportError as e:
            raise ChatException(
                f"Faster-Whisper not installed. Install it: pip install faster-whisper ctranslate2. "
                f"Error: {e}"
            )


_MODEL_CACHE: Dict[str, Any] = {}


def _load_model(model_name: str, device: str, compute: str):
    """Load or retrieve a cached Faster-Whisper model."""
    cache_key = f"{model_name}|{device}|{compute}"
    if cache_key in _MODEL_CACHE:
        return _MODEL_CACHE[cache_key]

    _ensure_faster_whisper()

    model_path = _resolve_model_path(model_name)

    try:
        model = _WhisperModel(
            model_size_or_path=str(model_path),
            device=device,
            compute_type=compute,
        )
        _MODEL_CACHE[cache_key] = model
        logger.info(f"Faster-Whisper model loaded: {model_name} on {device} ({compute})")
        return model
    except Exception as e:
        raise ChatException(f"Failed to load Faster-Whisper model '{model_name}': {e}")


def _resolve_model_path(model_name: str) -> str:
    """
    Resolve model path. Supports:
    - HuggingFace model names (e.g., "large-v3", "distil-large-v3")
    - Local paths
    """
    HF_MODEL_MAP = {
        "tiny": "tiny",
        "tiny.en": "tiny.en",
        "base": "base",
        "base.en": "base.en",
        "small": "small",
        "small.en": "small.en",
        "medium": "medium",
        "medium.en": "medium.en",
        "large-v1": "large-v1",
        "large-v2": "large-v2",
        "large-v3": "large-v3",
        "distil-large-v2": "distil-large-v2",
        "distil-large-v3": "distil-large-v3",
    }

    if model_name in HF_MODEL_MAP:
        return HF_MODEL_MAP[model_name]
    else:
        return Path(model_name)


_LANG_CODES = {
    "en": "en", "es": "es", "fr": "fr", "de": "de", "it": "it",
    "pt": "pt", "ru": "ru", "zh": "zh", "ja": "ja", "ko": "ko",
    "ar": "ar", "hi": "hi", "tr": "tr", "nl": "nl", "pl": "pl",
    "sv": "sv", "da": "da", "no": "no", "fi": "fi", "el": "el",
    "he": "he", "th": "th", "vi": "vi", "id": "id", "uk": "uk",
    "cs": "cs", "hu": "hu", "ro": "ro", "sk": "sk", "bg": "bg",
    "hr": "hr", "sr": "sr", "lt": "lt", "lv": "lv", "et": "et",
    "sl": "sl", "mk": "mk", "sq": "sq", "mt": "mt", "ga": "ga",
    "cy": "cy", "is": "is", "af": "af", "sw": "sw", "zu": "zu",
    "am": "am", "fa": "fa", "ur": "ur", "bn": "bn", "pa": "pa",
    "gu": "gu", "ta": "ta", "te": "te", "kn": "kn", "ml": "ml",
    "mr": "mr", "or": "or", "si": "si", "my": "my", "ne": "ne",
    "km": "km",
}


async def transcribe_with_faster_whisper(
    audio_bytes: bytes,
    language: str = "en",
    model: Optional[str] = None,
    device: Optional[str] = None,
    compute: Optional[str] = None,
) -> str:
    """
    Transcribe audio using Faster-Whisper (CTranslate2).

    Args:
        audio_bytes: Raw audio file bytes (WAV, MP3, OGG, FLAC, M4A, etc.)
        language: ISO 639-1 language code or "auto" for detection
        model: Model size (tiny, base, small, medium, large-v3, distil-large-v3)
        device: "cpu" or "cuda"
        compute: "int8", "int8_float16", "float16", "float32"

    Returns:
        Transcribed text
    """
    model_name = model or settings.FASTER_WHISPER_MODEL
    device_type = device or settings.FASTER_WHISPER_DEVICE
    compute_type = compute or settings.FASTER_WHISPER_COMPUTE

    whisper_lang = _LANG_CODES.get(language.lower())
    if language.lower() == "auto":
        whisper_lang = None
    if whisper_lang is None and language.lower() != "auto":
        logger.warning(f"Language '{language}' not in Faster-Whisper map, using auto-detect")
        whisper_lang = None

    tmp_path = None
    try:
        import tempfile

        # Write audio bytes to temp file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        model_obj = _load_model(model_name, device_type, compute_type)

        # Transcribe
        segments_gen, info = model_obj.transcribe(
            tmp_path,
            language=whisper_lang,
            beam_size=5,
            vad_filter=True,
        )

        # Faster-Whisper may return a generator; convert to list so we can inspect and reuse
        try:
            segments = list(segments_gen)
        except TypeError:
            # If it's already a list-like object, keep as-is
            segments = segments_gen  # type: ignore

        transcription = " ".join(getattr(seg, 'text', str(seg)) for seg in segments).strip()

        if not transcription:
            raise ChatException("Empty transcription from Faster-Whisper")

        logger.info(
            f"Faster-Whisper transcription: lang={whisper_lang or 'auto'}, "
            f"detected_lang={getattr(info, 'language', None)}, segments={len(segments)}, "
            f"chars={len(transcription)}"
        )
        return transcription

    except ChatException:
        raise
    except Exception as e:
        logger.error(f"Faster-Whisper error: {str(e)}", exc_info=True)
        raise ChatException(f"Faster-Whisper transcription failed: {str(e)}")
    finally:
        if tmp_path is not None and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def get_faster_whisper_models() -> list[str]:
    """Return list of available Faster-Whisper model names for config dropdown."""
    return [
        "tiny", "tiny.en",
        "base", "base.en",
        "small", "small.en",
        "medium", "medium.en",
        "distil-large-v2", "distil-large-v3",
        "large-v1", "large-v2", "large-v3",
    ]
