"""XTTS v2 TTS service wrapper with GPU/CPU fallback."""
import re
import threading
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
import numpy as np
import torch
import torchaudio

from app.core.config import settings
from app.core.exceptions import TTSException

logger = logging.getLogger(__name__)

# --- Text cleaning helpers ---
_EMOJI_PATTERN = re.compile(
    "[" +
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map
    "\U0001F700-\U0001F77F"  # alchemical
    "\U0001F780-\U0001F7FF"  # geometric
    "\U0001F800-\U0001F8FF"  # arrows
    "\U0001F900-\U0001F9FF"  # supplemental
    "\U0001FA00-\U0001FA6F"  # chess
    "\U0001FA70-\U0001FAFF"  # symbols & pictographs extended
    "\u2700-\u27BF"          # dingbats
    "\u2600-\u26FF"          # misc symbols
    "]+",
    flags=re.UNICODE
)

_MARKDOWN_PATTERNS = [
    (r'\*\*(.+?)\*\*', r'\1'),
    (r'\*(.+?)\*', r'\1'),
    (r'__(.+?)__', r'\1'),
    (r'_(.+?)_', r'\1'),
    (r'`(.+?)`', r'\1'),
    (r'~~(.+?)~~', r'\1'),
]

_ABBREVIATIONS = [
    (r'\bProf\.', 'Professor'), (r'\bRev\.', 'Reverend'), (r'\bDr\.', 'Doctor'),
    (r'\bMr\.', 'Mister'), (r'\bMrs\.', 'Misses'), (r'\bMs\.', 'Miss'),
    (r'\bSr\.', 'Senior'), (r'\bJr\.', 'Junior'), (r'\bSt\.', 'Saint'),
    (r'\bAve\.', 'Avenue'), (r'\bBlvd\.', 'Boulevard'), (r'\bRd\.', 'Road'),
    (r'\bLn\.', 'Lane'),
]

_CARDINAL_MAP = {
    '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
    '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
}

def _clean_text(text: str) -> str:
    text = _EMOJI_PATTERN.sub('', text)
    for pattern, replacement in _MARKDOWN_PATTERNS:
        text = re.sub(pattern, replacement, text, flags=re.DOTALL)
    for abbr, expansion in _ABBREVIATIONS:
        text = re.sub(abbr, expansion, text, flags=re.IGNORECASE)
    text = re.sub(r'(\d{1,2}):(\d{2})(?::\d{2})?', _replace_time, text)
    text = re.sub(r'(\d{1,3}(?:,\d{3})*)(?:\s?%)?', _expand_cardinal, text)
    text = re.sub(r'(\d+)(?:st|nd|rd|th)\b', lambda m: m.group(1) + 'th', text, flags=re.IGNORECASE)
    text = re.sub(r'\$(\d+(?:,\d{3})*(?:\.\d+)?)', lambda m: _expand_currency(m.group(1)), text)
    text = re.sub(r'(\d+)\s*([kmb])\b', lambda m: f"{m.group(1)} {m.group(2).upper()} ", text, flags=re.IGNORECASE)
    text = re.sub(r'\+', ' plus ', text)
    text = re.sub(r'(\d{3,})\s+(\d{3})', r'\1\2', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def _replace_time(m: re.Match) -> str:
    h, m_ = m.group(1), m.group(2)
    return f"{h} {m_}"

def _expand_cardinal(m: re.Match) -> str:
    num_str = re.sub(r'[^\d]', '', m.group(0))
    words = [CARDINAL_MAP.get(d, d) for d in num_str]
    return ' '.join(words)

def _expand_currency(num_str: str) -> str:
    num = num_str.replace(',', '')
    if float(num) >= 1000000:
        val = float(num) / 1_000_000
        return f"{val:.1f} million dollars"
    elif float(num) >= 1000:
        val = float(num) / 1000
        return f"{val:.1f} thousand dollars"
    return num_str

CARDINAL_MAP = _CARDINAL_MAP

def _split_into_chunks(text: str, max_chars: int = 200) -> List[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    chunks = []
    current = ""
    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        if len(current) + len(sent) + 1 <= max_chars:
            current = (current + " " + sent).strip()
        else:
            if current:
                chunks.append(current)
            current = sent
    if current:
        chunks.append(current)
    return chunks if chunks else [text]

# --- XTTS Service ---
class XTTSService:
    def __init__(self):
        self._tts = None
        self._device = "cuda" if settings.XTTS_USE_GPU and torch.cuda.is_available() else "cpu"
        self._voices_dir = Path(settings.XTTS_VOICE_DIR).expanduser().resolve()
        self._default_speaker_name = settings.XTTS_DEFAULT_SPEAKER or None
        self._cpu_fallback_attempted = False

    def load(self):
        if self._tts is None:
            try:
                from TTS.api import TTS as CoquiTTS
                model_name = "tts_models/multilingual/multi-dataset/xtts_v2"
                self._tts = CoquiTTS(model_name, progress_bar=False).to(self._device)
                logger.info(f"XTTS model loaded on {self._device}")
            except Exception as e:
                logger.error(f"Failed to load XTTS model: {e}", exc_info=True)
                raise TTSException(f"Failed to initialize XTTS: {e}")
        return self._tts

    def synthesize(
        self,
        text: str,
        language: str = "en",
        speaker_wav: Optional[Path] = None,
        speaker: Optional[str] = None,
        speed: float = 1.0,
    ) -> Dict[str, Any]:
        """Synthesize speech with automatic GPU→CPU fallback on CUDA errors."""
        try:
            return self._synthesize_internal(text, language, speaker_wav, speaker, speed)
        except RuntimeError as e:
            err_msg = str(e)
            if ('CUDA' in err_msg or 'cuda' in err_msg) and self._device == "cuda" and not self._cpu_fallback_attempted:
                logger.warning(f"XTTS CUDA error: {err_msg}. Switching to CPU and retrying once...")
                self._device = "cpu"
                self._cpu_fallback_attempted = True
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                self._tts = None  # Force reload on CPU
                try:
                    return self._synthesize_internal(text, language, speaker_wav, speaker, speed)
                finally:
                    self._cpu_fallback_attempted = False
            raise TTSException(f"XTTS failed: {e}")

    def _synthesize_internal(
        self,
        text: str,
        language: str,
        speaker_wav: Optional[Path],
        speaker: Optional[str],
        speed: float
    ) -> Dict[str, Any]:
        tts = self.load()
        clean = _clean_text(text)
        if not clean:
            raise TTSException("Text is empty after removing emojis/formatting")
        if len(clean) > 5000:
            raise TTSException("Text too long (max 5000 characters)")
        sentence_count = max(1, len(re.findall(r'[.!?]+', clean)))
        chunk_size = getattr(settings, 'XTTS_CHUNK_SIZE', 200)
        chunks = _split_into_chunks(clean, max_chars=chunk_size)
        if len(chunks) > 1:
            logger.info(f"XTTS: splitting into {len(chunks)} chunks")

        # Resolve speaker
        if speaker_wav and speaker_wav.exists():
            logger.info(f"Using voice cloning: {speaker_wav}")
            speaker = None
        else:
            if speaker:
                try:
                    sm = tts.synthesizer.tts_model.speaker_manager
                    if sm and hasattr(sm, 'speakers') and speaker not in sm.speakers:
                        logger.warning(f"Speaker '{speaker}' not found, using default")
                        speaker = None
                except Exception:
                    speaker = None
            if not speaker:
                if self._default_speaker_name:
                    speaker = self._default_speaker_name
                    logger.info(f"Using configured speaker: {speaker}")
                else:
                    try:
                        sm = tts.synthesizer.tts_model.speaker_manager
                        if sm and hasattr(sm, 'speakers'):
                            available = list(sm.speakers.keys())
                            expressive = ["Claribel Dervla", "Ruth Rys", "Libby Tito", "Daisy Rational", "Tammi Epping", "Jody Cross", "Greetje Driessen", "Jette Horn"]
                            for cand in expressive:
                                if cand in available:
                                    speaker = cand
                                    break
                            else:
                                speaker = available[0] if available else None
                    except Exception:
                        speaker = None
            if speaker:
                logger.info(f"Using XTTS built-in speaker: {speaker}")
            else:
                logger.info("Using XTTS default speaker")

        logger.info(f"XTTS synthesizing: lang={language}, speed={speed}, cloning={speaker_wav is not None}, chunks={len(chunks)}, device={self._device}")

        all_audio_arrays = []
        global _xtts_semaphore
        if _xtts_semaphore is None:
            max_concurrent = getattr(settings, 'XTTS_MAX_CONCURRENT', 2 if self._device == "cuda" else 1)
            _xtts_semaphore = threading.Semaphore(max_concurrent)
            logger.info(f"XTTS semaphore: max_concurrent={max_concurrent}")

        def synthesize_chunk(chunk_text: str) -> np.ndarray:
            with _xtts_semaphore:
                logger.debug(f"Synthesizing: {chunk_text[:60]}...")
                wav_chunk = tts.tts(
                    text=chunk_text, language=language, speaker=speaker,
                    speaker_wav=str(speaker_wav) if speaker_wav else None,
                    speed=speed, split_sentences=False
                )
                if isinstance(wav_chunk, list):
                    arr = np.array(wav_chunk, dtype=np.float32)
                elif isinstance(wav_chunk, torch.Tensor):
                    arr = wav_chunk.cpu().numpy()
                else:
                    arr = np.asarray(wav_chunk, dtype=np.float32)
                return arr.flatten()

        for chunk in chunks:
            all_audio_arrays.append(synthesize_chunk(chunk))

        wav = all_audio_arrays[0] if len(all_audio_arrays) == 1 else np.concatenate(all_audio_arrays)
        sample_rate = tts.synthesizer.output_sample_rate
        if sample_rate != 16000:
            logger.info(f"Resampling: {sample_rate}Hz -> 16000Hz")
            wav_tensor = torch.from_numpy(wav).float().unsqueeze(0)
            resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
            wav = resampler(wav_tensor).squeeze(0).numpy()
            sample_rate = 16000

        wav_bytes = self._numpy_to_wav(wav, sample_rate)
        word_count = len(clean.split())
        duration_sec = len(wav_bytes) / (2 * sample_rate)
        rate_wpm = int(word_count / (duration_sec / 60)) if duration_sec > 0 else 200

        result = {
            "format": "wav", "sample_rate": sample_rate, "language": language,
            "voice": speaker_wav.name if speaker_wav else (speaker or "default"),
            "rate": rate_wpm, "volume": 1.0, "speed": speed,
            "sentence_count": sentence_count, "engine": "xtts_v2"
        }
        if speed != 1.0:
            result["speed"] = speed
        result["audio"] = __import__('base64').b64encode(wav_bytes).decode("utf-8")
        logger.info(f"XTTS synthesis complete: {len(wav_bytes)} bytes, {rate_wpm} wpm")
        return result

    @staticmethod
    def _numpy_to_wav(audio, sample_rate: int) -> bytes:
        import numpy as np, io, wave
        audio = np.clip(audio if audio.dtype == np.float32 else audio.astype(np.float32), -1.0, 1.0)
        pcm = (audio * 32767).astype(np.int16)
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wav:
            wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(sample_rate)
            wav.writeframes(pcm.tobytes())
        return buf.getvalue()

    def list_available_voices(self) -> List[str]:
        voices = []
        if self._voices_dir.exists():
            for wav_file in self._voices_dir.glob("*.wav"):
                voices.append(f"cloned:{wav_file.stem}")
        try:
            tts = self.load()
            sm = tts.synthesizer.tts_model.speaker_manager
            if sm and hasattr(sm, 'speakers'):
                for name in sm.speakers.keys():
                    voices.append(f"built-in:{name}")
        except Exception:
            pass
        return sorted(voices)

    def cleanup(self):
        if self._tts is not None and self._device == "cuda":
            del self._tts
            self._tts = None
            torch.cuda.empty_cache()
            logger.info("XTTS model unloaded, GPU cache cleared")

# Singleton
_xtts_instance: Optional[XTTSService] = None
_xtts_semaphore: Optional[threading.Semaphore] = None

def get_xtts_service() -> XTTSService:
    global _xtts_instance, _xtts_semaphore
    if _xtts_instance is None:
        _xtts_instance = XTTSService()
        max_concurrent = getattr(settings, 'XTTS_MAX_CONCURRENT', 2)
        _xtts_semaphore = threading.Semaphore(max_concurrent)
        logger.info(f"XTTS semaphore initialized: max_concurrent={max_concurrent}")
    return _xtts_instance
