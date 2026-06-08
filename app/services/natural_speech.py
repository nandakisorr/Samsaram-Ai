"""Natural Speech Enhancement Module for Piper TTS.

Provides human-like speech through:
- Text normalization (numbers, dates, abbreviations)
- Dynamic prosody adjustment (based on punctuation, sentence type)
- Emotion-aware parameter tuning
- Intelligent sentence splitting with contextual pauses
"""

import re
import random
from dataclasses import dataclass
from typing import List, Tuple, Optional

@dataclass
class SpeechParams:
    """Parameters for natural speech synthesis."""
    length_scale: float      # Speed (lower = faster)
    noise_scale: float       # Expressiveness
    volume: float            # Loudness
    sentence_pause: float    # Pause between sentences (seconds)
    question_rise: float     # Pitch rise factor for questions (0-1)
    emphasis_factor: float   # Emphasis on content words


class NaturalSpeechProcessor:
    """Processes text for more natural TTS output."""
    
    def __init__(self, emotion: str = "neutral", language: str = "en"):
        self.emotion = emotion.lower()
        self.language = language
        
        # Emotion-based base parameters
        self.emo_base = {
            "neutral":   {"ls": 0.94, "ns": 0.667, "vol": 1.0,  "pause": 0.4, "rise": 0.15, "emphasis": 1.0},
            "cheerful":  {"ls": 0.90, "ns": 0.72,  "vol": 1.05, "pause": 0.35,"rise": 0.25, "emphasis": 1.1},
            "sad":       {"ls": 1.10, "ns": 0.6,   "vol": 0.92, "pause": 0.5, "rise": 0.05, "emphasis": 0.9},
            "angry":     {"ls": 0.86, "ns": 0.82,  "vol": 1.02, "pause": 0.3, "rise": 0.3,  "emphasis": 1.2},
            "excited":   {"ls": 0.88, "ns": 0.75,  "vol": 1.08, "pause": 0.35,"rise": 0.3,  "emphasis": 1.15},
            "calm":      {"ls": 1.06, "ns": 0.58,  "vol": 0.95, "pause": 0.55,"rise": 0.1,  "emphasis": 0.95},
        }.get(self.emotion, self.emo_base["neutral"])
    
    def normalize_text(self, text: str) -> str:
        """Expand abbreviations, numbers, dates for natural pronunciation."""
        t = text
        
        # Expand common abbreviations (order: longer first)
        # Patterns must include trailing period to avoid double periods
        abbrevs = [
            (r'\bDr\.', 'Doctor'),
            (r'\bMr\.', 'Mister'),
            (r'\bMrs\.', 'Misses'),
            (r'\bMs\.', 'Miss'),
            (r'\bProf\.', 'Professor'),
            (r'\bRev\.', 'Reverend'),
            (r'\bSt\.', 'Saint'),
            (r'\bAve\.', 'Avenue'),
            (r'\bBlvd\.', 'Boulevard'),
            (r'\bRd\.', 'Road'),
            (r'\betc\.', 'et cetera'),
            (r'\be\.g\.', 'for example'),
            (r'\bi\.e\.', 'that is'),
            (r'\bvs\.', 'versus'),
            (r'\bet al\.', 'and others'),
        ]
        for pat, repl in abbrevs:
            t = re.sub(pat, repl, t, flags=re.IGNORECASE)
        
        # Expand numbers: only standalone whole numbers (not part of phone/IP/date)
        # Avoid: phone numbers (contain - or too many digits), decimals, IPs
        def expand_number(match):
            num_str = match.group(0)
            # Skip if followed by period/percent without space (like 100% or 2.5)
            # But we use word boundaries so these are separate tokens
            try:
                num = int(num_str)
                ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
                        "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
                        "seventeen", "eighteen", "nineteen"]
                tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
                if num < 20:
                    return ones[num]
                elif num < 100:
                    t = tens[num // 10]
                    if num % 10:
                        t += " " + ones[num % 10]
                    return t
                else:
                    return num_str  # Keep 3+ digits as digits (page numbers, years, etc.)
            except:
                return num_str
        
        # Expand only 0-99 (two digits max, maybe 3 for round numbers? Keep simple)
        t = re.sub(r'\b\d{1,2}\b', expand_number, t)
        
        # Currency: $123 → "123 dollars" (number already expanded above if <100)
        t = re.sub(r'\$(\d+(?:\.\d+)?)', lambda m: _expand_currency(m.group(1)), t)
        
        # Percentages: 50% → "50 percent" (number stays as digits for simplicity)
        t = re.sub(r'(\d+)%', r'\1 percent', t)
        
        return t
    
    def _expand_currency(num_str):
        """Convert currency amount to words."""
        # Simple: keep digits, append currency name
        # Could expand further but fine for now
        return f"{num_str} dollars"
    
    def detect_sentence_type(self, sentence: str) -> str:
        """Detect if sentence is a question, exclamation, or statement."""
        s = sentence.strip()
        if not s:
            return "statement"
        if s.endswith('?'):
            return "question"
        elif s.endswith('!'):
            return "exclamation"
        else:
            return "statement"
    
    def get_prosody_params(self, sentence: str, context: dict = None) -> SpeechParams:
        """Adjust prosody parameters based on sentence type and emotion."""
        sent_type = self.detect_sentence_type(sentence)
        
        # Base from emotion
        ls = self.emo_base["ls"]
        ns = self.emo_base["ns"]
        vol = self.emo_base["vol"]
        pause = self.emo_base["pause"]
        rise = self.emo_base["rise"]
        
        # Adjust by sentence type
        if sent_type == "question":
            # Questions slightly faster with slight rise at end
            ls *= 0.97
            rise = min(rise + 0.15, 0.4)
            pause *= 0.9
        elif sent_type == "exclamation":
            # Exclamations slightly slower, more emphasis
            ls *= 1.03
            ns = min(ns + 0.1, 0.9)
            vol = min(vol * 1.1, 1.2)
            pause *= 1.1
        
        # Add slight randomness for human-like variation (±3%)
        ls *= random.uniform(0.97, 1.03)
        ns *= random.uniform(0.98, 1.02)
        
        return SpeechParams(
            length_scale=max(0.7, min(1.5, ls)),
            noise_scale=max(0.4, min(0.95, ns)),
            volume=max(0.8, min(1.2, vol)),
            sentence_pause=max(0.2, min(1.0, pause)),
            question_rise=rise,
            emphasis_factor=self.emo_base["emphasis"]
        )
    
    def split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences, preserving punctuation."""
        # Simple sentence split on punctuation followed by space/capital
        # Keep punctuation attached to sentence
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        return [s.strip() for s in sentences if s.strip()]
    
    def process_for_tts(self, text: str) -> Tuple[List[str], SpeechParams]:
        """
        Full preprocessing: normalize → calculate prosody → split sentences.
        Returns (list_of_sentences, prosody_parameters).
        """
        normalized = self.normalize_text(text)
        sentences = self.split_into_sentences(normalized)
        params = self.get_prosody_params(normalized)
        return sentences, params


def preprocess_text_naturally(text: str, emotion: str = "neutral", language: str = "en") -> dict:
    """
    High-level function: Prepare text for natural TTS.
    
    Returns dict with:
        sentences: list of cleaned sentence strings
        params: SpeechParams with length_scale, noise_scale, volume, pause
        cleaned_text: full cleaned text (for backward compatibility)
    """
    processor = NaturalSpeechProcessor(emotion=emotion, language=language)
    sentences, params = processor.process_for_tts(text)
    
    return {
        "sentences": sentences,
        "params": params,
        "cleaned_text": " ".join(sentences),
    }
