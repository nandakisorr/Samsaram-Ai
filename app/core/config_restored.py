import os, sys
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ROOT_ENV = PROJECT_ROOT / '.env'
if ROOT_ENV.exists():
    load_dotenv(dotenv_path=ROOT_ENV, override=True)
else:
    load_dotenv()

class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./chatbot.db")
    DB_ECHO = os.getenv("DB_ECHO", "false").lower() == "true"
    DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))
    DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    DB_POOL_PRE_PING = os.getenv("DB_POOL_PRE_PING", "true").lower() == "true"
    DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "300"))
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    ALLOWED_ORIGINS = [origin.strip() for origin in (os.getenv("ALLOWED_ORIGINS") or "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173").split(",") if origin.strip()]
    APP_NAME = os.getenv("APP_NAME", "Samsara AI")
    WEBSITE_URL = os.getenv("WEBSITE_URL", "https://samsara-ai.com")
    EMAIL_ENABLED = os.getenv("EMAIL_ENABLED", "true").lower() == "true"
    EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "console")
    EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
    EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"
    EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
    EMAIL_FROM = os.getenv("EMAIL_FROM", "noreply@example.com")
    EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "Chatbot")
    EMAIL_SUBJECT_PREFIX = os.getenv("EMAIL_SUBJECT_PREFIX", "[Chatbot] ")
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS = int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_HOURS", "24"))
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    EMAILHOOKS_API_KEY = os.getenv("EMAILHOOKS_API_KEY", "")
    EMAILHOOKS_API_SECRET = os.getenv("EMAILHOOKS_API_SECRET", "")
    EMAILHOOKS_BASE_URL = os.getenv("EMAILHOOKS_BASE_URL", "https://api.emailhooks.io/v1")
    BIRTHDAY_EMAILS_ENABLED = os.getenv("BIRTHDAY_EMAILS_ENABLED", "true").lower() == "true"
    BIRTHDAY_CHECK_SCHEDULE = os.getenv("BIRTHDAY_CHECK_SCHEDULE", "daily")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_API_URL = os.getenv("OPENAI_API_URL", "https://api.openai.com/v1")
    STT_BACKEND = os.getenv("STT_BACKEND", "faster_whisper").lower()
    OPENAI_WHISPER_MODEL = os.getenv("OPENAI_WHISPER_MODEL", "whisper-1")
    FASTER_WHISPER_MODEL = os.getenv("FASTER_WHISPER_MODEL", "large-v3")
    FASTER_WHISPER_DEVICE = os.getenv("FASTER_WHISPER_DEVICE", "cpu")
    FASTER_WHISPER_COMPUTE = os.getenv("FASTER_WHISPER_COMPUTE", "int8")
    VOSK_MODEL_DIR = os.getenv("VOSK_MODEL_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "vosk_models"))
    VOSK_MODEL_NAME = os.getenv("VOSK_MODEL_NAME", "vosk-model-small-en-us-0.15")
    OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")
    OLLAMA_MAX_TOKENS = int(os.getenv("OLLAMA_MAX_TOKENS", "512"))
    OLLAMA_WHISPER_MODEL = os.getenv("OLLAMA_WHISPER_MODEL", "whisper:small")
    KILO_CODE_CMD = os.getenv("KILO_CODE_CMD", "killo")
    KILO_CODE_MODEL = os.getenv("KILO_CODE_MODEL", "killo/deepseek/deepseek-v4-flash:free")
    PIPER_VOICE_DIR = os.getenv("PIPER_VOICE_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "piper_voices"))
    PIPER_DEFAULT_VOICE = os.getenv("PIPER_DEFAULT_VOICE", "en_US-amy-medium")
    PIPER_EMOTION_MAP = {
        "neutral":   {"length_scale": 0.98, "volume": 1.0,  "noise_scale": 0.68, "sentence_pause": 0.45},
        "cheerful":  {"length_scale": 0.93, "volume": 1.05, "noise_scale": 0.75, "sentence_pause": 0.38},
    ...