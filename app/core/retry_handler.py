"""
Retry mechanism for API calls.
"""

import time
import functools
from typing import Any, Callable, Optional
import logging

from app.core.config import settings
from app.core.exceptions import NetworkException, APIException

logger = logging.getLogger(__name__)

...

def retry_with_backoff(
    max_retries: int = settings.MAX_RETRIES,
    base_delay: float = settings.RETRY_DELAY,
    max_delay: float = 60.0,
    exceptions: tuple = (Exception,)
):
    """
    Decorator for retrying function calls with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Base delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        exceptions: Tuple of exceptions to retry on
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        delay = min(base_delay * (2 ** attempt), max_delay)
                        logger.warning(
                            f"Attempt {attempt + 1}/{max_retries} failed for {func.__name__}: {str(e)}. "
                            f"Retrying in {delay:.2f}s..."
                        )
                        time.sleep(delay)
                    else:
                        logger.error(
                            f"All {max_retries} attempts failed for {func.__name__}: {str(e)}"
                        )
                        break
            
            raise last_exception
        
        return wrapper
    return decorator


def circuit_breaker(
    failure_threshold: int = 5,
    recovery_timeout: int = 60,
    exceptions: tuple = (Exception,)
):
    """
    Decorator for implementing circuit breaker pattern.
    
    Args:
        failure_threshold: Number of failures before opening circuit
        recovery_timeout: Time to wait before attempting recovery
        exceptions: Tuple of exceptions that count as failures
    """
    def decorator(func: Callable) -> Callable:
        circuit_state = {"failures": 0, "last_failure": 0, "open": False}
        
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            current_time = time.time()
            
            # Check if circuit is open and if recovery timeout has passed
            if circuit_state["open"]:
                if current_time - circuit_state["last_failure"] > recovery_timeout:
                    logger.info(f"Circuit breaker attempting recovery for {func.__name__}")
                    circuit_state["open"] = False
                    circuit_state["failures"] = 0
                else:
                    raise NetworkException(f"Circuit breaker open for {func.__name__}")
            
            try:
                result = func(*args, **kwargs)
                # Reset on success
                circuit_state["failures"] = 0
                return result
            except exceptions as e:
                circuit_state["failures"] += 1
                circuit_state["last_failure"] = current_time
                
                if circuit_state["failures"] >= failure_threshold:
                    circuit_state["open"] = True
                    logger.error(
                        f"Circuit breaker opened for {func.__name__} after "
                        f"{circuit_state['failures']} failures"
                    )
                
                raise e
        
        return wrapper
    return decorator


class RetryHandler:
    """
    Handler for retry logic with configurable parameters.
    """
    
    def __init__(
        self,
        max_retries: int = settings.MAX_RETRIES,
        base_delay: float = settings.RETRY_DELAY,
        max_delay: float = 60.0
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
    
    def execute_with_retry(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute a function with retry logic.
        
        Args:
            func: Function to execute
            *args: Arguments to pass to the function
            **kwargs: Keyword arguments to pass to the function
            
        Returns:
            Result of the function call
            
        Raises:
            The last exception encountered after all retries
        """
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                if attempt < self.max_retries:
                    delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                    logger.warning(
                        f"Retry {attempt + 1}/{self.max_retries} for {func.__name__}: {str(e)}. "
                        f"Waiting {delay:.2f}s..."
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        f"All {self.max_retries} retries exhausted for {func.__name__}: {str(e)}"
                    )
                    break
        
        raise last_exception