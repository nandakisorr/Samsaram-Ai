import hashlib
import os
import json
import logging
from typing import Optional, List, Dict, Any, AsyncGenerator
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.exceptions import ChatException
from app.core.config import settings

logger = logging.getLogger(__name__)

# Simple in-memory cache for non-streaming LLM responses (first-turn only)
_llm_cache: Dict[str, str] = {}
_LLM_CACHE_MAX = 100

# Language mapping for Ollama prompts
LANGUAGE_INSTRUCTIONS = {
    "en": "Respond in English.",
    "es": "Responde en español.",
    "fr": "Réponds en français.",
    "de": "Antwort auf Deutsch.",
    "it": "Rispondi in italiano.",
    "pt": "Responda em português.",
    "ru": "Отвечай на русском.",
    "zh": "用中文回答。",
    "ja": "日本語で答えてください。",
    "ko": "한국어로 답변하세요.",
    "ar": "أجب باللغة العربية.",
    "hi": "हिंदी में उत्तर दें।",
    "tr": "Türkçe cevap verin.",
    "nl": "Antwoord in het Nederlands.",
    "pl": "Odpowiedz po polsku.",
    "sv": "Svara på svenska.",
    "da": "Svar på dansk.",
    "no": "Svar på norsk.",
    "fi": "Vastaa suomeksi.",
    "el": "Απαντήστε στα ελληνικά.",
    "he": "ענה בעברית.",
    "th": "ตอบเป็นภาษาไทย",
    "vi": "Trả lời bằng tiếng Việt.",
    "id": "Berbalas dalam bahasa Indonesia.",
    "uk": "Відповідайте українською мовою.",
    "cs": "Odpovídejte v češtině.",
    "hu": "Válaszoljon magyarul.",
    "ro": "Răspundeți în română.",
    "sk": "Odpovedajte v slovenčine.",
    "bg": "Отговаряйте на български.",
    "hr": "Odgovarajte na hrvatskom.",
    "sr": "Одговорите на српском.",
    "lt": "Atsakykite lietuvių kalba.",
    "lv": "Atbildiet latviešu valodā.",
    "et": "Vastake eesti keeles.",
    "sl": "Odprevajte v slovenščini.",
    "mk": "Одговорете на македонски.",
    "sq": "Përgjigju në shqip.",
    "mt": "Ittikkja bil-Malti.",
    "ga": "Freagraigh i nGaeilge.",
    "cy": "Atebwch yn Gymraeg.",
    "is": "Svaraðu á íslensku.",
    "af": "Antwoord in Afrikaans.",
    "sw": "Jibu kwa Kiswahili.",
    "zu": "Phendula ngisiZulu.",
    "am": "አማርኛ መልስ ይስጡ።",
    "fa": "به فارسی پاسخ دهید.",
    "ur": "اردو میں جواب دیں۔",
    "bn": "বাংলায় উত্তর দিন।",
    "pa": "ਪੰਜਾਬੀ ਵਿੱਚ ਜਵਾਬ ਦਿਓ।",
    "gu": "ગુજરાતીમાં જવાબ આપો.",
    "ta": "தமிழில் பதிலளிக்கவும்.",
    "te": "తెలుగులో సమాధానం ఇవ్వండి.",
    "kn": "ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸಿ.",
    "ml": "മലയാളത്തിൽ മറുപടി നൽകുക.",
    "mr": "मराठीत उत्तर द्या.",
    "or": "ଓଡ଼ିଆରେ ଉତ୍ତର ଦିଅ।",
    "si": "සිංහලෙන් පිළිතුරු ලබාදෙන්න.",
    "my": "မြန်မာဘာသာဖြင့် လက္ခဏာပြုပါ။",
}

DEFAULT_LANGUAGE = "en"


def get_language_instruction(language_code: str) -> str:
    """Get the language instruction prompt for a given language code."""
    return LANGUAGE_INSTRUCTIONS.get(language_code.lower(), LANGUAGE_INSTRUCTIONS[DEFAULT_LANGUAGE])


async def call_qwen_ollama_stream(message: str, history: List[Dict[str, Any]], language: str = DEFAULT_LANGUAGE) -> AsyncGenerator[str, None]:
    """
    Stream response from Ollama local API with conversation history and language instruction.

    Yields:
        str: Token/word chunks as they arrive

    Raises:
        ChatException: If API call fails
    """
    model = getattr(settings, 'OLLAMA_MODEL', 'qwen3:8b')
    ollama_url = getattr(settings, 'OLLAMA_URL', 'http://localhost:11434')

    messages = []
    lang_instruction = get_language_instruction(language)
    system_prompt = f"You are a helpful AI assistant. {lang_instruction}"
    messages.append({"role": "system", "content": system_prompt})

    for msg in history:
        role = msg.get("role", "user")
        api_role = "assistant" if role == "assistant" else "user"
        messages.append({"role": api_role, "content": msg.get("content", "")})

    messages.append({"role": "user", "content": message})

    # Get max tokens setting
    max_tokens = getattr(settings, 'OLLAMA_MAX_TOKENS', 1024)

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "num_predict": max_tokens,
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=settings.API_TIMEOUT) as client:
            async with client.stream(
                "POST",
                f"{ollama_url}/api/chat",
                headers={"Content-Type": "application/json"},
                json=payload
            ) as response:
                if response.status_code != 200:
                    error_detail = await response.aread()
                    raise ChatException(f"Ollama API error: {response.status_code} - {error_detail.decode()}")

                # Read streaming NDJSON response
                chunk_count = 0
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        if data.get("done"):
                            # Check for any final content in the done message
                            if "message" in data:
                                final_content = data["message"].get("content", "")
                                if final_content:
                                    chunk_count += 1
                                    logger.debug("Ollama stream done — final chunk #%d: %r", chunk_count, final_content)
                                    yield final_content
                                break
                            break
                        # Extract content chunk
                        content = data.get("message", {}).get("content", "")
                        if content:
                            chunk_count += 1
                            logger.debug("Ollama stream chunk #%d: %r", chunk_count, content)
                            yield content
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse Ollama stream line: {line[:100]}")
                        continue
                logger.info(f"Ollama streaming complete — total chunks: {chunk_count}")
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        logger.error(f"Ollama streaming connection error: {str(e)}")
        raise ChatException(
            f"Cannot connect to Ollama at {settings.OLLAMA_URL}.\n"
            f"Ensure Ollama is running and model '{model}' is pulled."
        ) from e
    except Exception as e:
        logger.error(f"Ollama streaming error: {str(e)}")
        raise ChatException(f"Failed to stream from Ollama: {str(e)}")


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((httpx.ConnectError, httpx.TimeoutException)),
    reraise=True
)
async def call_qwen_ollama(message: str, history: List[Dict[str, Any]], language: str = DEFAULT_LANGUAGE) -> str:
    """
    Non-streaming call to Ollama (for TTS and history saving).

    Args:
        message: Current user message
        history: Conversation history
        language: Target language code

    Returns:
        Complete response text
    """
    model = getattr(settings, 'OLLAMA_MODEL', 'qwen3:8b')
    ollama_url = getattr(settings, 'OLLAMA_URL', 'http://localhost:11434')
    max_tokens = getattr(settings, 'OLLAMA_MAX_TOKENS', 1024)

    messages = []
    lang_instruction = get_language_instruction(language)
    system_prompt = f"You are a helpful AI assistant. {lang_instruction}"
    messages.append({"role": "system", "content": system_prompt})

    for msg in history:
        role = msg.get("role", "user")
        api_role = "assistant" if role == "assistant" else "user"
        messages.append({"role": api_role, "content": msg.get("content", "")})

    messages.append({"role": "user", "content": message})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "num_predict": max_tokens,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=settings.API_TIMEOUT) as client:
            response = await client.post(
                f"{ollama_url}/api/chat",
                headers={"Content-Type": "application/json"},
                json=payload
            )
    except (httpx.ConnectError, httpx.TimeoutException):
        # Re-raise to let tenacity handle retry
        raise
    except Exception as e:
        # Other request errors (invalid URL, etc.)
        raise ChatException(f"Failed to send request to Ollama: {e}")

    if response.status_code != 200:
        error_detail = response.text
        logger.error(f"Ollama API error {response.status_code}: {error_detail}")
        raise ChatException(f"Ollama API error: {response.status_code} - {error_detail}")

    try:
        result = response.json()
    except Exception as e:
        raise ChatException(f"Invalid JSON response from Ollama: {e}")

    response_text = result.get("message", {}).get("content", "")
    if not response_text:
        raise ChatException("Empty response from Ollama")

    logger.info(f"Ollama call successful, response length: {len(response_text)}")
    return response_text


async def check_ollama_health() -> Dict[str, Any]:
    """
    Check if Ollama is running and model is available.
    Returns status dict with connectivity info.
    """
    ollama_url = getattr(settings, 'OLLAMA_URL', 'http://localhost:11434')
    model = getattr(settings, 'OLLAMA_MODEL', 'qwen3:8b')

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            # Check server health
            response = await client.get(f"{ollama_url}/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = [m["name"] for m in data.get("models", [])]
                return {
                    "status": "ok",
                    "ollama_running": True,
                    "available_models": models,
                    "model_available": model in models,
                    "model": model,
                    "url": ollama_url,
                }
            else:
                return {
                    "status": "error",
                    "ollama_running": False,
                    "error": f"HTTP {response.status_code}",
                }
    except Exception as e:
        return {
            "status": "error",
            "ollama_running": False,
            "error": str(e),
        }


async def call_qwen_with_history(message: str, history: list, language: str = DEFAULT_LANGUAGE) -> str:
    """
    Call Qwen3 via Ollama local API with full conversation history and language instruction.
    Caches responses for first-turn queries (no history) to speed up repeats.
    """
    if not history:
        history = []
    
    # Cache only for first-turn (no history) to keep it simple and safe
    global _llm_cache
    cache_key = None
    if len(history) == 0:
        # Include language in key to avoid cross-language collisions
        key_input = f"{message}|{language}"
        cache_key = hashlib.md5(key_input.encode()).hexdigest()
        if cache_key in _llm_cache:
            logger.debug(f"LLM cache hit: {message[:50]!r}")
            return _llm_cache[cache_key]
    
    # Call Ollama API
    response = await call_qwen_ollama(message, history, language)
    
    # Store in cache if applicable
    if cache_key is not None:
        if len(_llm_cache) >= _LLM_CACHE_MAX:
            _llm_cache.pop(next(iter(_llm_cache)))  # simple LRU eviction
        _llm_cache[cache_key] = response
        logger.debug(f"LLM cache store: {message[:50]!r}")
    
    return response
