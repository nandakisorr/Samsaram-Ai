import logging
import sys
from app.core.config import settings


def setup_logging():
    """Configure application logging"""
    # Set up root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(formatter)
    
    # Add handler to root logger
    root_logger.addHandler(console_handler)
    
    # Set specific loggers to appropriate levels
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)  # Reduce SQLAlchemy noise
    logging.getLogger("urllib3").setLevel(logging.WARNING)     # Reduce urllib3 noise
    logging.getLogger("openai").setLevel(logging.INFO)         # OpenAI API logging


def get_logger(name: str) -> logging.Logger:
    """Get a named logger"""
    return logging.getLogger(name)