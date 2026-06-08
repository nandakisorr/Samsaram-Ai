from pydantic import BaseModel

from typing import Optional, List





class ChatRequest(BaseModel):

    session_id: Optional[int] = None

    message: str
    tts: bool = False

    emotion: str = "neutral"

    language: str = "en"

    tts_engine: Optional[str] = None  # 'piper' or 'xtts'

    voice: Optional[str] = None

    speaker_wav: Optional[str] = None  # path to custom voice sample file

    provider: str = "ollama"  # "ollama" (local HTTP API) or "kilo_code" (Kilo CLI)

    model: Optional[str] = None



    model_config = {

        "json_schema_extra": {

            "example": {

                "session_id": 1,

                "message": "What is machine learning?",

                "tts": True,

                "emotion": "calm",

                "language": "en",

                "tts_engine": "piper",

                "voice": "nova",

                "provider": "ollama",

                "model": "qwen3:8b"

            }

        }

    }





class ChatResponse(BaseModel):

    """Response for a chat message."""

    response: str

    session_id: int

    timestamp: str



    model_config = {"json_schema_extra": {"example": {"response": "Hello!", "session_id": 1, "timestamp": "2024-01-01T00:00:00"}}}





class ChatResponseWithTTS(BaseModel):

    """Response when TTS is requested."""

    text: str

    audio: str

    format: str = "mp3"

    voice: str

    emotion: str

    speed: float

    language: str

    engine: str





class TtsRequest(BaseModel):

    text: str

    emotion: str = "neutral"

    voice: Optional[str] = None

    speed: Optional[float] = None

    language: Optional[str] = "en"

    tts_engine: Optional[str] = None

    speaker_wav: Optional[str] = None



    model_config = {

        "json_schema_extra": {

            "example": {

                "text": "Hello! I'm happy to help you.",

                "emotion": "cheerful",

                "language": "en",

                "tts_engine": "piper"

            }

        }

    }





class TtsResponse(BaseModel):

    audio: str

    format: str = "mp3"

    voice: str

    emotion: str

    speed: float

    language: str

    engine: str





class MessageSchema(BaseModel):

    role: str

    content: str

    time: str





class NewSessionResponse(BaseModel):

    session_id: int

    started_at: str





class SessionSummary(BaseModel):

    session_id: int

    started_at: str

    message_count: int

    messages: List[MessageSchema]





class SessionDetailResponse(BaseModel):

    session_id: int

    started_at: str

    messages: List[MessageSchema]





class DeleteResponse(BaseModel):

    detail: str

