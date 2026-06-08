# Multilingual Support Setup Guide (Ollama)

This document describes the multilingual support implementation for the chatbot using **Ollama** for local AI inference.

## Overview

The chatbot now supports:
- **Language Selector**: Dropdown in the UI to choose response language
- **Multilingual Input/Output**: Accept questions in any language, always respond in the selected language
- **Ollama LLM**: Uses locally-running LLM (Qwen3 recommended) via Ollama HTTP API
- **Whisper STT**: Voice input via microphone using Ollama Whisper for Speech-to-Text
  - Click the 🎤 mic button to record
  - Auto-detects spoken language
  - Transcribes locally, no cloud API needed
- **Local TTS**: Text-to-speech via **Piper neural TTS** (offline, high-quality)
  - Neural voice models produce natural-sounding speech
  - English voice pre-installed (`piper_voices/en_US-lessac-medium.onnx`)
  - Additional language models can be downloaded (Malayalam, Tamil, etc.)
  - Emotion-based rate/volume modulation (neutral, cheerful, sad, angry, excited, calm)

## Architecture Changes

### Backend (Python/FastAPI)

1. **ChatRequest Schema Update** (`app/schemas/chat.py`)
   - Added `language: str = "en"` field with language code (ISO 639-1)

2. **QwenService Update** (`app/services/qwen_service.py`)
   - Service now calls Ollama local API instead of cloud APIs
   - Contains language instruction mapping for 80+ languages
   - Builds messages with language-specific instructions
   - Handles errors, retries, and timeouts with tenacity

3. **ChatService Update** (`app/services/chat_service.py`)
   - Uses `call_qwen_with_history` from qwen_service
   - Passes `language` parameter through to Ollama service

4. **STT Service** (`app/services/stt_service.py`) — NEW
   - Wraps Ollama Whisper model for audio transcription
   - Accepts audio bytes (WAV, MP3, WebM, OGG)
   - Supports language auto-detection or forced language
   - Returns transcribed text

5. **STT Routes** (`app/routes/stt.py`) — NEW
   - `POST /api/v1/stt/transcribe` — Upload audio, get text back (JWT protected)
   - `GET /api/v1/stt/health` — Check Whisper model availability

6. **Config Update** (`app/core/config.py`)
   - Added `OLLAMA_URL` (default: http://localhost:11434)
   - Added `OLLAMA_MODEL` (default: "qwen3:8b")
   - Added `OLLAMA_MAX_TOKENS` (default: 1024) for response length control
   - Added `OLLAMA_WHISPER_MODEL` (default: "whisper:small") for STT
   - Increased `API_TIMEOUT` to 300s (5 minutes) for long responses

### Backend Performance Enhancements

- **Streaming**: Responses now stream token-by-token via `POST /api/v1/chat/stream` endpoint
- **Reduced token generation**: Default `num_predict=1024` (was 2048) for faster generation
- **Configurable token limit**: Set `OLLAMA_MAX_TOKENS` in `.env`
- **5-minute timeout** for both frontend and backend to accommodate long streams

### Frontend (React/TypeScript)

1. **Type Updates**
   - `ChatRequest` now includes `language?: string`
   - `SendMessageParams` now includes `language?: string`

2. **ChatService Update**
   - `sendMessageStream()` and `sendMessage()` now accept `language` parameter
   - Language included in API payload

3. **UI: Language Selector** (in UserDropdown)
   - Globe icon dropdown in header (via UserDropdown)
   - List of 30+ common languages
   - State managed in global Zustand store

4. **State Management**
   - `useLanguageStore` (Zustand) for shared language state with persistence

## Installation & Configuration

### Step 1: Install Ollama

Download and install Ollama from https://ollama.ai

**Or via package manager:**

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download the installer from https://ollama.ai

### Step 2: Start Ollama Server

Start the Ollama daemon:

```bash
# macOS/Linux
ollama serve

# Windows (PowerShell as Administrator)
ollama serve
```

Ollama will run on `http://localhost:11434` by default.

### Step 3: Pull a Multilingual LLM Model

Ollama needs a language model to generate responses. Recommended multilingual models:

```bash
# Qwen3 8B - Good multilingual support, moderate RAM (~6GB)
ollama pull qwen3:8b

# Qwen3 14B - Better quality, needs more RAM (~12GB)
ollama pull qwen3:14b

# Llama 3.1 8B - Good option, less RAM (~6GB)
ollama pull llama3.1:8b
```

**For most users, `qwen3:8b` is recommended** — it handles 30+ languages well and runs on modest hardware.

### Step 4: Pull the Whisper STT Model (for Voice Input)

Ollama uses a separate model for speech-to-text. Pull a Whisper model:

```bash
# whisper:small — Good balance of speed and accuracy (~2GB)
ollama pull whisper:small

# Other options (faster → slower, less accurate → more accurate):
# whisper:tiny     (~1GB, fastest, lower accuracy)
# whisper:base     (~2GB, good speed/accuracy trade-off)
# whisper:medium   (~5GB, better accuracy)
# whisper:large-v3 (~10GB, best accuracy)
```

**For most users, `whisper:small` is recommended** — it's accurate and fast enough for real-time transcription.

### Step 5: Configure Environment Variables

In your `.env` file, configure:

```bash
# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_MAX_TOKENS=1024
OLLAMA_WHISPER_MODEL=whisper:small

# Piper TTS Configuration
# English voice is pre-installed. For other languages, download models and set:
# PIPER_VOICE_DIR=piper_voices
# PIPER_DEFAULT_VOICE=en_US-lessac-medium
# See PIPER_VOICE_INSTALL.md for adding more voices.
```

### Step 5: (Optional) Install Additional Piper Voice Models

The default English voice (`en_US-lessac-medium`) is included and works for all languages as a fallback. For higher-quality, language-specific neural voices:

1. Run the provided installer:
   ```cmd
   install_piper_voices.bat
   ```
 2. Or manually download models from [Piper Voices Releases](https://github.com/rhasspy/piper-voices/releases).
 3. Place `.onnx` and `.onnx.json` files in `piper_voices/` (or set `PIPER_VOICE_DIR`).
 4. See **PIPER_VOICE_INSTALL.md** for full instructions and language list.

### Step 5b: (Optional) Install Coqui XTTS v2 for High-Quality Multilingual TTS

**XTTS v2** is an alternative TTS engine that offers:
- Superior voice quality (more human-like timbre)
- Voice cloning from a 3-second sample
- 44+ languages with consistent voice across languages
- Emotion/style control via text prompts

**Tradeoffs**: Slower (~2-3x on CPU), more RAM (~6-8GB), GPU recommended for real-time.

# Install PyTorch first (CPU version)
py -3.11 -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install Coqui TTS with XTTS
py -3.11 -m pip install TTS==0.22.0

# Verify installation
py -3.11 -c "from TTS.api import TTS; print('XTTS available')"

#### Configuration

Edit `.env`:
```bash
# Switch TTS engine
TTS_ENGINE=xtts

# XTTS voice samples directory (for cloned voices, optional)
XTTS_VOICE_DIR=xtts_voices

# Default language for XTTS (matches your chat language preference)
XTTS_DEFAULT_LANGUAGE=en

# Enable voice cloning (upload .wav files via UI; see below)
XTTS_CLONE_ENABLE=true

# Use GPU if you have CUDA (much faster)
XTTS_USE_GPU=false   # set true if CUDA available
```

#### Voice Cloning (Optional)

1. Record a clear 3–10 second `.wav` sample of your voice (or any target voice) speaking naturally.
2. Place the file in `xtts_voices/` (or upload via UI if implemented).
3. In the chatbot UI, click the **TTS settings** (User dropdown → TTS section), select **Engine: XTTS**, then choose your custom voice file.

The first synthesis with a new voice will take longer (encoder passes). Subsequent calls are faster.

#### Testing XTTS

Run the test script:
```bash
py -3.11 test_xtts.py
```

Expected output:
```
[English] Synthesizing: 'Hello, this is a test of XTTS v2...'
  ✓ Generated 34211 chars base64
  ✓ Format: wav, Sample rate: 24000
  ✓ Engine: xtts
```

#### Switching Back to Piper

```bash
TTS_ENGINE=piper
```

Piper remains the default for its speed and stability.

### Step 6: Restart the Backend

```bash
py -3.11 -m uvicorn app.main:app --reload
```

### Step 7: Use the Language Selector

1. Open the chatbot UI
2. Click the **User dropdown** (👤 username) in the top-right
3. Select **Language: [current language]** → Choose your desired response language
4. Type a message in any language
5. The bot will reply in the selected language

### Step 8: Use Voice Input (Microphone)

1. Ensure your microphone is connected and browser has permission
2. In the chat input box, click the **🎤 Mic button** (green)
3. Speak your message (auto-detects language)
4. Click the **⏹️ Stop** button or wait 10 seconds
5. Your transcribed text appears in the input field
6. Press **Send** or hit Enter

**Tips:**
- Works with any language — say "नमस्ते" (Hindi), "Hola" (Spanish), "Hello" (English), etc.
- Transcription happens locally via Ollama Whisper (no cloud fees)
- If mic permission denied, allow microphone access in browser settings

## Supported Languages

The system includes pre-configured instructions for these languages:

| Code | Language | Code | Language | Code | Language |
|------|----------|------|----------|------|----------|
| en   | English  | es   | Español  | fr   | Français |
| de   | Deutsch | it   | Italiano | pt   | Português |
| ru   | Русский  | zh   | 中文      | ja   | 日本語    |
| ko   | 한국어   | ar   | العربية  | hi   | हिन्दी   |
| tr   | Türkçe  | nl   | Nederlands | pl  | Polski   |
| sv   | Svenska | da   | Dansk   | no   | Norsk   |
| fi   | Suomi   | el   | Ελληνικά| he   | עברית   |
| th   | ไทย     | vi   | Tiếng Việt| id  | Bahasa Indonesia |
| uk   | Українська| cs  | Čeština | hu   | Magyar  |
| ro   | Română  | sk   | Slovenčina| bg  | Български |
| hr   | Hrvatski| sr   | Српски  | lt   | Lietuvių |
| lv   | Latviešu| et   | Eesti   | sl   | Slovenščina |
| mk   | Македонски| sq | Shqip   | mt   | Malti   |
| ga   | Gaeilge | cy   | Cymraeg | is   | Íslenska |
| af   | Afrikaans| sw  | Kiswahili| zu  | IsiZulu |
| am   | አማርኛ  | fa   | فارسی   | ur   | اردو     |
| bn   | বাংলা   | pa   | ਪੰਜਾਬੀ  | gu   | ગુજરાતી |
| ta   | Tamil   | te   | Telugu  | kn   | Kannada |
| ml   | Malayalam| mr  | Marathi | or   | Odia    |
| si   | Sinhala | my   | Myanmar | km   | Khmer   |

*Language not in the list? Add it to `LANGUAGE_INSTRUCTIONS` in `qwen_service.py`.*

## How It Works

1. **User selects language** → stored in global Zustand store (`useLanguageStore`)
2. **User sends message** → `language` field added to request payload
3. **Backend receives request** at `POST /api/v1/chat/stream` → `ChatRequest.language` passed to `ChatService`
4. `ChatService.stream_message()` calls `call_qwen_ollama_stream()` (Ollama streaming API)
5. `qwen_service` retrieves language instruction: `"Respond in <language>."`
6. Messages built: system prompt + history + user message
7. HTTP POST to local Ollama API (`http://localhost:11434/api/chat?stream=true`)
8. **Streaming response**: tokens arrive as they're generated → forwarded to frontend via Server-Sent Events
9. User sees tokens appear in real-time
10. After streaming completes, full response saved to DB

## Model Recommendations

### LLM (Text Generation)

| Model | RAM Required | Multilingual Quality | Speed |
|-------|-------------|----------------------|-------|
| `qwen3:8b` | ~6GB | Good | Fast |
| `qwen3:14b` | ~12GB | Better | Medium |
| `llama3.1:8b` | ~6GB | Good | Fast |
| `llama3.3:70b` | ~140GB | Excellent | Slow |

**Qwen3 models are particularly strong at multilingual tasks** and are recommended for this use case.

### Whisper (Speech-to-Text)

| Model | Real-time Factor | RAM | Accuracy | Recommended For |
|-------|-----------------|-----|----------|-----------------|
| `whisper:tiny` | ~5-10x faster | ~1GB | Basic | Fast demo, low-resource |
| `whisper:base` | ~2-5x faster | ~2GB | Good | Balanced speed/accuracy |
| `whisper:small` | ~1-2x faster | ~2GB | Good+ | **Default, best balance** |
| `whisper:medium` | ~0.5-1x (realtime) | ~5GB | Better | High accuracy needs |
| `whisper:large-v3` | ~0.3-0.5x (slower) | ~10GB | Best | Production, best quality |

**Recommendation:** `whisper:small` — accurate enough for most languages, fast on modern CPUs.

All models are multilingual (trained on ~100 languages) and auto-detect language unless specified.

## Troubleshooting

### "Cannot connect to Ollama"

Make sure Ollama is running:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if not running
ollama serve
```

### "Model not found"

Pull the model first:
```bash
ollama pull qwen3:8b
```

Or check available models:
```bash
ollama list
```

### Model loads slowly or runs out of memory

- Use a smaller model (`qwen3:8b` or `llama3.1:8b`)
- Close other memory-intensive applications
- On macOS, Ollama uses Apple Silicon GPU acceleration automatically
- On Linux/Windows, ensure you have enough RAM + swap

### Language not switching

Verify the language code is correct (e.g., 'en', 'es', 'fr'). Check that `LANGUAGE_INSTRUCTIONS` contains your language.

### API timeout

Increase timeout in `.env`:
```bash
API_TIMEOUT=600  # 10 minutes
```

### Response too short / wants longer answers

Increase `OLLAMA_MAX_TOKENS` in `.env`:
```bash
OLLAMA_MAX_TOKENS=2048
```
Note: Higher token counts increase generation time.

### Whisper model not found

Pull the Whisper model:
```bash
ollama pull whisper:small
```

Check available models:
```bash
ollama list
```

### Microphone not working

- Ensure browser has microphone permission (click lock icon in address bar)
- Use HTTPS or localhost (required for microphone access)
- Try Chrome, Firefox, or Safari (not all browsers support MediaRecorder)
- On Windows, ensure default microphone is set in Sound Settings

### Voice transcription is slow

Whisper models vary in speed:
| Model | Approx. real-time factor | RAM |
|-------|------------------------|-----|
| `whisper:tiny`   | ~5-10x faster than realtime | ~1GB |
| `whisper:base`   | ~2-5x faster             | ~2GB |
| `whisper:small`  | ~1-2x faster (default)   | ~2GB |
| `whisper:medium` | ~0.5-1x (near-realtime)  | ~5GB |
| `whisper:large`  | ~0.3-0.5x (slower)      | ~10GB |

Use a smaller model for faster transcription:
```bash
OLLAMA_WHISPER_MODEL=whisper:base
```

### TTS issues (no audio output)

**If using Piper:**
- Ensure voice model files exist in `PIPER_VOICE_DIR`. Run `install_piper_voices.bat` to download the English model and optional others.
- Check backend logs for errors like "Piper voice model not found".
- See **PIPER_VOICE_INSTALL.md** for troubleshooting.

**If using XTTS:**
- Ensure `TTS` (coqui-ai/TTS) is installed: `pip install TTS`
- On first run, XTTS downloads ~2GB model weights to `~/.local/share/tts/`. Allow time for download.
- If you see CUDA/GPU errors but want CPU, ensure `XTTS_USE_GPU=false` in `.env`.
- Check logs for "XTTS model loaded" message.
- For voice cloning, ensure speaker WAV file exists and is 3+ seconds of clear speech.

General:
- Verify frontend TTS toggle is enabled (button in chat input).
- Ensure backend is reachable and no 500 errors in console.

## Switching Models

To use a different model, change `OLLAMA_MODEL` in `.env`:

```bash
OLLAMA_MODEL=qwen3:14b
```

Then pull that model:
```bash
ollama pull qwen3:14b
```

Restart the backend for changes to take effect.

## Future Enhancements

- Per-session language memory
- Voice cloning UI (upload your own voice for XTTS) — *basic support added*
- Per-sentence TTS with emotional inflection variation
- Language-specific voice selection for Piper
- XTTS GPU acceleration auto-detection
- Real-time switching between Piper and XTTS without restart
- Offline voice sample management UI
