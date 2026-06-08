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
    KILO_CODE_CMD = os.getenv("KILO_CODE_CMD", "kilo")
    # Default runtime model — prefer kilo-auto free by default
    KILO_CODE_MODEL = os.getenv("KILO_CODE_MODEL", "kilo/kilo-auto/free")
    # Comma-separated preferred free models (order = preference). Only models in this allowlist
    # will be selected by the automatic Kilo model updater. Restrict to kilo-auto variants + free models.
    KILO_FREE_MODEL_ALLOWLIST = [m.strip() for m in (os.getenv("KILO_FREE_MODEL_ALLOWLIST", "kilo/kilo-auto/balanced,kilo/kilo-auto/free,kilo/kilo-auto/frontier,kilo/kilo-auto/small,kilo/baidu/cobuddy:free,kilo/deepseek/deepseek-v4-flash:free,kilo/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free,kilo/nvidia/nemotron-3-super-120b-a12b:free,kilo/openrouter/free,kilo/poolside/laguna-m.1:free,kilo/poolside/laguna-xs.2:free,kilo/x-ai/grok-code-fast-1:optimized:free").split(",")) if m.strip()]
    PIPER_VOICE_DIR = os.getenv("PIPER_VOICE_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "piper_voices"))
    PIPER_DEFAULT_VOICE = os.getenv("PIPER_DEFAULT_VOICE", "en_US-amy-medium")
    PIPER_EMOTION_MAP = {
        "neutral":   {"length_scale": 0.98, "volume": 1.0,  "noise_scale": 0.68, "sentence_pause": 0.45},
        "cheerful":  {"length_scale": 0.93, "volume": 1.05, "noise_scale": 0.75, "sentence_pause": 0.38},
        "sad":       {"length_scale": 1.08, "volume": 0.94, "noise_scale": 0.58, "sentence_pause": 0.55},
        "angry":     {"length_scale": 0.88, "volume": 1.03, "noise_scale": 0.82, "sentence_pause": 0.32},
        "excited":   {"length_scale": 0.91, "volume": 1.08, "noise_scale": 0.78, "sentence_pause": 0.40},
        "calm":      {"length_scale": 1.04, "volume": 0.96, "noise_scale": 0.60, "sentence_pause": 0.52},
    }
    TTS_ENABLED = os.getenv("TTS_ENABLED", "true").lower() == "true"
    TTS_TIMEOUT = int(os.getenv("TTS_TIMEOUT", "30"))
    TTS_MAX_LENGTH = int(os.getenv("TTS_MAX_LENGTH", "5000"))
    TTS_ENGINE = os.getenv("TTS_ENGINE", "piper").lower()
    XTTS_VOICE_DIR = os.getenv("XTTS_VOICE_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "xtts_voices"))
    XTTS_DEFAULT_LANGUAGE = os.getenv("XTTS_DEFAULT_LANGUAGE", "en")
    XTTS_CLONE_ENABLE = os.getenv("XTTS_CLONE_ENABLE", "false").lower() == "true"
    XTTS_USE_GPU = os.getenv("XTTS_USE_GPU", "false").lower() == "true"
    XTTS_DEFAULT_SPEAKER = os.getenv("XTTS_DEFAULT_SPEAKER", "Claribel Dervla")
    XTTS_MAX_CONCURRENT = int(os.getenv("XTTS_MAX_CONCURRENT", "2"))
    XTTS_CHUNK_SIZE = int(os.getenv("XTTS_CHUNK_SIZE", "300"))
    MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
    RETRY_DELAY = int(os.getenv("RETRY_DELAY", "2"))
    API_TIMEOUT = int(os.getenv("API_TIMEOUT", "300"))

settings = Settings()
