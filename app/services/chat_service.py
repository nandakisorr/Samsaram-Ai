from datetime import datetime
from typing import Optional, List, Dict, Any, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete as sql_delete
from app.models.session import ChatSession, Message
from app.schemas.chat import ChatRequest, ChatResponse
from app.core.exceptions import ChatException
from app.services.llm_service import get_llm_provider
from app.services.llm_service import _sanitize
from app.services.tts_service import generate_speech
from app.core.config import settings
import re
import logging
import asyncio

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def process_message(
        self,
        user_id: str,
        message: str,
        session_id: Optional[int] = None,
        language: str = "en",
        provider: str = "ollama",
        model: Optional[str] = None
    ):
        """
        Process a chat message and return a response (non-streaming, for TTS or simple calls)
        """
        try:
            if session_id:
                session = await self._get_or_create_session(user_id, session_id)
            else:
                session = await self._create_new_session(user_id)

            stmt = select(Message).where(Message.session_id == session.id).order_by(Message.timestamp.asc())
            result = await self.db.execute(stmt)
            history = result.scalars().all()

            user_message = Message(id=None, session_id=session.id, role="user", content=message, timestamp=datetime.utcnow())
            self.db.add(user_message)

            history_list = [{"role": msg.role, "content": msg.content} for msg in history]

            # Get LLM provider and generate response
            llm_provider = get_llm_provider(provider=provider, model=model)
            response_content: str = await llm_provider.chat(message=message, history=history_list, language=language)
            response_content = _sanitize(response_content)

            assistant_message = Message(id=None, session_id=session.id, role="assistant", content=response_content, timestamp=datetime.utcnow())
            self.db.add(assistant_message)
            await self.db.commit()

            return ChatResponse(response=response_content, session_id=session.id, timestamp=datetime.utcnow().isoformat())

        except Exception as e:
            await self.db.rollback()
            logger.error("Error processing message: %r", e, exc_info=True)
            raise ChatException(f"Failed to process message: {repr(e)}") from e

    async def stream_message(
        self,
        user_id: str,
        message: str,
        session_id: Optional[int] = None,
        language: str = "en",
        provider: str = "ollama",
        model: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream a chat response token by token (for real-time UI updates).
        Saves user message immediately, accumulates assistant response, saves after completion.
        Supports cancellation via client disconnect or explicit stop.
        """
        try:
            # Get or create session
            if session_id:
                session = await self._get_or_create_session(user_id, session_id)
            else:
                session = await self._create_new_session(user_id)

            # Fetch history
            stmt = select(Message).where(Message.session_id == session.id).order_by(Message.timestamp.asc())
            result = await self.db.execute(stmt)
            history = result.scalars().all()

            # Save user message immediately
            user_message = Message(id=None, session_id=session.id, role="user", content=message, timestamp=datetime.utcnow())
            self.db.add(user_message)
            await self.db.commit()  # Commit user message so it's in DB before streaming

            # Prepare history for LLM
            history_list = [{"role": msg.role, "content": msg.content} for msg in history]

            # Get LLM provider and stream response
            llm_provider = get_llm_provider(provider=provider, model=model)
            full_response = []
            try:
                async for chunk in llm_provider.stream_chat(message, history_list, language):
                    full_response.append(chunk)
                    logger.debug("Streaming token: %r", chunk)
                    yield _sanitize(chunk)
                    # Allow cancellation check every chunk
                    await asyncio.sleep(0)
            except asyncio.CancelledError:
                logger.info("Streaming cancelled by client — discarding partial response")
                await self.db.rollback()  # Do NOT save partial assistant response
                raise

            # Save complete assistant response
            response_content = _sanitize("".join(full_response))
            assistant_message = Message(id=None, session_id=session.id, role="assistant", content=response_content, timestamp=datetime.utcnow())
            self.db.add(assistant_message)
            await self.db.commit()

        except Exception as e:
            await self.db.rollback()
            logger.error("Error streaming message: %r", e, exc_info=True)
            raise ChatException(f"Failed to stream message: {repr(e)}") from e
    async def stream_message_with_tts(
        self,
        user_id: str,
        message: str,
        session_id: Optional[int] = None,
        language: str = "en",
        tts_engine: Optional[str] = None,
        voice: Optional[str] = None,
        speaker_wav: Optional[str] = None,
        emotion: str = "neutral",
        provider: str = "ollama",
        model: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream chat response with sentence-level TTS.
        Yields event dicts: {"type":"text","sentenceIndex":int,"content":str} or
        {"type":"audio","sentenceIndex":int,"audio":str,...} or {"type":"done",...}
        """
        # Session handling
        if session_id:
            session = await self._get_or_create_session(user_id, session_id)
        else:
            session = await self._create_new_session(user_id)

        # Fetch history
        stmt = select(Message).where(Message.session_id == session.id).order_by(Message.timestamp.asc())
        result = await self.db.execute(stmt)
        history = result.scalars().all()

        # Save user message
        user_message = Message(id=None, session_id=session.id, role="user", content=message, timestamp=datetime.utcnow())
        self.db.add(user_message)
        await self.db.commit()

        history_list = [{"role": msg.role, "content": msg.content} for msg in history]

        full_response_chars = []
        buffer = ""
        sentence_index = 0
        next_audio_idx = 0
        pending_audio: Dict[int, Dict[str, Any]] = {}
        tts_tasks: Dict[int, asyncio.Task] = {}

        sentence_pattern = re.compile(r'[^.!?]*[.!?]+')

        def start_tts(idx: int, text: str):
            task = asyncio.create_task(
                generate_speech(
                    text=text,
                    emotion=emotion,
                    voice=voice,
                    speaker_wav=speaker_wav,
                    speed=None,
                    return_base64=True,
                    language=language,
                    tts_engine=tts_engine,
                )
            )
            tts_tasks[idx] = task
            def callback(fut: asyncio.Future):
                try:
                    pending_audio[idx] = fut.result()
                except Exception as e:
                    logger.error(f"TTS failed for sentence {idx}: {e}")
                    pending_audio[idx] = None
            task.add_done_callback(callback)

        # Get LLM provider
        llm_provider = get_llm_provider(provider=provider, model=model)

        try:
            async for chunk in llm_provider.stream_chat(message, history_list, language):
                # Strip controls early so sentence splitter sees clean text
                chunk = _sanitize(chunk)
                full_response_chars.append(chunk)
                buffer += chunk

                # Extract complete sentences from buffer
                while True:
                    m = sentence_pattern.match(buffer)
                    if not m:
                        break
                    sentence = m.group().strip()
                    if sentence and re.search(r'\w', sentence):
                        sentence = _sanitize(sentence)
                        if sentence:
                            yield {"type": "text", "sentenceIndex": sentence_index, "content": sentence}
                            start_tts(sentence_index, sentence)
                            sentence_index += 1
                    buffer = buffer[m.end():].lstrip()

                # Emit any pending audio ready in order
                while next_audio_idx in pending_audio:
                    audio_data = pending_audio.pop(next_audio_idx)
                    if audio_data is not None:
                        yield {
                            "type": "audio",
                            "sentenceIndex": next_audio_idx,
                            "audio": audio_data["audio"],
                            "format": audio_data.get("format", "wav"),
                            "voice": audio_data.get("voice", voice or "default"),
                            "emotion": audio_data.get("emotion", emotion),
                            "language": language,
                            "speed": audio_data.get("speed", 1.0)
                        }
                    next_audio_idx += 1

            # Flush final buffer as last sentence
            if buffer.strip():
                final_sentence = _sanitize(buffer.strip())
                if final_sentence:
                    yield {"type": "text", "sentenceIndex": sentence_index, "content": final_sentence}
                    start_tts(sentence_index, final_sentence)
                    sentence_index += 1

            # Commit assistant message
            response_content = _sanitize("".join(full_response_chars))
            assistant_message = Message(id=None, session_id=session.id, role="assistant", content=response_content, timestamp=datetime.utcnow())
            self.db.add(assistant_message)
            await self.db.commit()

            # Emit remaining audio in order
            for idx in range(next_audio_idx, sentence_index):
                if idx in pending_audio:
                    audio_data = pending_audio.pop(idx)
                else:
                    task = tts_tasks.get(idx)
                    if task:
                        audio_data = await task
                    else:
                        continue
                if audio_data is not None:
                    yield {
                        "type": "audio",
                        "sentenceIndex": idx,
                        "audio": audio_data["audio"],
                        "format": audio_data.get("format", "wav"),
                        "voice": audio_data.get("voice", voice or "default"),
                        "emotion": audio_data.get("emotion", emotion),
                        "language": language,
                        "speed": audio_data.get("speed", 1.0)
                    }

            yield {"type": "done", "session_id": session.id, "timestamp": datetime.utcnow().isoformat()}

        except asyncio.CancelledError:
            logger.info("Streaming with TTS cancelled by client")
            for task in tts_tasks.values():
                if not task.done():
                    task.cancel()
            await self.db.rollback()
            raise
        except Exception as e:
            logger.error(f"Error in stream_message_with_tts: {e}", exc_info=True)
            for task in tts_tasks.values():
                if not task.done():
                    task.cancel()
            await self.db.rollback()
            raise ChatException(f"Streaming with TTS failed: {e}") from e


    async def _get_or_create_session(self, user_id: str, session_id: int):
        """
        Get existing session or create a new one (without committing)
        """
        stmt = select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user_id
        )
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()

        if not session:
            session = ChatSession(
                id=session_id,
                user_id=user_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            self.db.add(session)
            # Flush to obtain ID and enforce constraints but do NOT commit yet
            await self.db.flush()
            await self.db.refresh(session)

        return session

    async def _create_new_session(self, user_id: str):
        """
        Create a new chat session (DB assigns auto-increment ID) without committing.
        Caller must commit after adding at least one message.
        """
        session = ChatSession(
            user_id=user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        self.db.add(session)
        # Flush to obtain generated ID; commit will happen later after messages are added
        await self.db.flush()
        await self.db.refresh(session)
        return session

    async def get_session_history(self, user_id: str, session_id: int) -> List[Dict[str, Any]]:
        """
        Get chat history for a specific session
        """
        try:
            stmt = select(Message).join(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id
            ).order_by(Message.timestamp.asc())

            result = await self.db.execute(stmt)
            messages = result.scalars().all()

            return [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat() if msg.timestamp else None
                }
                for msg in messages
            ]
        except Exception as e:
            logger.error(f"Error getting session history: {str(e)}")
            raise ChatException(f"Failed to retrieve session history: {str(e)}") from e

    async def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all sessions for a user (summary only, no messages)
        """
        try:
            stmt = select(ChatSession).where(ChatSession.user_id == user_id).order_by(
                ChatSession.updated_at.desc()
            )

            result = await self.db.execute(stmt)
            sessions = result.scalars().all()

            return [
                {
                    "id": session.id,
                    "created_at": session.created_at.isoformat() if session.created_at else None,
                    "updated_at": session.updated_at.isoformat() if session.updated_at else None,
                    "message_count": await self._get_session_message_count(session.id)
                }
                for session in sessions
            ]
        except Exception as e:
            logger.error(f"Error getting user sessions: {str(e)}")
            raise ChatException(f"Failed to retrieve user sessions: {str(e)}") from e

    async def get_user_sessions_with_messages(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all sessions for a user with full messages (for history list)
        """
        try:
            # Get sessions
            sessions_stmt = select(ChatSession).where(ChatSession.user_id == user_id).order_by(ChatSession.updated_at.desc())
            sessions_result = await self.db.execute(sessions_stmt)
            sessions = sessions_result.scalars().all()

            result = []
            for session in sessions:
                # Get messages for this session
                messages_stmt = select(Message).where(Message.session_id == session.id).order_by(Message.timestamp.asc())
                messages_result = await self.db.execute(messages_stmt)
                messages = messages_result.scalars().all()

                message_list = [
                    {
                        "role": msg.role,
                        "content": msg.content,
                        "time": msg.timestamp.isoformat() if msg.timestamp else None,
                    }
                    for msg in messages
                ]

                result.append({
                    "session_id": session.id,
                    "started_at": session.created_at.isoformat() if session.created_at else None,
                    "message_count": len(messages),
                    "messages": message_list
                })

            return result
        except Exception as e:
            logger.error(f"Error getting user sessions with messages: {str(e)}")
            raise ChatException(f"Failed to retrieve user sessions: {str(e)}") from e

    async def delete_session_by_id(self, user_id: str, session_id: int) -> bool:
        """
        Delete a session and all its messages. Returns True if deleted.
        """
        try:
            # Verify session belongs to user
            stmt = select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id
            )
            result = await self.db.execute(stmt)
            session = result.scalar_one_or_none()

            if not session:
                return False

            # Delete messages first
            await self.db.execute(sql_delete(Message).where(Message.session_id == session_id))
            # Delete session
            await self.db.delete(session)
            await self.db.commit()
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting session: {str(e)}")
            raise ChatException(f"Failed to delete session: {str(e)}") from e

    async def _get_session_message_count(self, session_id: int) -> int:
        """
        Get the count of messages in a session
        """
        stmt = select(Message).where(Message.session_id == session_id)
        result = await self.db.execute(stmt)
        messages = result.scalars().all()
        return len(messages)
