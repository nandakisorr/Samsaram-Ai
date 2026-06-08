# Custom Exception Classes Documentation

## Overview

The chatbot application implements a comprehensive exception hierarchy with proper HTTP status codes. All exceptions inherit from a base `ChatbotException` class and follow REST API best practices for error responses.

## Exception Hierarchy

```
ChatbotException (base)
├── APIException (with HTTP status codes)
│   ├── BadRequestException (400)
│   ├── UnauthorizedException (401)
│   ├── ForbiddenException (403)
│   ├── NotFoundException (404)
│   ├── MethodNotAllowedException (405)
│   ├── ConflictException (409)
│   ├── GoneException (410)
│   ├── PayloadTooLargeException (413)
│   ├── UnsupportedMediaTypeException (415)
│   ├── UnprocessableEntityException (422)
│   ├── TooManyRequestsException (429)
│   └── Server Error Exceptions
│       ├── InternalServerErrorException (500)
│       ├── NotImplementedException (501)
│       ├── BadGatewayException (502)
│       ├── ServiceUnavailableException (503)
│       └── GatewayTimeoutException (504)
└── Application-Specific Exceptions
    ├── OpenAIException (502)
    ├── DatabaseException (500)
    ├── AuthenticationException (401)
    ├── AuthorizationException (403)
    ├── ValidationException (422)
    ├── RateLimitException (429)
    ├── TTSException (502)
    ├── NetworkException (503)
    ├── SessionException
    ├── ChatHistoryException
    ├── SecurityException (403)
    └── ConfigurationException (500)
```

## HTTP Status Code Mapping

| Status Code | Exception Class | Description |
|-------------|----------------|-------------|
| 400 | BadRequestException | Client sent invalid request |
| 401 | UnauthorizedException | Authentication required |
| 403 | ForbiddenException | Access denied |
| 404 | NotFoundException | Resource not found |
| 405 | MethodNotAllowedException | HTTP method not allowed |
| 409 | ConflictException | Resource conflict |
| 410 | GoneException | Resource permanently removed |
| 413 | PayloadTooLargeException | Request body too large |
| 415 | UnsupportedMediaTypeException | Unsupported media type |
| 422 | UnprocessableEntityException | Semantic errors in request |
| 429 | TooManyRequestsException | Rate limit exceeded |
| 500 | InternalServerErrorException | General server error |
| 501 | NotImplementedException | Feature not implemented |
| 502 | BadGatewayException | Invalid response from upstream |
| 503 | ServiceUnavailableException | Service temporarily unavailable |
| 504 | GatewayTimeoutException | Upstream timeout |

## Usage Examples

### Basic Exception Usage

```python
from app.core.exceptions import ValidationException, NotFoundException

# Raise validation error
if not user_input:
    raise ValidationException("User input is required")

# Raise not found error
if not user_exists(user_id):
    raise NotFoundException(f"User {user_id} not found")
```

### Exception with Details

```python
from app.core.exceptions import DatabaseException

try:
    result = await database_query(query)
except DatabaseError as e:
    raise DatabaseException(
        "Database query failed",
        details={
            "query": str(query),
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
    )
```

### Rate Limit Exception with Retry-After

```python
from app.core.exceptions import RateLimitException

if user_is_rate_limited(user_id):
    raise RateLimitException(
        "Rate limit exceeded",
        retry_after=60  # seconds
    )
```

### Validation Exception with Field Errors

```python
from app.core.exceptions import ValidationException

field_errors = {
    "email": "Invalid email format",
    "password": "Password must be at least 8 characters"
}

raise ValidationException(
    "Validation failed",
    field_errors=field_errors
)
```

## Error Response Format

All API exceptions return JSON responses in the following format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable error message",
  "status_code": 400,
  "details": {
    "additional": "information"
  }
}
```

For rate limit exceptions:
```json
{
  "error": "TOO_MANY_REQUESTS",
  "message": "Rate limit exceeded",
  "status_code": 429,
  "retry_after": 60,
  "details": {}
}
```

## Exception Handler Registration

The main application automatically registers exception handlers that convert exceptions to proper HTTP responses:

```python
@app.exception_handler(NotFoundException)
async def handle_not_found(request: Request, exc: NotFoundException):
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )
```

## Best Practices

1. **Use specific exceptions**: Choose the most specific exception class that matches your error condition
2. **Include meaningful messages**: Provide clear, actionable error messages
3. **Add relevant details**: Include contextual information in the `details` field
4. **Follow HTTP semantics**: Use appropriate status codes for the error type
5. **Log appropriately**: The base exception class automatically logs errors
6. **Don't expose sensitive data**: Never include sensitive information in error responses

## Testing

All exceptions include comprehensive test coverage in `app/core/test_exceptions.py`. Run tests with:

```bash
python -m pytest app/core/test_exceptions.py -v
```