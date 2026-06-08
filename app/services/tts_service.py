"""Neural Text-to-Speech Service with multiple backend support (Piper + XTTS v2 + Indic Parler)."""
import asyncio
import base64
import io
import logging
import wave
import os
import re
import random
import hashlib
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional, Dict, List
from concurrent.futures import ThreadPoolExecutor

import numpy as np

# Conditional imports for optional TTS backends
try:
    from piper import PiperVoice
    from piper.config import SynthesisConfig
    PIPER_AVAILABLE = True
except ImportError:
    PIPER_AVAILABLE = False
    PiperVoice = Any  # type: ignore
    SynthesisConfig = Any  # type: ignore

from app.core.config import settings
from app.core.exceptions import TTSException

logger = logging.getLogger(__name__)

# Check for Indic Parler availability (requires transformers)
try:
    import transformers  # noqa: F401
    INDIC_PARLER_AVAILABLE = True
except Exception:
    INDIC_PARLER_AVAILABLE = False

# In-memory TTS cache to avoid regenerating identical audio
_tts_cache: Dict[str, str] = {}
MAX_CACHE_SIZE = 100

def _get_cache_key(text: str, voice: str, emotion: str, language: str, engine: str) -> str:
    """Generate a deterministic cache key from TTS parameters."""
    key_input = f"{text}|{voice}|{emotion}|{language}|{engine}"
    return hashlib.md5(key_input.encode()).hexdigest()

# Emoji regex pattern (Unicode emoji ranges)
_EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F700-\U0001F77F"
    "\U0001F780-\U0001F7FF"
    "\U0001F800-\U0001F8FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF"
    "\u2700-\u27BF"
    "\u2600-\u26FF"
    "]+",
    flags=re.UNICODE
)

def _strip_emojis(text: str) -> str:
    return _EMOJI_PATTERN.sub('', text)

_MARKDOWN_PATTERNS = [
    (r'\*\*(.+?)\*\*', r'\1'),
    (r'\*(.+?)\*', r'\1'),
    (r'__(.+?)__', r'\1'),
    (r'_(.+?)_', r'\1'),
    (r'`(.+?)`', r'\1'),
    (r'~~(.+?)~~', r'\1'),
    (r'###\s*(.+)', r'\1'),
    (r'##\s*(.+)', r'\1'),
    (r'#\s*(.+)', r'\1'),
]

def _strip_markdown(text: str) -> str:
    for pattern, replacement in _MARKDOWN_PATTERNS:
        text = re.sub(pattern, replacement, text, flags=re.DOTALL)
    return text


# ============================================================
# NATURAL SPEECH ENHANCEMENT (Piper only)
# ============================================================


def _number_to_words(num_str: str) -> str:
    num_str = num_str.replace(',', '').replace(' ', '')
    try:
        n = int(float(num_str))
    except:
        return num_str

    ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
            "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
            "seventeen", "eighteen", "nineteen"]
    tens = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

    def _under_thousand(num: int) -> str:
        if num < 20:
            return ones[num]
        elif num < 100:
            t = tens[num // 10 - 2]
            o = num % 10
            return f"{t} {ones[o]}" if o else t
        else:
            h = num // 100
            r = num % 100
            if r:
                return f"{ones[h]} hundred and {_under_thousand(r)}"
            return f"{ones[h]} hundred"

    if n < 1000:
        return _under_thousand(n)
    elif n < 1_000_000:
        th = n // 1000
        rem = n % 1000
        result = f"{_under_thousand(th)} thousand"
        if rem:
            if rem < 100:
                result += f" and {_under_thousand(rem)}"
            else:
                result += f" {_under_thousand(rem)}"
        return result
    elif n < 1_000_000_000:
        mil = n // 1_000_000
        rem = n % 1_000_000
        result = f"{_under_thousand(mil)} million"
        if rem:
            result += f" {_number_to_words(str(rem))}"
        return result
    elif n < 1_000_000_000_000:
        bil = n // 1_000_000_000
        rem = n % 1_000_000_000
        result = f"{_under_thousand(bil)} billion"
        if rem:
            result += f" {_number_to_words(str(rem))}"
        return result
    else:
        return str(n)


def _split_sentences(text: str) -> List[str]:
    major_sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    segments = []
    for sent in major_sentences:
        sent = sent.strip()
        if not sent:
            continue
        words = sent.split()
        if len(words) > 20:
            sub_parts = re.split(r'(?<=[,;])\s+', sent)
            merged = []
            buffer = ""
            for part in sub_parts:
                part = part.strip()
                if not part:
                    continue
                wc = len(part.split())
                if wc < 4 and buffer:
                    buffer += " " + part
                else:
                    if buffer:
                        merged.append(buffer.strip())
                        buffer = ""
                    merged.append(part)
            if buffer:
                merged.append(buffer.strip())
            segments.extend(merged)
        else:
            segments.append(sent)
    return [s.strip() for s in segments if s.strip() and len(s.strip()) > 1]


def _detect_sentence_type(sentence: str) -> str:
    s = sentence.strip()
    if s.endswith('?'):
        return "question"
    elif s.endswith('!'):
        return "exclamation"
    return "statement"


def _get_natural_params(emotion: str, sentences: List[str]) -> Dict[str, float]:
    emotion = emotion.lower()
    emo_cfg = settings.PIPER_EMOTION_MAP.get(emotion, settings.PIPER_EMOTION_MAP["neutral"])
    ls = float(emo_cfg["length_scale"])
    ns = float(emo_cfg.get("noise_scale", 0.667))
    vol = float(emo_cfg.get("volume", 1.0))
    pause = float(emo_cfg.get("sentence_pause", 0.4 + (ls - 0.9) * 0.3))
    types = [_detect_sentence_type(s) for s in sentences]
    n_q = types.count("question")
    n_e = types.count("exclamation")
    total = len(sentences) or 1
    if n_q / total > 0.4:
        ls *= 0.97
        pause *= 0.85
    if n_e / total > 0.3:
        ns = min(ns + 0.08, 0.9)
        vol = min(vol * 1.08, 1.2)
        pause *= 1.15
    avg_len = sum(len(s) for s in sentences) / len(sentences)
    if avg_len > 100:
        ls *= 1.04
        pause *= 1.1
    ls *= random.uniform(0.98, 1.02)
    ns *= random.uniform(0.99, 1.01)
    return {
        "length_scale": max(0.7, min(1.6, ls)),
        "noise_scale": max(0.4, min(0.95, ns)),
        "volume": max(0.8, min(1.3, vol)),
        "sentence_pause": max(0.2, min(1.2, pause)),
    }


def _preprocess_natural(text: str, emotion: str, language: str = "en") -> tuple[list[str], dict[str, float]]:
    text = _strip_markdown(text)
    text = _strip_emojis(text)
    if not text.strip():
        raise TTSException("Text contains only formatting/emojis or is empty after cleaning")
    if len(text) > 5000:
        raise TTSException("Text too long. Maximum 5000 characters")
    sentences = _split_sentences(text)
    if not sentences:
        raise TTSException("No valid sentences found after text preprocessing")
    params = _get_natural_params(emotion, sentences)
    return sentences, params


def _split_sentences(text: str) -> List[str]:
    major_sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    segments = []
    for sent in major_sentences:
        sent = sent.strip()
        if not sent:
            continue
        words = sent.split()
        if len(words) > 20:
            sub_parts = re.split(r'(?<=[,;])\s+', sent)
            merged = []
            buffer = ""
            for part in sub_parts:
                part = part.strip()
                if not part:
                    continue
                wc = len(part.split())
                if wc < 4 and buffer:
                    buffer += " " + part
                else:
                    if buffer:
                        merged.append(buffer.strip())
                        buffer = ""
                    merged.append(part)
            if buffer:
                merged.append(buffer.strip())
            segments.extend(merged)
        else:
            segments.append(sent)
    return [s.strip() for s in segments if s.strip() and len(s.strip()) > 1]


def _detect_sentence_type(sentence: str) -> str:
    s = sentence.strip()
    if s.endswith('?'):
        return "question"
    elif s.endswith('!'):
        return "exclamation"
    return "statement"


def _get_natural_params(emotion: str, sentences: List[str]) -> Dict[str, float]:
    emotion = emotion.lower()
    emo_cfg = settings.PIPER_EMOTION_MAP.get(emotion, settings.PIPER_EMOTION_MAP["neutral"])
    ls = float(emo_cfg["length_scale"])
    ns = float(emo_cfg.get("noise_scale", 0.667))
    vol = float(emo_cfg.get("volume", 1.0))
    pause = float(emo_cfg.get("sentence_pause", 0.4 + (ls - 0.9) * 0.3))
    types = [_detect_sentence_type(s) for s in sentences]
    n_q = types.count("question")
    n_e = types.count("exclamation")
    total = len(sentences) or 1
    if n_q / total > 0.4:
        ls *= 0.97
        pause *= 0.85
    if n_e / total > 0.3:
        ns = min(ns + 0.08, 0.9)
        vol = min(vol * 1.08, 1.2)
        pause *= 1.15
    avg_len = sum(len(s) for s in sentences) / len(sentences)
    if avg_len > 100:
        ls *= 1.04
        pause *= 1.1
    ls *= random.uniform(0.98, 1.02)
    ns *= random.uniform(0.99, 1.01)
    return {
        "length_scale": max(0.7, min(1.6, ls)),
        "noise_scale": max(0.4, min(0.95, ns)),
        "volume": max(0.8, min(1.3, vol)),
        "sentence_pause": max(0.2, min(1.2, pause)),
    }


def _preprocess_natural(text: str, emotion: str, language: str = "en") -> tuple[list[str], dict[str, float]]:
    text = _strip_markdown(text)
    text = _strip_emojis(text)
    if not text.strip():
        raise TTSException("Text contains only formatting/emojis or is empty after cleaning")
    if len(text) > 5000:
        raise TTSException("Text too long. Maximum 5000 characters")
    sentences = _split_sentences(text)
    if not sentences:
        raise TTSException("No valid sentences found after text preprocessing")
    params = _get_natural_params(emotion, sentences)
    return sentences, params


def _expand_abbreviations(text: str) -> str:
    """Expand common abbreviations and symbols for natural speech."""
    # Ordered from longer to shorter to avoid partial matches
    abbrevs = [
        # Common titles
        (r'\bProf\.', 'Professor'),
        (r'\bRev\.', 'Reverend'),
        (r'\bDr\.', 'Doctor'),
        (r'\bMr\.', 'Mister'),
        (r'\bMrs\.', 'Misses'),
        (r'\bMs\.', 'Miss'),
        (r'\bSr\.', 'Senior'),
        (r'\bJr\.', 'Junior'),
        (r'\bSt\.', 'Saint'),
        # Street/address
        (r'\bAve\.', 'Avenue'),
        (r'\bBlvd\.', 'Boulevard'),
        (r'\bRd\.', 'Road'),
        (r'\bLn\.', 'Lane'),
        (r'\bDr\.\s', 'Drive '),  # Drive (not Doctor when followed by space)
        (r'\bCt\.', 'Court'),
        (r'\bPl\.', 'Place'),
        (r'\bSq\.', 'Square'),
        # Latin/foreign
        (r'\betc\.', 'et cetera'),
        (r'\be\.g\.', 'for example'),
        (r'\bi\.e\.', 'that is'),
        (r'\bvs\.', 'versus'),
        (r'\bet al\.', 'and others'),
        (r'\bapprox\.', 'approximately'),
        (r'\bdept\.', 'department'),
        (r'\bfl\.\s', 'Florida '),  # State abbreviations with period
        (r'\bcal\.\s', 'California '),
        # Time
        (r'\b(a\.m|p\.m)\.', r'\1'),  # Keep a.m./p.m. but drop trailing period
        # Units
        (r'\bkg\.', 'kilograms'),
        (r'\blb\.', 'pounds'),
        (r'\bft\.', 'feet'),
        (r'\bin\.', 'inches'),
        (r'\bmi\.', 'miles'),
        (r'\bhr\.', 'hours'),
        (r'\bmin\.', 'minutes'),
        (r'\bsec\.', 'seconds'),
    ]
    for pat, repl in abbrevs:
        text = re.sub(pat, repl, text, flags=re.IGNORECASE)
    
    # Expand a.m./p.m. without period
    text = re.sub(r'\b(a\.m|p\.m)\.', lambda m: m.group(1).replace('.', ''), text, flags=re.IGNORECASE)
    
    # Expand ordinal numbers (1st → first, 2nd → second, etc.)
    ordinals = {
        1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth',
        6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth',
        11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth',
        15: 'fifteenth', 16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth',
        19: 'nineteenth', 20: 'twentieth', 30: 'thirtieth', 40: 'fortieth',
        50: 'fiftieth', 60: 'sixtieth', 70: 'seventieth', 80: 'eightieth',
        90: 'ninetieth', 100: 'hundredth', 1000: 'thousandth',
    }
    def expand_ordinal(m):
        n = int(m.group(1))
        if n in ordinals:
            return ordinals[n]
        # Handle compound ordinals like 21st → twenty first
        if n < 100:
            t = n // 10 * 10
            o = n % 10
            if o:
                digit_pattern = r'\d+'
                return f"{expand_ordinal(re.match(digit_pattern, str(t)))} {ordinals.get(o, ordinals[o])}"
            return ordinals.get(t, str(n) + 'th')
        return m.group(0)
    text = re.sub(r'\b(\d+)(st|nd|rd|th)\b', expand_ordinal, text, flags=re.IGNORECASE)
    
    # Expand currency symbols
    text = re.sub(r'\$(\d+(?:\.\d+)?)', lambda m: f"{_number_to_words(m.group(1))} dollars", text)
    text = re.sub(r'€(\d+(?:\.\d+)?)', lambda m: f"{_number_to_words(m.group(1))} euros", text)
    text = re.sub(r'£(\d+(?:\.\d+)?)', lambda m: f"{_number_to_words(m.group(1))} pounds", text)
    text = re.sub(r'¥(\d+(?:\.\d+)?)', lambda m: f"{_number_to_words(m.group(1))} yen", text)
    
    # Expand percentages
    text = re.sub(r'(\d+(?:\.\d+)?)\s*%', lambda m: f"{_number_to_words(m.group(1))} percent", text)
    
    # Expand common contractions lightly (keep some for naturalness)
    contractions = {
        r"\bcan't\b": "can not",
        r"\bwon't\b": "will not",
        r"\bdon't\b": "do not",
        r"\bdoesn't\b": "does not",
        r"\bdidn't\b": "did not",
        r"\bhaven't\b": "have not",
        r"\bhasn't\b": "has not",
        r"\bhadn't\b": "had not",
        r"\bwouldn't\b": "would not",
        r"\bshouldn't\b": "should not",
        r"\bcouldn't\b": "could not",
        r"\bwasn't\b": "was not",
        r"\bweren't\b": "were not",
        r"\bisn't\b": "is not",
        r"\baren't\b": "are not",
    }
    for pat, repl in contractions.items():
        text = re.sub(pat, repl, text, flags=re.IGNORECASE)
    
    return text


def _number_to_words(num_str: str) -> str:
    """Helper: convert number string to words (up to trillions). Handles commas."""
    num_str = num_str.replace(',', '').replace(' ', '')
    try:
        n = int(float(num_str))
    except:
        return num_str

    ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
            "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
            "seventeen", "eighteen", "nineteen"]
    tens = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

    def _under_thousand(num: int) -> str:
        if num < 20:
            return ones[num]
        elif num < 100:
            t = tens[num // 10 - 2]
            o = num % 10
            return f"{t} {ones[o]}" if o else t
        else:
            h = num // 100
            r = num % 100
            if r:
                return f"{ones[h]} hundred and {_under_thousand(r)}"
            return f"{ones[h]} hundred"

    if n < 1000:
        return _under_thousand(n)
    elif n < 1_000_000:  # thousands
        th = n // 1000
        rem = n % 1000
        result = f"{_under_thousand(th)} thousand"
        if rem:
            if rem < 100:
                result += f" and {_under_thousand(rem)}"
            else:
                result += f" {_under_thousand(rem)}"
        return result
    elif n < 1_000_000_000:  # millions
        mil = n // 1_000_000
        rem = n % 1_000_000
        result = f"{_under_thousand(mil)} million"
        if rem:
            result += f" {_number_to_words(str(rem))}"
        return result
    elif n < 1_000_000_000_000:  # billions
        bil = n // 1_000_000_000
        rem = n % 1_000_000_000
        result = f"{_under_thousand(bil)} billion"
        if rem:
            result += f" {_number_to_words(str(rem))}"
        return result
    else:
        return str(n)



def _split_sentences(text: str) -> List[str]:
    major_sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    segments = []
    for sent in major_sentences:
        sent = sent.strip()
        if not sent:
            continue
        words = sent.split()
        if len(words) > 20:
            sub_parts = re.split(r'(?<=[,;])\s+', sent)
            merged = []
            buffer = ""
            for part in sub_parts:
                part = part.strip()
                if not part:
                    continue
                wc = len(part.split())
                if wc < 4 and buffer:
                    buffer += " " + part
                else:
                    if buffer:
                        merged.append(buffer.strip())
                        buffer = ""
                    merged.append(part)
            if buffer:
                merged.append(buffer.strip())
            segments.extend(merged)
        else:
            segments.append(sent)
    return [s.strip() for s in segments if s.strip() and len(s.strip()) > 1]


def _detect_sentence_type(sentence: str) -> str:
    s = sentence.strip()
    if s.endswith('?'):
        return "question"
    elif s.endswith('!'):
        return "exclamation"
    return "statement"


def _get_natural_params(emotion: str, sentences: List[str]) -> Dict[str, float]:
    emotion = emotion.lower()
    emo_cfg = settings.PIPER_EMOTION_MAP.get(emotion, settings.PIPER_EMOTION_MAP["neutral"])
    ls = float(emo_cfg["length_scale"])
    ns = float(emo_cfg.get("noise_scale", 0.667))
    vol = float(emo_cfg.get("volume", 1.0))
    pause = float(emo_cfg.get("sentence_pause", 0.4 + (ls - 0.9) * 0.3))
    types = [_detect_sentence_type(s) for s in sentences]
    n_q = types.count("question")
    n_e = types.count("exclamation")
    total = len(sentences) or 1
    if n_q / total > 0.4:
        ls *= 0.97
        pause *= 0.85
    if n_e / total > 0.3:
        ns = min(ns + 0.08, 0.9)
        vol = min(vol * 1.08, 1.2)
        pause *= 1.15
    avg_len = sum(len(s) for s in sentences) / len(sentences)
    if avg_len > 100:
        ls *= 1.04
        pause *= 1.1
    ls *= random.uniform(0.98, 1.02)
    ns *= random.uniform(0.99, 1.01)
    return {
        "length_scale": max(0.7, min(1.6, ls)),
        "noise_scale": max(0.4, min(0.95, ns)),
        "volume": max(0.8, min(1.3, vol)),
        "sentence_pause": max(0.2, min(1.2, pause)),
    }


def _preprocess_natural(text: str, emotion: str, language: str = "en") -> tuple[list[str], dict[str, float]]:
    text = _strip_markdown(text)
    text = _strip_emojis(text)
    if not text.strip():
        raise TTSException("Text contains only formatting/emojis or is empty after cleaning")
    if len(text) > 5000:
        raise TTSException("Text too long. Maximum 5000 characters")
    sentences = _split_sentences(text)
    if not sentences:
        raise TTSException("No valid sentences found after text preprocessing")
    params = _get_natural_params(emotion, sentences)
    return sentences, params


# ============================================================
# BACKEND SELECTION: PIPER or XTTS
# ============================================================

# Language → Piper voice model name (basename of .onnx file without extension)
# Used only when TTS_ENGINE=piper
LANGUAGE_VOICE_MAP_PIPER = {
    "en": settings.PIPER_DEFAULT_VOICE,
    "ml": settings.PIPER_DEFAULT_VOICE,
    "ta": settings.PIPER_DEFAULT_VOICE,
    "te": settings.PIPER_DEFAULT_VOICE,
    "kn": settings.PIPER_DEFAULT_VOICE,
    "bn": settings.PIPER_DEFAULT_VOICE,
    "gu": settings.PIPER_DEFAULT_VOICE,
    "mr": settings.PIPER_DEFAULT_VOICE,
    "pa": settings.PIPER_DEFAULT_VOICE,
    "ur": settings.PIPER_DEFAULT_VOICE,
    "or": settings.PIPER_DEFAULT_VOICE,
    "si": settings.PIPER_DEFAULT_VOICE,
    "my": settings.PIPER_DEFAULT_VOICE,
    "ne": settings.PIPER_DEFAULT_VOICE,
    "hi": settings.PIPER_DEFAULT_VOICE,
    "es": settings.PIPER_DEFAULT_VOICE,
    "fr": settings.PIPER_DEFAULT_VOICE,
    "de": settings.PIPER_DEFAULT_VOICE,
    "zh": settings.PIPER_DEFAULT_VOICE,
    "ja": settings.PIPER_DEFAULT_VOICE,
    "ko": settings.PIPER_DEFAULT_VOICE,
}

VOICE_NAME_MAP_PIPER = {
    "nova":   settings.PIPER_DEFAULT_VOICE,
    "alloy":  settings.PIPER_DEFAULT_VOICE,
    "shimmer":settings.PIPER_DEFAULT_VOICE,
    "fable":  settings.PIPER_DEFAULT_VOICE,
    "echo":   "en_US-lessac-medium",
    "onyx":   "en_US-lessac-medium",
}

# Cross-engine voice mapping: Piper voice names → XTTS speaker equivalents
# Ensures consistent voice selection experience across TTS backends
VOICE_NAME_MAP_XTTS = {
    "nova":    "Claribel Dervla",   # expressive female
    "alloy":   "Ruth Rys",          # neutral female
    "shimmer": "Libby Tito",        # warm female
    "fable":   "Daisy Rational",    # conversational female
    "echo":    "Jody Cross",        # clear female (mirroring Piper's echo)
    "onyx":    "Tammi Epping",      # deeper female
}

# Piper caching
_voice_cache: dict[str, PiperVoice] = {}
_executor = ThreadPoolExecutor(max_workers=2)


def _resolve_voice_model_path(voice_name: str) -> Path:
    base_dir = Path(settings.PIPER_VOICE_DIR).expanduser().resolve()
    return base_dir / f"{voice_name}.onnx"


async def _load_piper_voice(voice_name: str) -> Any:
    if not PIPER_AVAILABLE:
        raise TTSException("Piper TTS is not installed. Run: pip install piper-tts")
    if voice_name in _voice_cache:
        return _voice_cache[voice_name]
    model_path = _resolve_voice_model_path(voice_name)
    config_path = Path(f"{model_path}.json")
    if not model_path.exists():
        raise TTSException(f"Piper voice model not found: '{voice_name}'. Expected: {model_path}")
    if not config_path.exists():
        raise TTSException(f"Piper voice config not found: {config_path}")
    logger.info(f"Loading Piper voice: {model_path}")
    try:
        loop = asyncio.get_event_loop()
        voice: PiperVoice = await loop.run_in_executor(
            None,
            lambda: PiperVoice.load(str(model_path), config_path=str(config_path), use_cuda=False)
        )
        _voice_cache[voice_name] = voice
        logger.info(f"Piper voice '{voice_name}' ready (espeak: {voice.config.espeak_voice})")
        return voice
    except Exception as e:
        logger.error(f"Failed to load Piper voice '{voice_name}': {e}", exc_info=True)
        raise TTSException(f"Failed to load TTS voice: {e}")


def _chunks_to_wav(chunks, sample_rate: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        for ch in chunks:
            int_data = np.clip(ch.audio_float_array * 32767, -32768, 32767).astype(np.int16)
            wav.writeframes(int_data.tobytes())
    return buf.getvalue()


# XTTS lazy import singleton
_xtts_instance = None

def _get_xtts():
    global _xtts_instance
    if _xtts_instance is None:
        try:
            from app.services.xtts_service import get_xtts_service
            _xtts_instance = get_xtts_service()
        except ImportError as e:
            raise TTSException(f"XTTS not available: {e}")
    return _xtts_instance


# ============================================================
# MAIN FACTORY: generate_speech()
# ============================================================

async def generate_speech(
    text: str,
    emotion: str = "neutral",
    voice: Optional[str] = None,
    speed: Optional[float] = None,
    return_base64: bool = True,
    language: str = "en",
    speaker_wav: Optional[str] = None,
    tts_engine: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Unified TTS entry point with caching. Selects backend based on settings.TTS_ENGINE,
    or overrides with tts_engine if provided.
    """
    engine = tts_engine or settings.TTS_ENGINE
    logger.info(f"TTS generate_speech: requested_engine={tts_engine}, default_engine={settings.TTS_ENGINE}, resolved_engine={engine}, lang={language}")

    # Automatic fallback chain: XTTS → Indic Parler → Piper for unsupported languages
    if engine == "xtts":
        XTTS_SUPPORTED_LANGS = {
            "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl",
            "cs", "ar", "zh-cn", "zh-tw", "hu", "ko", "ja", "hi"
        }
        if language not in XTTS_SUPPORTED_LANGS:
            if INDIC_PARLER_AVAILABLE:
                logger.warning(f"Language '{language}' not supported by XTTS, falling back to Indic Parler")
                engine = "indic-parler"
            else:
                logger.warning(f"Language '{language}' not supported by XTTS, Indic Parler unavailable, falling back to Piper")
                engine = "piper"

            voice = None
            speaker_wav = None





    # Determine if result is cacheable (Piper, Indic Parler always cacheable; XTTS only when cloning disabled)
    should_cache = (engine in ("piper", "indic-parler")) or (engine == "xtts" and not settings.XTTS_CLONE_ENABLE)
    cache_key = None
    if should_cache:
        cache_key = _get_cache_key(text, voice or "", emotion, language, engine)
        if cache_key in _tts_cache:
            logger.debug(f"TTS cache hit for: {text[:50]}...")
            cached = _tts_cache[cache_key]
            if return_base64:
                return {
                    "audio": cached,
                    "format": "wav",
                    "language": language,
                    "voice": voice,
                    "rate": 1.0,
                    "volume": 1.0,
                    "emotion": emotion,
                    "engine": engine,
                }
            else:
                import base64
                return {
                    "audio_bytes": base64.b64decode(cached),
                    "format": "wav",
                    "language": language,
                    "voice": voice,
                    "rate": 1.0,
                    "volume": 1.0,
                    "emotion": emotion,
                    "engine": engine,
                }

    # Route to appropriate backend with fallback to Piper if selected engine fails
    try:
        if engine == "xtts":
            result = await _generate_xtts(text, language, voice, speaker_wav, speed, emotion, return_base64)
        elif engine == "indic-parler":
            result = await _generate_indic_parler(text, language, speed, emotion, return_base64)
        else:
            result = await _generate_piper(text, emotion, voice, speed, return_base64, language)
    except TTSException as e:
        if engine != "piper":
            logger.warning(f"Engine '{engine}' failed: {e}. Falling back to Piper.")
            result = await _generate_piper(text, emotion, voice, speed, return_base64, language)
        else:
            raise

    # Store in cache if applicable
    if should_cache and cache_key is not None:
        if len(_tts_cache) >= MAX_CACHE_SIZE:
            _tts_cache.pop(next(iter(_tts_cache)))  # Simple LRU eviction
        _tts_cache[cache_key] = result["audio"] if return_base64 else base64.b64encode(result["audio_bytes"]).decode()

    return result


# ============================================================
# INDIC PARLER BACKEND
# ============================================================

async def _generate_indic_parler(
    text: str,
    language: str,
    speed: Optional[float],
    emotion: str,
    return_base64: bool,
) -> Dict[str, Any]:
    """Indic Parler TTS backend (supports 21 Indic languages including Malayalam)."""
    try:
        from app.services.indic_parler_service import get_indic_parler_service
    except ImportError as e:
        raise TTSException(f"Indic Parler not available: {e}")

    spd = float(speed) if speed else 1.0
    emo = emotion.lower()
    if emo == "cheerful":
        spd = min(spd * 1.05, 1.5)
    elif emo == "sad":
        spd = max(spd * 0.92, 0.5)
    elif emo == "angry":
        spd = min(spd * 1.03, 1.5)
    elif emo == "excited":
        spd = min(spd * 1.08, 1.5)
    elif emo == "calm":
        spd = max(spd * 0.96, 0.5)

    indic = get_indic_parler_service()
    result = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: indic.synthesize(text=text, language=language, speed=spd, emotion=emo)
    )

    if not return_base64:
        result["audio_bytes"] = base64.b64decode(result["audio"])
        del result["audio"]

    return result



# ============================================================
# PIPER BACKEND
# ============================================================

async def _generate_piper(
    text: str,
    emotion: str,
    voice: Optional[str],
    speed: Optional[float],
    return_base64: bool,
    language: str,
) -> Dict[str, Any]:
    """Piper TTS backend with natural speech enhancements."""
    try:
        from piper import PiperVoice
        from piper.config import SynthesisConfig
    except ImportError:
        raise TTSException("Piper TTS not installed. Run: pip install piper-tts")

    # Natural preprocessing
    sentences, base_prosody = _preprocess_natural(text, emotion, language)
    
    # Resolve voice
    voice_name = LANGUAGE_VOICE_MAP_PIPER.get(language, settings.PIPER_DEFAULT_VOICE)
    if voice is not None:
        voice_name = VOICE_NAME_MAP_PIPER.get(voice, voice)
    
    # Emotion config
    emo_cfg = settings.PIPER_EMOTION_MAP.get(emotion.lower(), settings.PIPER_EMOTION_MAP["neutral"])
    base_length = float(emo_cfg["length_scale"])
    base_volume = float(emo_cfg.get("volume", 1.0))
    base_noise = float(emo_cfg.get("noise_scale", 0.667))
    
    # Apply prosody adjustments from sentence analysis
    base_length = base_prosody["length_scale"]
    base_noise = base_prosody["noise_scale"]
    base_volume = base_volume * base_prosody["volume"]
    
    # User speed override
    if speed is not None:
        try:
            s = float(speed)
            if 0.1 <= s <= 5.0:
                base_length = base_length / s
        except (ValueError, TypeError):
            pass
    
    logger.info(f"Piper: voice={voice_name}, lang={language}, emotion={emotion}, "
                f"ls={base_length:.3f}, vol={base_volume:.2f}, sentences={len(sentences)}")
    
    voice_obj = await _load_piper_voice(voice_name)
    sample_rate = voice_obj.config.sample_rate
    
    # Synthesize each sentence with variable silence gaps
    all_audio_arrays: List[np.ndarray] = []
    full_pause_samples = int(sample_rate * base_prosody["sentence_pause"])
    short_pause_samples = int(sample_rate * 0.25)
    silence_short = np.zeros(short_pause_samples, dtype=np.float32) if short_pause_samples > 0 else None
    silence_full = np.zeros(full_pause_samples, dtype=np.float32) if full_pause_samples > 0 else None
    
    loop = asyncio.get_event_loop()
    
    for i, sentence in enumerate(sentences):
        sent_ls = base_length * random.uniform(0.97, 1.03)
        sent_ns = base_noise * random.uniform(0.96, 1.04)
        sent_vol = base_volume * random.uniform(0.98, 1.02)
        
        s_type = _detect_sentence_type(sentence)
        if s_type == "question":
            sent_ls *= 0.98
            sent_ns *= 1.04
        elif s_type == "exclamation":
            sent_ns = min(sent_ns * 1.08, 0.92)
            sent_vol = min(sent_vol * 1.05, 1.25)
        
        synth_cfg = SynthesisConfig(
            length_scale=max(0.7, min(1.6, sent_ls)),
            noise_scale=max(0.4, min(0.95, sent_ns)),
            noise_w_scale=0.8,
            normalize_audio=True,
        )
        
        try:
            sentence_chunks = await loop.run_in_executor(
                None,
                lambda: list(voice_obj.synthesize(sentence, syn_config=synth_cfg))
            )
        except Exception as e:
            logger.warning(f"Piper failed on sentence '{sentence[:30]}...': {e}")
            continue
        
        if sentence_chunks:
            for ch in sentence_chunks:
                arr = np.clip(ch.audio_float_array * sent_vol, -1.0, 1.0)
                all_audio_arrays.append(arr)
            
            if i < len(sentences) - 1:
                stripped = sentence.rstrip()
                if stripped:
                    last_char = stripped[-1]
                    if last_char in (',', ';'):
                        if silence_short is not None:
                            all_audio_arrays.append(silence_short.copy())
                    else:
                        if silence_full is not None:
                            all_audio_arrays.append(silence_full.copy())
    
    if not all_audio_arrays:
        raise TTSException("Synthesis produced no audio")
    
    combined_float = np.concatenate(all_audio_arrays)
    pcm_int16 = np.clip(combined_float * 32767, -32768, 32767).astype(np.int16)
    
    wav_buf = io.BytesIO()
    with wave.open(wav_buf, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm_int16.tobytes())
    wav_bytes = wav_buf.getvalue()
    
    word_count = sum(len(s.split()) for s in sentences)
    duration_sec = len(wav_bytes) / (2 * sample_rate)
    rate_wpm = int(word_count / (duration_sec / 60)) if duration_sec > 0 else 200
    
    reported_volume = base_volume
    reported_speed = round(1.0 / base_length, 2) if base_length != 0 else 1.0
    
    result = {
        "format": "wav",
        "emotion": emotion.lower(),
        "rate": rate_wpm,
        "volume": round(reported_volume, 2),
        "language": language,
        "voice": voice_name,
        "speed": reported_speed,
        "sentence_count": len(sentences),
        "sentence_pause_ms": int(base_prosody["sentence_pause"] * 1000),
        "engine": "piper",
    }
    
    if return_base64:
        import base64
        result["audio"] = base64.b64encode(wav_bytes).decode("utf-8")
    else:
        result["audio_bytes"] = wav_bytes
    
    logger.info(f"Piper synthesis complete: {len(wav_bytes)} bytes, {rate_wpm} wpm")
    return result


# ============================================================
# XTTS BACKEND
# ============================================================

async def _generate_xtts(
    text: str,
    language: str,
    voice: Optional[str],
    speaker_wav: Optional[str],
    speed: Optional[float],
    emotion: str,
    return_base64: bool,
) -> Dict[str, Any]:
    """XTTS v2 backend (high-quality multilingual)."""
    try:
        xtts = _get_xtts()
    except TTSException as e:
        raise TTSException(f"XTTS service unavailable: {e}")

    spd = float(speed) if speed else 1.0
    # Subtle emotion-based speed adjustment (XTTS has no direct emotion control)
    emo = emotion.lower()
    if emo == "cheerful":
        spd = min(spd * 1.05, 1.5)
    elif emo == "sad":
        spd = max(spd * 0.92, 0.5)
    elif emo == "angry":
        spd = min(spd * 1.03, 1.5)
    elif emo == "excited":
        spd = min(spd * 1.08, 1.5)
    elif emo == "calm":
        spd = max(spd * 0.96, 0.5)

    # Resolve voice selection:
    # - "cloned:filename.wav" → use as speaker_wav
    # - "built-in:Speaker Name" or bare name → use as built-in speaker
    # - None → default speaker (first available or configured)
    # - Piper voice names (nova, alloy, etc.) automatically map to XTTS equivalents
    resolved_speaker_wav = None
    resolved_speaker_name = None

    if voice:
        if voice.startswith('cloned:'):
            filename = voice.split(':', 1)[1]
            resolved_speaker_wav = str(Path(settings.XTTS_VOICE_DIR) / f"{filename}.wav")
        elif voice.startswith('built-in:'):
            resolved_speaker_name = voice.split(':', 1)[1]
        else:
            # Check if this is a Piper voice name that needs XTTS mapping
            if voice in VOICE_NAME_MAP_XTTS:
                resolved_speaker_name = VOICE_NAME_MAP_XTTS[voice]
                logger.info(f"Mapped Piper voice '{voice}' to XTTS speaker: {resolved_speaker_name}")
            else:
                # Assume it's a direct XTTS built-in speaker name
                resolved_speaker_name = voice
    elif speaker_wav:
        resolved_speaker_wav = speaker_wav

    result = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: xtts.synthesize(
            text=text,
            language=language,
            speaker_wav=Path(resolved_speaker_wav) if resolved_speaker_wav else None,
            speaker=resolved_speaker_name,
            speed=spd
        )
    )

    if not return_base64:
        result["audio_bytes"] = base64.b64decode(result["audio"])
        del result["audio"]

    return result



# ============================================================
# PUBLIC UTILITIES
# ============================================================


def get_available_voices() -> list[str]:
    """List available voice models for current engine."""
    if settings.TTS_ENGINE == "xtts":
        try:
            xtts = _get_xtts()
            return xtts.list_available_voices()
        except TTSException:
            return []
    elif settings.TTS_ENGINE == "indic-parler":
        # Indic Parler uses built-in speakers; no custom voice files
        return ["indic-parler-built-in"]
    else:
        # Piper: list all .onnx files in voice dir
        voice_dir = Path(settings.PIPER_VOICE_DIR).expanduser().resolve()
        if not voice_dir.exists():
            return []
        return sorted([p.stem for p in voice_dir.glob("*.onnx")])


def cleanup_tts():
    """Free resources (call on shutdown)."""
    global _xtts_instance
    if _xtts_instance:
        _xtts_instance.cleanup()
        _xtts_instance = None
    # Cleanup Indic Parler if needed
    try:
        from app.services.indic_parler_service import _indic_instance as indic_inst
        if indic_inst:
            indic_inst.cleanup()
    except Exception:
        pass
    _executor.shutdown(wait=False)
