# KiloChat CLI

Command-line interface for chatting with your local AI assistant. Supports multiple LLM providers (Ollama, Kilo CLI) and multiple TTS/STT backends, all fully offline.

## Features

- **Text chat**: Simple text-based conversations
- **Voice input**: Speech-to-text using Faster-Whisper (offline, free)
- **Voice output**: Text-to-speech using XTTS or Piper
- **Streaming**: Real-time response streaming
- **Multi-language**: Support for 100+ languages
- **Zero API costs**: All processing is local. No external API keys required.

## Prerequisites

### 1. Ollama (for `ollama` provider)
Install and start Ollama, then pull a model:

```bash
# Install from https://ollama.ai/download
ollama pull qwen3:8b        # Default (~6GB)
ollama pull llama3.1:8b    # Alternative
```

### 2. Kilo CLI (for `kilo_code` provider)
The `kilo_code` provider calls the external `kilo` CLI binary, which must be installed separately.

```bash
# Install Kilo CLI (example):
# - Download from official source or use package manager
# - Ensure `kilo` is in your PATH

# Verify installation:
kilo models
# Should print a list of available models

# Pull/select a free model (via kilo if needed):
# The CLI handles model management itself.
```

### 3. Python dependencies
```bash
py -3.11 -m pip install sounddevice numpy  # for voice input (optional)
```

### 4. Environment configuration
Copy `.env.example` to `.env` and adjust settings as needed:

**Ollama provider settings:**
```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
```

**Kilo CLI provider settings:**
```env
KILO_CODE_CMD=kilo                    # Path to kilo binary (if not in PATH, use full path)
KILO_CODE_MODEL=kilo/deepseek/deepseek-v4-flash:free  # Default free model for kilo_code
```

**STT/TTS settings** (example):
```env
STT_BACKEND=faster_whisper
TTS_ENGINE=piper
```

## Usage

### Interactive Chat
```bash
py -3.11 kilochat_cli.py
```

### Single Message
```bash
py -3.11 kilochat_cli.py "What is the capital of France?"
```

### Voice Conversation (STT + TTS)
```bash
py -3.11 kilochat_cli.py --voice --speak
```

### Specify Language
```bash
py -3.11 kilochat_cli.py --language es "Hola, como estas?"
```

### Select LLM Provider
```bash
# Use Ollama (default)
py -3.11 kilochat_cli.py --provider ollama "Hello"

# Use Kilo CLI
py -3.11 kilochat_cli.py --provider kilo_code "Hello"
```

### Choose Model
```bash
# For Ollama
py -3.11 kilochat_cli.py --provider ollama --model qwen3:14b "Hello"

# For Kilo CLI (free models only — pick any that ends with :free from `kilo models`)
py -3.11 kilochat_cli.py --provider kilo_code --model kilo/deepseek/deepseek-v4-flash:free "Hello"
```

## Architecture

The CLI uses your existing chatbot services directly:

1. **STT Service** — Converts speech to text (Faster-Whisper / Vosk / Ollama Whisper)
2. **LLM Service** — Routes `ollama` directly via HTTP or `kilo_code` via subprocess to the Kilo CLI
3. **TTS Service** — Converts text to speech (XTTS / Piper)

No web server required — direct service calls.

## Troubleshooting

### Ollama connection failed
Ensure Ollama is running:
```bash
ollama serve
```
Test:
```bash
curl http://localhost:11434/api/tags
```

### Kilo CLI not found
Make sure `kilo` is installed and in your PATH, or set `KILLO_CMD` in `.env` to its full path.

### Unicode errors on Windows
Console limitations; the CLI replaces unsupported characters with `?`.
