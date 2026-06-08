"""
Example usage of custom exception classes in the chatbot application.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from typing import Dict, Any
import logging

from app.core.exceptions import (
    # HTTP Status Code Exceptions
    BadRequestException,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    UnprocessableEntityException,
    TooManyRequestsException,
    InternalServerErrorException,
    ServiceUnavailableException,
    
    # Specific Application Exceptions
    OpenAIException,
    DatabaseException,
    AuthenticationException,
    ValidationException,
    RateLimitException,
    TTSException,
    NetworkException,
    SessionException
)

logger = logging.getLogger(__name__)

app = FastAPI()


@app.exception_handler(BadRequestException)
async def handle_bad_request(request: Request, exc: BadRequestException):
    """Handle bad request exceptions."""
    logger.warning(f"Bad request: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )


@app.exception_handler(UnauthorizedException)
async def handle_unauthorized(request: Request, exc: UnauthorizedException):
    """Handle unauthorized exceptions."""
    logger.warning(f"Unauthorized access attempt: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )


@app.exception_handler(ForbiddenException)
async def handle_forbidden(request: Request, exc: ForbiddenException):
    """Handle forbidden exceptions."""
    logger.warning(f"Forbidden access: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )


@app.exception_handler(NotFoundException)
async def handle_not_found(request: Request, exc: NotFoundException):
    """Handle not found exceptions."""
    logger.info(f"Resource not found: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )


@app.exception_handler(UnprocessableEntityException)
async def handle_validation_error(request: Request, exc: ValidationException):
    """Handle validation exceptions."""
    logger.warning(f"Validation error: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )


@app.exception_handler(TooManyRequestsException)
async def handle_rate_limit(request: Request, exc: TooManyRequestsException):
    """Handle rate limit exceptions."""
    logger.warning(f"Rate limit exceeded: {exc.message}")
    response_content = exc.to_dict()
    headers = {}
    if hasattr(exc, 'retry_after') and exc.retry_after:
        headers['Retry-After'] = str(exc.retry_after)
        response_content['retry_after'] = exc.retry_after
    
    return JSONResponse(
        status_code=exc.status_code,
        content=response_content,
        headers=headers
    )


@app.exception_handler(InternalServerErrorException)
async def handle_internal_error(request: Request, exc: InternalServerErrorException):
    """Handle internal server error exceptions."""
    logger.error(f"Internal server error: {exc.message}", exc_info=True)
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )


@app.exception_handler(ServiceUnavailableException)
async def handle_service_unavailable(request: Request, exc: ServiceUnavailableException):
    """Handle service unavailable exceptions."""
    logger.error(f"Service unavailable: {exc.message}", exc_info=True)
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )


# Example route handlers demonstrating exception usage
@app.post("/chat/completions")
async def create_completion(request_data: Dict[str, Any]):
    """Example chat completion endpoint."""
    try:
        # Validate input
        if not request_data.get("messages"):
            raise ValidationException("Messages are required", field_errors={
                "messages": "At least one message is required"
            })
        
        # Check rate limit
        user_id = request_data.get("user_id")
        if user_id and is_rate_limited(user_id):
            raise RateLimitException(
                f"Rate limit exceeded for user {user_id}",
                retry_after=60
            )
        
        # Simulate OpenAI API call
        try:
            response = await call_openai_api(request_data)
        except Exception as e:
            raise OpenAIException(
                f"Failed to get response from OpenAI: {str(e)}",
                details={"original_error": str(e)}
            )
        
        return response
        
    except ValidationException:
        raise  # Re-raise to be handled by exception handler
    except OpenAIException:
        raise  # Re-raise to be handled by exception handler
    except Exception as e:
        raise InternalServerErrorException(
            f"Unexpected error in chat completion: {str(e)}",
            details={"endpoint": "/chat/completions", "error_type": type(e).__name__}
        )


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Example session retrieval endpoint."""
    try:
        # Validate session ID format
        if not session_id or len(session_id) < 10:
            raise ValidationException("Invalid session ID format")
        
        # Check if user has access to this session
        if not has_session_access(session_id):
            raise ForbiddenException("You don't have access to this session")
        
        # Try to retrieve session
        session = await get_session_from_db(session_id)
        if not session:
            raise NotFoundException(f"Session {session_id} not found")
        
        return session
        
    except ValidationException:
        raise
    except ForbiddenException:
        raise
    except NotFoundException:
        raise
    except Exception as e:
        raise DatabaseException(
            f"Database error retrieving session: {str(e)}",
            details={"session_id": session_id, "operation": "retrieve"}
        )


@app.post("/tts/generate")
async def generate_speech(text: str, emotion: str = "neutral"):
    """Example TTS generation endpoint."""
    try:
        # Validate input
        if not text or len(text.strip()) == 0:
            raise ValidationException("Text is required for TTS generation")
        
        if not is_valid_emotion(emotion):
            raise ValidationException(
                f"Invalid emotion: {emotion}",
                field_errors={"emotion": "Must be one of: neutral, happy, sad, angry, excited"}
            )
        
        # Generate speech
        audio_url = await call_tts_service(text, emotion)
        return {"audio_url": audio_url}
        
    except ValidationException:
        raise
    except TTSException:
        raise
    except NetworkException:
        raise
    except Exception as e:
        raise InternalServerErrorException(
            f"Unexpected error in TTS generation: {str(e)}",
            details={"text_length": len(text), "emotion": emotion}
        )


# Mock functions for demonstration
def is_rate_limited(user_id: str) -> bool:
    """Mock function to check if user is rate limited."""
    return False


async def call_openai_api(data: Dict[str, Any]) -> Dict[str, Any]:
    """Mock function to simulate OpenAI API call."""
    return {"choices": [{"message": {"content": "Hello, world!"}}]}


def has_session_access(session_id: str) -> bool:
    """Mock function to check session access."""
    return True


async def get_session_from_db(session_id: str) -> Dict[str, Any]:
    """Mock function to get session from database."""
    return {"id": session_id, "title": "Sample Session"}


def is_valid_emotion(emotion: str) -> bool:
    """Mock function to validate emotion."""
    valid_emotions = ["neutral", "happy", "sad", "angry", "excited"]
    return emotion.lower() in valid_emotions


async def call_tts_service(text: str, emotion: str) -> str:
    """Mock function to call TTS service."""
    return f"https://example.com/audio/{hash(text)}_{emotion}.mp3"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)