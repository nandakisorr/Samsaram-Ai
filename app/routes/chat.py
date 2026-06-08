from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.db import get_db_session
from app.models.session import ChatSession, Message
from app.core.security import get_current_user_id
from app.core.config import settings
from app.core.exceptions import ChatException
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    NewSessionResponse,
    SessionDetailResponse,
    DeleteResponse,
    TtsRequest,
    TtsResponse,
)
from app.services.chat_service import ChatService
from app.services.tts_service import generate_speech as generate_tts
from app.services.qwen_service import check_ollama_health
from app.core.security import get_current_user
from typing import Dict, Any, List, AsyncGenerator
import logging
import json
import asyncio

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/session", response_model=NewSessionResponse)
async def create_session(
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Create a new chat session. Requires JWT.
    """
    try:
        chat_service = ChatService(db)
        session = await chat_service._create_new_session(user_id=current_user_id)
        return NewSessionResponse(
            session_id=session.id,
            started_at=session.created_at.isoformat() if session.created_at else datetime.utcnow().isoformat()
        )
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating session: {str(e)}"
        )


@router.get("/session/{session_id}/stream")
async def stream_session_history(
    session_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Stream a past session's messages one by one with delays (for replay effect).
    Requires JWT.
    """
    try:
        # Verify session belongs to user
        stmt = select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user_id
        )
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Fetch all messages ordered by timestamp
        stmt = select(Message).where(Message.session_id == session_id).order_by(Message.timestamp.asc())
        result = await db.execute(stmt)
        messages = result.scalars().all()

        async def message_stream() -> AsyncGenerator[str, None]:
            for msg in messages:
                msg_data = {
                    "role": msg.role,
                    "content": msg.content,
                    "time": msg.timestamp.isoformat() if msg.timestamp else None
                }
                yield f"data: {json.dumps(msg_data)}\n\n"
                await asyncio.sleep(0.4)  # replay pacing
            yield "data: [DONE]\n\n"

        return StreamingResponse(message_stream(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error streaming session: %r", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stream session: {str(e)}"
        )


@router.post("/")
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Send a message. Returns streaming text by default.
    If tts=true, returns JSON with text + audio base64.
    Requires JWT.
    """
    try:
        logger.info(f"Chat request: user={current_user_id}, provider={request.provider}, model={request.model}, tts_engine={request.tts_engine}, tts={request.tts}, lang={request.language}")
        chat_service = ChatService(db)
        result = await chat_service.process_message(
            user_id=current_user_id,
            message=request.message,
            session_id=request.session_id,
            language=request.language,
            provider=request.provider,
            model=request.model
        )

        if request.tts:
            # Generate TTS audio for the response
            tts_result = await generate_tts(
                text=result.response,
                emotion=request.emotion,
                voice=request.voice,
                speed=None,
                return_base64=True,
                language=request.language,
                speaker_wav=request.speaker_wav,
                tts_engine=request.tts_engine,
            )
            return {
                "text": result.response,
                "audio": tts_result["audio"],
                "format": tts_result["format"],
                "voice": tts_result.get("voice", request.voice or "default"),
                "emotion": tts_result.get("emotion", request.emotion),
                "speed": tts_result.get("speed", 1.0),
                "engine": tts_result.get("engine", settings.TTS_ENGINE),
                "language": tts_result.get("language", request.language),
            }
        else:
            # Return JSON with text response (no streaming)
            return {"text": result.response}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing chat: {str(e)}"
        )


@router.get("/history")
async def get_user_sessions(
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Get all chat sessions for the current user with full messages.
    Returns list of SessionSummary.
    """
    try:
        chat_service = ChatService(db)
        sessions = await chat_service.get_user_sessions_with_messages(user_id=current_user_id)
        return sessions
    except Exception as e:
        logger.error(f"Error getting sessions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving sessions: {str(e)}"
        )


@router.get("/history/{session_id}", response_model=SessionDetailResponse)
async def get_chat_history(
    session_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Retrieve chat history for a specific session
    """
    try:
        chat_service = ChatService(db)
        # Verify session belongs to user and get details
        history = await chat_service.get_session_history(
            user_id=current_user_id,
            session_id=session_id
        )
        # Fetch session metadata
        stmt = select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user_id
        )
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        return SessionDetailResponse(
            session_id=session.id,
            started_at=session.created_at.isoformat() if session.created_at else datetime.utcnow().isoformat(),
            messages=[
                {
                    "role": msg["role"],
                    "content": msg["content"],
                    "time": msg["timestamp"]
                }
                for msg in history
            ]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting history: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving history: {str(e)}"
        )


@router.delete("/history/{session_id}", response_model=DeleteResponse)
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Delete a session and all its messages. Requires JWT.
    """
    try:
        chat_service = ChatService(db)
        deleted = await chat_service.delete_session_by_id(
            user_id=current_user_id,
            session_id=session_id
        )
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found."
            )
        return DeleteResponse(detail=f"Session {session_id} deleted.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting session: {str(e)}"
        )


@router.post("/tts", response_model=TtsResponse)
async def text_to_speech(
    request: TtsRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Convert arbitrary text to speech with emotion support.
    Requires JWT.
    """
    try:
        logger.info(f"TTS request: user={current_user_id}, text={request.text[:50]!r}, emotion={request.emotion}")
        result = await generate_tts(
            text=request.text,
            emotion=request.emotion,
            voice=request.voice,
            speed=request.speed,
            return_base64=True,
            language=request.language or "en",
            speaker_wav=request.speaker_wav,
            tts_engine=request.tts_engine,
        )
        logger.info(f"TTS success: format={result['format']}, size={len(result['audio'])}")
        return TtsResponse(
            audio=result["audio"],
            format=result["format"],
            voice=result.get("voice", request.voice or "default"),
            emotion=result.get("emotion", request.emotion),
            speed=result.get("speed", request.speed or 1.0),
            language=result.get("language", request.language or "en"),
            engine=result.get("engine", settings.TTS_ENGINE),
        )
    except Exception as e:
        logger.error(f"TTS generation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"TTS generation failed: {str(e)}"
        )


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Stream chat response as plain text chunks (no JSON wrapper).
    For real-time UI updates. TTS is not supported on this endpoint.
    Requires JWT.
    """
    try:
        chat_service = ChatService(db)

        async def generate():
            try:
                logger.info("Starting stream: user=%s, msg=%s, lang=%s, provider=%s, model=%s", current_user_id, request.message[:30], request.language, request.provider, request.model)
                async for chunk in chat_service.stream_message(
                    user_id=current_user_id,
                    message=request.message,
                    session_id=request.session_id,
                    language=request.language,
                    provider=request.provider,
                    model=request.model
                ):
                    logger.debug("Streaming chunk: %r", chunk)
                    yield chunk
            except ChatException as e:
                logger.error("Streaming error in generate(): %r", e, exc_info=True)
                yield f"\n\n[ERROR: {str(e)}]"

        return StreamingResponse(generate(), media_type="text/plain")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in stream chat: %r", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing stream: {str(e)}"
        )


@router.post("/stream_with_tts")
async def chat_stream_with_tts(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Stream chat response with sentence-level TTS.
    Returns Server-Sent Events with type: text, audio, done.
    Requires JWT.
    """
    try:
        chat_service = ChatService(db)

        async def event_generator():
            try:
                async for event in chat_service.stream_message_with_tts(
                    user_id=current_user_id,
                    message=request.message,
                    session_id=request.session_id,
                    language=request.language,
                    tts_engine=request.tts_engine,
                    voice=request.voice,
                    speaker_wav=request.speaker_wav,
                    emotion=request.emotion,
                    provider=request.provider,
                    model=request.model,
                ):
                    yield f"event: message\ndata: {json.dumps(event)}\n\n"
            except ChatException as e:
                logger.error(f"Streaming TTS error: {str(e)}")
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in stream_with_tts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing stream with TTS: {str(e)}"
        )


@router.get("/diagnostics/ollama")
async def diagnose_ollama(
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Check Ollama connectivity and model availability.
    Requires JWT.
    """
    try:
        health = await check_ollama_health()
        return health
    except Exception as e:
        logger.error(f"Ollama diagnostics error: {str(e)}")


@router.get("/diagnostics/kilo_models")
async def diagnose_kilo_models(free_only: bool = False):
    """
    List available Kilo models by invoking the local Kilo CLI.
    Returns JSON { models: ["kilo/..."] }.
    If free_only is true, only models containing 'free' are returned.
    Requires JWT.
    """
    try:
        from app.services.llm_service import _resolve_cli_cmd
        import subprocess, re
        cmd = getattr(__import__('app').core.config.settings, 'KILO_CODE_CMD', 'kilo')
        cmd_args = _resolve_cli_cmd(cmd)
        # Run simple 'kilo models' and parse output
        result = subprocess.run(cmd_args + ['models'], capture_output=True, text=True, timeout=60)
        stdout = (result.stdout or '')
        # remove ANSI sequences
        stdout_clean = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", stdout)
        tokens = re.findall(r"(kilo/[^\s,;]+)", stdout_clean, flags=re.IGNORECASE)
        # Deduplicate preserving order
        seen = set()
        models = []
        for t in tokens:
            tl = t.strip()
            if tl.lower() in seen:
                continue
            seen.add(tl.lower())
            models.append(tl)
        # Only include kilo-auto models and free models
        filtered = [m for m in models if m.startswith('kilo/kilo-auto/') or 'free' in m.lower()]
        free_models = [m for m in filtered if 'free' in m.lower()]
        if free_only:
            return {"models": free_models, "free_models": free_models}
        return {"models": filtered, "free_models": free_models}
    except Exception as e:
        logger.error(f"Kilo diagnostics error: {str(e)}")
        return {"models": [], "free_models": [], "error": str(e)}

