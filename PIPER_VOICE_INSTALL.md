# Piper TTS Voice Installation Guide

Piper provides high-quality, neural, offline text-to-speech. This guide explains how to install voice models.

## Status

✅ **English voice is pre-installed**: `piper_voices/en_US-lessac-medium.onnx` (medium quality, ~48MB). Works out of the box.

⚠️ **Additional language models** (Malayalam, Tamil, etc.) need to be downloaded separately.

## Quick Start (Windows)

### Option A: Automated Downloader (Recommended)

Run the included batch script:

```cmd
install_piper_voices.bat
```

This script attempts to download English and Malayalam voice models from official releases.

> **Note**: If the script fails due to network restrictions (404/timeouts), use Option B.

### Option B: Manual Download

1. Visit the [Piper Voices GitHub Releases](https://github.com/rhasspy/piper-voices/releases) page.
2. Download the `.onnx` and `.onnx.json` files for your desired voice.
   - **English (medium)**: `en_US-amy-medium.onnx` + `.json` (~40 MB)
   - **Malayalam (medium)**: `ml_IN-swetha-medium.onnx` + `.json` (~20 MB)
   - See full language list below.
3. Create the directory `piper_voices/` if it doesn't exist.
4. Copy both files into `piper_voices/`.
5. Restart the backend server.

## Voice Model Placement

Place downloaded files in one of these directories:

- **Project-relative** (default): `piper_voices/` at project root
- **Custom**: Set `PIPER_VOICE_DIR` in `.env` to your folder path.

Example structure:

```
chatbot_v2/
├── piper_voices/
│   ├── en_US-amy-medium.onnx
│   ├── en_US-amy-medium.onnx.json
│   ├── ml_IN-swetha-medium.onnx
│   └── ml_IN-swetha-medium.onnx.json
├── .env
└── ...
```

## Supported Languages & Voice Names

| Language | Code | Recommended Voice | File Prefix |
|----------|------|-------------------|-------------|
| English  | en   | en_US-amy-medium  | `en_US-amy-medium` |
| Malayalam | ml | ml_IN-swetha-medium | `ml_IN-swetha-medium` |
| Tamil    | ta   | ta_IN-ramesh-medium | `ta_IN-ramesh-medium` |
| Telugu   | te   | te_IN-ramesh-medium | `te_IN-ramesh-medium` |
| Kannada  | kn   | kn_IN-ramesh-medium | `kn_IN-ramesh-medium` |
| Hindi    | hi   | hi_IN-swara-medium  | `hi_IN-swara-medium` |
| Bengali  | bn   | bn_IN-ramesh-medium | `bn_IN-ramesh-medium` |
| Gujarati | gu   | gu_IN-ramesh-medium | `gu_IN-ramesh-medium` |
| Marathi  | mr   | mr_IN-ramesh-medium | `mr_IN-ramesh-medium` |
| Punjabi  | pa   | pa_IN-ramesh-medium | `pa_IN-ramesh-medium` |
| Urdu     | ur   | ur_PK-saeed-medium  | `ur_PK-saeed-medium` |
| Odia     | or   | or_IN-ramesh-medium | `or_IN-ramesh-medium` |
| Sinhala  | si   | si_LK-ranjana-medium| `si_LK-ranjana-medium` |
| Burmese  | my   | my_MM-akhara-medium | `my_MM-akhara-medium` |
| Nepali   | ne   | ne_NP-sushma-medium | `ne_NP-sushma-medium` |
| ... and 30+ more | | | |

> **Fallback**: If a language model is missing, the system falls back to English.

## Adding New Voices to the Configuration

The language-to-voice mapping is in `app/services/tts_service.py` (variable `LANGUAGE_VOICE_MAP`). To add a new model:

1. Download the `.onnx` + `.onnx.json` files.
2. Place them in `piper_voices/` (or your custom dir).
3. Add an entry to `LANGUAGE_VOICE_MAP`:

   ```python
   "new_code": "voice-model-basename",  # basename without .onnx
   ```

4. Restart the backend.

## Verifying Installation

Test from Python:

```python
from piper import PiperVoice
voice = PiperVoice.load("piper_voices/en_US-lessac-medium.onnx")
print("Voice loaded for:", voice.config.espeak_voice)
```

If this runs without error, Piper TTS is ready.

## Troubleshooting

### Model not found error

```
TTSException: Piper voice model not found for language 'ml'.
Expected: piper_voices/en_US-amy-medium.onnx
```

**Fix**: Download the voice model files and place them in `PIPER_VOICE_DIR`.

### ImportError: cannot import name 'PiperVoice'

**Fix**: Ensure `piper-tts` is installed:

```cmd
py -3.11 -m pip install piper-tts
```

### Audio is garbled or very slow

**Cause**: Using a v1 model with v2 library may have slightly different synthesis parameters.

**Fix**: Adjust `length_scale` in `EMOTION_VOICE_MAP`. The existing `en_US-lessac-medium` model works but may sound slightly different than v2 models.

### Insufficient RAM

**Cause**: Large models (high quality) need >2GB RAM.

**Fix**: Use `-medium` quality models (~20-50MB) for low memory devices.

## Advanced: Using the Piper CLI (Alternative)

Instead of the Python library, you can also use the `piper` command-line binary:

1. Download `piper.exe` from [Piper releases](https://github.com/rhasspy/piper/releases).
2. Place `piper.exe` in a folder on your PATH or in `backend/`.
3. Call it directly:

   ```python
   subprocess.run([
       "piper", "--model", "en_US-amy-medium.onnx",
       "--output_file", "output.wav"
   ], input=text.encode())
   ```

But the built-in Python library is preferred.
