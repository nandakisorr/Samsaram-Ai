"""Indic Parler TTS service for high-quality Indian language speech synthesis.

Supports 21 Indic languages including Malayalam, Hindi, Tamil, Telugu, etc.
Uses ai4bharat/indic-parler-tts via HuggingFace Transformers.
Better quality than Piper for Indic languages.
"""
import asyncio
import base64
import io
import logging
import os
import re
import threading
from typing import Optional, Dict, Any
from pathlib import Path

import numpy as np
import torch
import torchaudio

from app.core.config import settings
from app.core.exceptions import TTSException

logger = logging.getLogger(__name__)

# Global singleton
_indic_instance = None
_indic_semaphore: Optional[threading.Semaphore] = None

# Minimal text cleaning
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

_MARKDOWN_PATTERNS = [
    (r'\*\*(.+?)\*\*', r'\1'),
    (r'\*(.+?)\*', r'\1'),
    (r'__(.+?)__', r'\1'),
    (r'_(.+?)_', r'\1'),
    (r'`(.+?)`', r'\1'),
    (r'~~(.+?)~~', r'\1'),
]

def _clean_text(text: str) -> str:
    text = _EMOJI_PATTERN.sub('', text)
    for pattern, replacement in _MARKDOWN_PATTERNS:
        text = re.sub(pattern, replacement, text, flags=re.DOTALL)
    return text.strip()


# Language code mapping (ISO 639-1 to Indic Parler full names)
# Model auto-detects language from prompt, but we provide full names for descriptions
INDIC_LANGUAGES = {
    "asm": "Assamese",
    "ben": "Bengali",
    "bod": "Bodo",
    "doi": "Dogri",
    "eng": "English",
    "guj": "Gujarati",
    "hin": "Hindi",
    "kan": "Kannada",
    "mal": "Malayalam",
    "mar": "Marathi",
    "npi": "Nepali",
    "ori": "Odia",
    "pan": "Punjabi",
    "san": "Sanskrit",
    "sat": "Santali",
    "snd": "Sindhi",
    "tam": "Tamil",
    "tel": "Telugu",
    "urd": "Urdu",
    "mni": "Manipuri",
    "mai": "Maithili",
    # Aliases and common codes
    "ml": "Malayalam",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "bn": "Bengali",
    "gu": "Gujarati",
    "mr": "Marathi",
    "pa": "Punjabi",
    "or": "Odia",
    "as": "Assamese",
    "ne": "Nepali",
    "si": "Sindhi",
    "ur": "Urdu",
    "sa": "Sanskrit",
    "sd": "Santali",
}


class IndicParlerService:
    """Wrapper for ai4bharat/indic-parler-tts via Transformers pipeline."""

    def __init__(self):
        self._pipeline = None
        self._device = "cuda" if settings.XTTS_USE_GPU and torch.cuda.is_available() else "cpu"
        # On CPU, limit PyTorch threads
        if self._device == "cpu":
            torch.set_num_threads(1)
        # Read HuggingFace token from environment (required for gated models)
        self._hf_token = os.environ.get("HUGGINGFACE_TOKEN")
        logger.info(f"IndicParler initialized (device={self._device}, token={'set' if self._hf_token else 'not set'})")

    def load(self):
        if self._pipeline is None:
            try:
                from transformers import pipeline
                logger.info(f"Loading Indic Parler TTS model on {self._device}...")
                pipeline_kwargs = {
                    "task": "text-to-speech",
                    "model": "ai4bharat/indic-parler-tts",
                    "device": self._device,
                    "trust_remote_code": True
                }
                if self._hf_token:
                    pipeline_kwargs["token"] = self._hf_token
                self._pipeline = pipeline(**pipeline_kwargs)
                logger.info("Indic Parler TTS model loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load Indic Parler model: {e}", exc_info=True)
                raise TTSException(f"Failed to initialize Indic Parler TTS: {e}")
        return self._pipeline

    def synthesize(
        self,
        text: str,
        language: str = "en",
        speed: float = 1.0,
        emotion: str = "neutral"
    ) -> Dict[str, Any]:
        try:
            # Ensure semaphore is initialized
            global _indic_semaphore
            if _indic_semaphore is None:
                max_concurrent = getattr(settings, 'XTTS_MAX_CONCURRENT', 2 if self._device == "cuda" else 1)
                _indic_semaphore = threading.Semaphore(max_concurrent)
                logger.info(f"IndicParler semaphore: max_concurrent={max_concurrent}")

            pipe = self.load()

            clean = _clean_text(text)
            if not clean:
                raise TTSException("Text is empty after cleaning")
            if len(clean) > 5000:
                raise TTSException("Text too long (max 5000 characters)")

            # Map language code to full name for description
            lang_name = INDIC_LANGUAGES.get(language.lower(), "English")
            logger.info(f"IndicParler synthesizing: lang={language} ({lang_name}), speed={speed}, emotion={emotion}")

            # Split into chunks if text is long (~250 chars threshold to be safe)
            chunks = self._split_text(clean)
            audios = []

            with _indic_semaphore:
                for chunk in chunks:
                    # Build description: speaker-independent, emotion-guided
                    description = self._build_description(lang_name, speed, emotion)
                    output = pipe(chunk, description=description)
                    # Output format: {'audio': array, 'sampling_rate': int}
                    wav = output["audio"]
                    if isinstance(wav, torch.Tensor):
                        wav = wav.cpu().numpy()
                    wav = wav.squeeze()
                    audios.append(wav)

            # Concatenate all chunks
            if len(audios) > 1:
                arr = np.concatenate(audios)
            else:
                arr = audios[0]

            # Ensure 1D
            arr = arr.flatten()

            # Resample to 16kHz if needed (Indic Parler uses 24kHz typically)
            sample_rate = self._pipeline.model.config.sampling_rate
            if sample_rate != 16000:
                logger.info(f"Resampling from {sample_rate}Hz to 16000Hz")
                wav_tensor = torch.from_numpy(arr).float().unsqueeze(0)
                resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
                wav_tensor = resampler(wav_tensor)
                arr = wav_tensor.squeeze(0).numpy()
                sample_rate = 16000

            wav_bytes = self._numpy_to_wav(arr, sample_rate)

            result = {
                "format": "wav",
                "sample_rate": sample_rate,
                "language": language,
                "voice": "indic-parler-built-in",
                "rate": int(len(clean.split()) / (len(arr) / sample_rate / 60)) if len(arr) > 0 else 200,
                "volume": 1.0,
                "speed": speed,
                "engine": "indic-parler"
            }

            result["audio"] = base64.b64encode(wav_bytes).decode("utf-8")
            logger.info(f"IndicParler synthesis complete: {len(wav_bytes)} bytes")
            return result

        except TTSException:
            raise
        except Exception as e:
            logger.error(f"IndicParler synthesis error: {e}", exc_info=True)
            raise TTSException(f"Indic Parler failed: {e}")

    def _build_description(self, language_name: str, speed: float, emotion: str) -> str:
        """Construct a descriptive caption for the desired voice characteristics."""
        # Base description with high quality
        desc = "A clear, high-quality recording with no background noise. "

        # Gender-neutral phrasing preferred; add speaker descriptor based on language if needed
        # Emotion mapping
        emo_map = {
            "cheerful": "cheerful, energetic and happy tone",
            "happy": "happy and positive tone",
            "sad": "sad and melancholic tone",
            "angry": "angry and intense tone",
            "excited": "excited and enthusiastic tone",
            "calm": "calm and peaceful tone",
            "neutral": "neutral conversational tone",
        }
        emo_desc = emo_map.get(emotion.lower(), "neutral conversational tone")

        # Speed adjustment
        if speed < 0.9:
            speed_desc = "slightly slow pace"
        elif speed > 1.1:
            speed_desc = "slightly fast pace"
        else:
            speed_desc = "moderate speed"

        desc += f"A {language_name} speaker delivering speech in a {emo_desc} with {speed_desc}. The voice is clear and close-up."
        return desc

    def _split_text(self, text: str, max_chars: int = 250) -> list[str]:
        """Split text into sentence chunks respecting punctuation."""
        # Split on sentence boundaries
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        chunks = []
        current = ""

        for sent in sentences:
            sent = sent.strip()
            if not sent:
                continue
            # If adding this sentence would exceed limit, start new chunk
            if len(current) + len(sent) + 1 > max_chars and current:
                chunks.append(current.strip())
                current = sent
            else:
                if current:
                    current += " " + sent
                else:
                    current = sent

        if current.strip():
            chunks.append(current.strip())
        return chunks if chunks else [text]

    @staticmethod
    def _numpy_to_wav(audio, sample_rate: int) -> bytes:
        import numpy as np, io, wave
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)
        audio = np.clip(audio, -1.0, 1.0)
        pcm = (audio * 32767).astype(np.int16)
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(pcm.tobytes())
        return buf.getvalue()

    def cleanup(self):
        if self._pipeline is not None and self._device == "cuda":
            del self._pipeline
            self._pipeline = None
            torch.cuda.empty_cache()
            logger.info("Indic Parler model unloaded, GPU cache cleared")


# Singleton access
def get_indic_parler_service() -> IndicParlerService:
    global _indic_instance, _indic_semaphore
    if _indic_instance is None:
        _indic_instance = IndicParlerService()
        max_concurrent = getattr(settings, 'XTTS_MAX_CONCURRENT', 2)
        _indic_semaphore = threading.Semaphore(max_concurrent)
        logger.info(f"IndicParler semaphore initialized: max_concurrent={max_concurrent}")
    return _indic_instance
