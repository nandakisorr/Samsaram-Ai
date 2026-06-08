"""
Custom exceptions for the chatbot application with proper HTTP status codes.
"""

from typing import Any, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class ChatbotException(Exception):
    """Base exception for all chatbot errors."""
    
    def __init__(
        self, 
        message: str, 
        error_code: str = "CHATBOT_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        logger.error(f"{error_code}: {message}", extra={"details": details})

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for JSON response."""
        return {
            "error": self.error_code,
            "message": self.message,
            "details": self.details
        }


class ChatException(ChatbotException):
    """Exception for chat-related errors."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "CHAT_ERROR", details)


class APIException(ChatbotException):
    """Exception for API-related errors with HTTP status codes."""
    
    def __init__(
        self, 
        message: str, 
        status_code: int = 500, 
        error_code: str = "API_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, error_code, details)
        self.status_code = status_code
        self.error_code = error_code

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary with status code."""
        base_dict = super().to_dict()
        base_dict["status_code"] = self.status_code
        return base_dict


class BadRequestException(APIException):
    """Exception for bad request errors (400)."""
    
    def __init__(self, message: str, error_code: str = "BAD_REQUEST"):
        super().__init__(message, 400, error_code)


class UnauthorizedException(APIException):
    """Exception for unauthorized access errors (401)."""
    
    def __init__(self, message: str, error_code: str = "UNAUTHORIZED"):
        super().__init__(message, 401, error_code)


class ForbiddenException(APIException):
    """Exception for forbidden access errors (403)."""
    
    def __init__(self, message: str, error_code: str = "FORBIDDEN"):
        super().__init__(message, 403, error_code)


class NotFoundException(APIException):
    """Exception for resource not found errors (404)."""
    
    def __init__(self, message: str, error_code: str = "NOT_FOUND"):
        super().__init__(message, 404, error_code)


class MethodNotAllowedException(APIException):
    """Exception for method not allowed errors (405)."""
    
    def __init__(self, message: str, error_code: str = "METHOD_NOT_ALLOWED"):
        super().__init__(message, 405, error_code)


class ConflictException(APIException):
    """Exception for conflict errors (409)."""
    
    def __init__(self, message: str, error_code: str = "CONFLICT"):
        super().__init__(message, 409, error_code)


class GoneException(APIException):
    """Exception for gone resource errors (410)."""
    
    def __init__(self, message: str, error_code: str = "GONE"):
        super().__init__(message, 410, error_code)


class PayloadTooLargeException(APIException):
    """Exception for payload too large errors (413)."""
    
    def __init__(self, message: str, error_code: str = "PAYLOAD_TOO_LARGE"):
        super().__init__(message, 413, error_code)


class UnsupportedMediaTypeException(APIException):
    """Exception for unsupported media type errors (415)."""
    
    def __init__(self, message: str, error_code: str = "UNSUPPORTED_MEDIA_TYPE"):
        super().__init__(message, 415, error_code)


class UnprocessableEntityException(APIException):
    """Exception for unprocessable entity errors (422)."""
    
    def __init__(self, message: str, error_code: str = "UNPROCESSABLE_ENTITY"):
        super().__init__(message, 422, error_code)


class TooManyRequestsException(APIException):
    """Exception for rate limiting errors (429)."""
    
    def __init__(self, message: str, retry_after: Optional[int] = None, error_code: str = "TOO_MANY_REQUESTS"):
        super().__init__(message, 429, error_code)
        self.retry_after = retry_after

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary with retry_after."""
        base_dict = super().to_dict()
        if self.retry_after is not None:
            base_dict["retry_after"] = self.retry_after
        return base_dict


class InternalServerErrorException(APIException):
    """Exception for internal server errors (500)."""
    
    def __init__(self, message: str, error_code: str = "INTERNAL_SERVER_ERROR"):
        super().__init__(message, 500, error_code)


class NotImplementedException(APIException):
    """Exception for not implemented features (501)."""
    
    def __init__(self, message: str, error_code: str = "NOT_IMPLEMENTED"):
        super().__init__(message, 501, error_code)


class BadGatewayException(APIException):
    """Exception for bad gateway errors (502)."""
    
    def __init__(self, message: str, error_code: str = "BAD_GATEWAY"):
        super().__init__(message, 502, error_code)


class ServiceUnavailableException(APIException):
    """Exception for service unavailable errors (503)."""
    
    def __init__(self, message: str, error_code: str = "SERVICE_UNAVAILABLE"):
        super().__init__(message, 503, error_code)


class GatewayTimeoutException(APIException):
    """Exception for gateway timeout errors (504)."""
    
    def __init__(self, message: str, error_code: str = "GATEWAY_TIMEOUT"):
        super().__init__(message, 504, error_code)


class OpenAIException(BadGatewayException):
    """Exception for OpenAI API errors."""
    
    def __init__(self, message: str, error_code: str = "OPENAI_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code)
        if details:
            self.details.update(details)


class DatabaseException(InternalServerErrorException):
    """Exception for database-related errors."""
    
    def __init__(self, message: str, error_code: str = "DATABASE_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code)
        if details:
            self.details.update(details)


class AuthenticationException(UnauthorizedException):
    """Exception for authentication errors."""
    
    def __init__(self, message: str, error_code: str = "AUTHENTICATION_ERROR"):
        super().__init__(message, error_code)


class AuthorizationException(ForbiddenException):
    """Exception for authorization errors."""
    
    def __init__(self, message: str, error_code: str = "AUTHORIZATION_ERROR"):
        super().__init__(message, error_code)


class ValidationException(UnprocessableEntityException):
    """Exception for validation errors."""
    
    def __init__(self, message: str, error_code: str = "VALIDATION_ERROR", field_errors: Optional[Dict[str, str]] = None):
        super().__init__(message, error_code)
        if field_errors:
            self.details["field_errors"] = field_errors


class RateLimitException(TooManyRequestsException):
    """Exception for rate limiting errors."""
    
    def __init__(self, message: str, retry_after: Optional[int] = None, error_code: str = "RATE_LIMIT_ERROR"):
        super().__init__(message, retry_after, error_code)


class TTSException(BadGatewayException):
    """Exception for TTS service errors."""
    
    def __init__(self, message: str, error_code: str = "TTS_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code)
        if details:
            self.details.update(details)


class NetworkException(ServiceUnavailableException):
    """Exception for network connectivity errors."""
    
    def __init__(self, message: str, error_code: str = "NETWORK_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code)
        if details:
            self.details.update(details)


class SessionException(ChatbotException):
    """Exception for session-related errors."""
    
    def __init__(self, message: str, error_code: str = "SESSION_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code, details)


class ChatHistoryException(ChatbotException):
    """Exception for chat history related errors."""
    
    def __init__(self, message: str, error_code: str = "CHAT_HISTORY_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code, details)


class SecurityException(ForbiddenException):
    """Exception for security-related errors."""
    
    def __init__(self, message: str, error_code: str = "SECURITY_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code)
        if details:
            self.details.update(details)


class ConfigurationException(InternalServerErrorException):
    """Exception for configuration-related errors."""
    
    def __init__(self, message: str, error_code: str = "CONFIGURATION_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, error_code)
        if details:
            self.details.update(details)