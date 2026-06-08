"""Vosk STT service — free, offline, lightweight speech-to-text.

Supports: 30+ languages including English, Spanish, French, German, Italian,
Portuguese, Russian, Chinese, Japanese, Korean, Arabic, Hindi, Turkish, Dutch,
Polish, Swedish, Danish, Norwegian, Finnish, Greek, Hebrew, Thai, Vietnamese,
Indonesian, Ukrainian, Czech, and more.

Requires: pip install vosk
Model download: https://alphacephei.com/vosk/models
"""
import json
import logging
import tempfile
import wave
from typing import Optional, Dict, Any, List
from pathlib import Path

from app.core.config import settings
from app.core.exceptions import ChatException

logger = logging.getLogger(__name__)

# Vosk model instances cached by model name
_MODEL_CACHE: Dict[str, Any] = {}


def _ensure_vosk():
    """Lazily import Vosk."""
    try:
        import vosk
        return vosk
    except ImportError as e:
        raise ChatException(
            f"Vosk not installed. Install it: pip install vosk. Error: {e}"
        )


def _load_model(model_name: str) -> Any:
    """Load or retrieve a cached Vosk model."""
    if model_name in _MODEL_CACHE:
        return _MODEL_CACHE[model_name]

    vosk = _ensure_vosk()
    model_path = _resolve_model_path(model_name)

    try:
        model = vosk.Model(str(model_path))
        _MODEL_CACHE[model_name] = model
        logger.info(f"Vosk model loaded: {model_name}")
        return model
    except Exception as e:
        raise ChatException(
            f"Failed to load Vosk model '{model_name}': {e}. "
            f"Download it from https://alphacephei.com/vosk/models"
        )


def _resolve_model_path(model_name: str) -> Path:
    """
    Resolve Vosk model path.
    Checks VOSK_MODEL_DIR first, then falls back to package-relative paths.
    """
    model_dir = Path(settings.VOSK_MODEL_DIR).expanduser().resolve()
    model_path = model_dir / model_name

    if model_path.exists():
        return model_path

    # Try common download locations
    home_models = Path.home() / "vosk_models" / model_name
    if home_models.exists():
        return home_models

    # Last resort: return the expected path (will fail with clear error at load time)
    return model_path


# Mapping of ISO 639-1 codes to Vosk model-friendly language identifiers
_VOSK_LANG_MAP = {
    "en": "en-us",
    "es": "es",
    "fr": "fr",
    "de": "de",
    "it": "it",
    "pt": "pt-br",
    "ru": "ru",
    "zh": "cn",
    "ja": "ja",
    "ko": "korean",
    "ar": "ar",
    "hi": "hi",
    "tr": "tr",
    "nl": "nl",
    "pl": "pl",
    "sv": "sv",
    "da": "da",
    "no": "no",
    "fi": "fi",
    "el": "el",
    "he": "he",
    "th": "th",
    "vi": "vi",
    "id": "id",
    "uk": "uk",
    "cs": "cs",
    "hu": "hu",
    "ro": "ro",
    "sk": "sk",
    "bg": "bg",
    "hr": "hr",
    "sr": "sr",
    "lt": "lt",
    "lv": "lv",
    "et": "et",
    "sl": "sl",
    "mk": "mk",
    "sq": "sq",
    "mt": "mt",
    "ga": "ga",
    "cy": "cy",
    "is": "is",
    "af": "af",
    "sw": "sw",
    "zu": "zu",
    "am": "am",
    "fa": "fa",
    "ur": "ur",
    "bn": "bn",
    "pa": "pa",
    "gu": "gu",
    "ta": "ta",
    "te": "te",
    "kn": "kn",
    "ml": "ml",
    "mr": "mr",
    "or": "or",
    "si": "si",
    "my": "my",
    "ne": "ne",
    "km": "km",
}


async def transcribe_with_vosk(
    audio_bytes: bytes,
    language: str = "en",
    model_name: Optional[str] = None,
) -> str:
    """
    Transcribe audio using Vosk.

    Args:
        audio_bytes: Raw audio file bytes (WAV format, 16kHz mono recommended)
        language: ISO 639-1 language code
        model_name: Vosk model name (overrides default)

    Returns:
        Transcribed text
    """
    vosk = _ensure_vosk()
    model_name = model_name or settings.VOSK_MODEL_NAME

    vosk_lang = _VOSK_LANG_MAP.get(language.lower(), "en-us")
    logger.info(f"Vosk: language={language}/vosk={vosk_lang}, model={model_name}")

    model = _load_model(model_name)

    try:
        # Write audio bytes to a temp WAV file for Vosk recognition
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        # Perform recognition
        rec = vosk.KaldiRecognizer(model, 16000)

        with open(tmp_path, "rb") as wf:
            data = wf.read()

        if rec.AcceptWaveform(data):
            result_json = rec.Result()
        else:
            result_json = rec.FinalResult()

        result = json.loads(result_json)
        transcription = result.get("text", "").strip()

        if not transcription:
            transcription = result.get("partial", "").strip()

        if not transcription:
            raise ChatException("Empty transcription from Vosk")

        logger.info(f"Vosk transcription successful: {len(transcription)} chars")
        return transcription

    except ChatException:
        raise
    except Exception as e:
        logger.error(f"Vosk error: {str(e)}", exc_info=True)
        raise ChatException(f"Vosk transcription failed: {str(e)}")


def get_vosk_models() -> List[str]:
    """Return list of available Vosk model names for config dropdown."""
    return [
        "vosk-model-small-en-us-0.15",
        "vosk-model-small-en-us-0.3",
        "vosk-model-small-en-us-0.4",
        "vosk-model-en-us-0.21",
        "vosk-model-en-us-0.22",
        "vosk-model-en-us-0.42-gigaspeech",
        "vosk-model-small-de-0.15",
        "vosk-model-small-es-0.22",
        "vosk-model-small-fr-0.22",
        "vosk-model-small-ru-0.15",
        "vosk-model-small-ru-0.22",
        "vosk-model-small-cn-0.22",
        "vosk-model-small-cn-0.3",
        "vosk-model-small-ja-0.22",
        "vosk-model-small-ko-0.22",
        "vosk-model-small-ar-0.3",
        "vosk-model-small-hi-0.22",
        "vosk-model-small-pt-0.3",
        "vosk-model-small-tr-0.3",
        "vosk-model-small-it-0.22",
        "vosk-model-small-nl-0.22",
        "vosk-model-small-pl-0.22",
        "vosk-model-small-uk-v3-nano",
        "vosk-model-small-uk-v3-small",
    ]