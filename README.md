# Chatbot V2 — AI Assistant with Emotional Neural TTS

A full-stack intelligent conversational assistant called **Samsaram AI** . Features real-time LLM streaming, neural text-to-speech with emotional modulation, multi-backend speech recognition, and a modern glassmorphism UI.

---

## ✨ Features

- 🗣️ **Neural TTS** — Piper TTS with 6 emotional states: neutral, cheerful, sad, angry, excited, calm
- 🎙️ **Multi-backend STT** — Faster-Whisper, Ollama Whisper, Vosk, IndicParler with auto-fallback
- 🧠 **Multi-LLM Support** — Ollama (Qwen3:8b) + Kilo Code CLI (Deepseek, StepFun) via provider abstraction
- 🌍 **30+ Languages** — Instruction-based multilingual chat responses
- 🔐 **JWT Authentication** — Secure login, registration, forgot/reset password
- 📧 **Email Automation** — Welcome emails, password reset, birthday wishes via EmailHooks API
- ⚡ **Real-time Streaming** — Token-by-token SSE rendering with streaming TTS audio playback
- 🎨 **Glassmorphism UI** — Dark mode, WCAG-compliant colours, responsive design

---

##  Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.11, FastAPI, Uvicorn, Pydantic, JWT, bcrypt |
| **Frontend** | React 18, TypeScript, TailwindCSS, Vite, Zustand |
| **Database** | MongoDB |
| **LLM** | Ollama (Qwen3:8b), Kilo Code CLI |
| **TTS** | Piper Neural TTS, XTTS/Coqui |
| **STT** | Faster-Whisper (large-v3), Vosk, IndicParler |
| **Email** | EmailHooks API |

---

##  Getting Started

### Prerequisites
- Python 3.11
- Node.js 18+
- MongoDB
- Ollama (with Qwen3:8b pulled)
- Piper TTS + voice model (`en_US-lessac-medium.onnx`)

### Backend
```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
py -3.11 -m uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

The app will be running at `http://localhost:5173`

---

## 📁 Project Structure


chatbot-v2/
├── main.py                  # FastAPI app entry point
├── services/
│   ├── auth/                # JWT auth, user management
│   ├── chat/                # LLM provider abstraction
│   ├── tts/                 # Piper TTS, emotion engine
│   ├── stt/                 # Whisper, Vosk, IndicParler
│   └── email/               # EmailHooks integration
├── models/                  # MongoDB schemas
├── frontend/
│   ├── src/
│   │   ├── modules/         # auth, chat, tts, history
│   │   ├── components/      # shared UI components
│   │   └── store/           # Zustand global state
└── docs/                    # CODER.md, IFLOW.md, etc.


##  Documentation

- [`CODER.md`](docs/CODER.md) — Developer guide & architecture notes
- [`IFLOW.md`](docs/IFLOW.md) — Data flow diagrams
- [`EMAIL_SYSTEM.md`](docs/EMAIL_SYSTEM.md) — Email automation setup
- [`MULTILINGUAL_SETUP.md`](docs/MULTILINGUAL_SETUP.md) — Language configuration
- [`FRONTEND_README.md`](docs/FRONTEND_README.md) — Frontend module breakdown



## extra

> *"I wasn't really someone who got excited about building software before this. but now i tryed to build one."*

