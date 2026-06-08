#!/usr/bin/env python3.11
"""
KiloChat CLI - Interactive chat with your local AI assistant.
Uses only local services: Faster-Whisper (STT) + Ollama (LLM) + XTTS/Piper (TTS).
No external API calls required.

Usage:
  python kilochat_cli.py                          # Interactive chat mode
  python kilochat_cli.py "Hello!"                 # Single message
  python kilochat_cli.py --voice                  # Voice input mode (STT)
  python kilochat_cli.py --speak                 # Text-to-speech output
  python kilochat_cli.py --voice --speak          # Full voice conversation
  python kilochat_cli.py --list-voices           # List available TTS voices
  python kilochat_cli.py --help                  # Show all options

Features:
  • Text or voice input (speech-to-text)
  • Streaming LLM responses from local Ollama
  • Optional voice output (text-to-speech)
  • Persistent chat history in memory
  • Multi-language support
  • Markdown rendering in terminal
"""

import argparse
import asyncio
import sys
import os
from pathlib import Path
from typing import Optional, List, Dict, Any
import json

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.llm_service import get_llm_provider
from app.core.config import settings
from app.core.exceptions import ChatException

# Try to import optional dependencies
try:
    import sounddevice as sd
    import wave
    import numpy as np
    STT_AVAILABLE = True
except ImportError:
    STT_AVAILABLE = False

try:
    from app.services.tts_service import generate_speech
    TTS_AVAILABLE = True
except ImportError:
    TTS_AVAILABLE = False


class KiloChatCLI:
    """Interactive CLI chat for local AI assistant."""
    
    def __init__(
        self,
        provider: str = "ollama",
        model: Optional[str] = None,
        language: str = "en",
        tts_engine: Optional[str] = None,
        voice: Optional[str] = None,
        enable_tts: bool = False,
        enable_stt: bool = False
    ):
        self.provider = provider
        self.model = model or settings.OLLAMA_MODEL
        self.language = language
        self.tts_engine = tts_engine or settings.TTS_ENGINE
        self.voice = voice
        self.enable_tts = enable_tts and TTS_AVAILABLE
        self.enable_stt = enable_stt and STT_AVAILABLE
        self.history: List[Dict[str, str]] = []
        
        # Initialize LLM provider
        self.llm = get_llm_provider(provider=provider, model=self.model)
    
    def _safe_print(self, *args, **kwargs):
        """Print with Unicode error handling for Windows console."""
        try:
            print(*args, **kwargs)
        except UnicodeEncodeError:
            # Fallback: encode to ASCII with replacement
            encoded = []
            for arg in args:
                if isinstance(arg, str):
                    encoded.append(arg.encode('ascii', errors='replace').decode())
                else:
                    encoded.append(str(arg))
            print(*encoded, **kwargs)
    
    def _safe_input(self, prompt: str) -> str:
        """Input with safe prompt display."""
        try:
            return input(prompt)
        except UnicodeEncodeError:
            # Encode prompt safely
            safe_prompt = prompt.encode('ascii', errors='replace').decode()
            return input(safe_prompt)
    
    async def chat_once(self, message: str, stream: bool = True) -> str:
        """Send a single message and get response."""
        try:
            if stream:
                self._safe_print("\n<Bot> ", end="", flush=True)
                full_response = []
                async for chunk in self.llm.stream_chat(
                    message=message,
                    history=self.history,
                    language=self.language
                ):
                    try:
                        self._safe_print(chunk, end="", flush=True)
                    except UnicodeEncodeError:
                        self._safe_print("?", end="", flush=True)
                    full_response.append(chunk)
                self._safe_print()
                response = "".join(full_response)
            else:
                response = await self.llm.chat(
                    message=message,
                    history=self.history,
                    language=self.language
                )
                self._safe_print(f"\n<Bot> {response}")
            
            # Update history
            self.history.append({"role": "user", "content": message})
            self.history.append({"role": "assistant", "content": response})
            
            # Optionally speak response
            if self.enable_tts:
                await self._speak(response)
            
            return response
            
        except Exception as e:
            print(f"\n[Error] {e}")
            raise
    
    async def record_from_microphone(self, duration: int = 10) -> Optional[str]:
        """Record audio from microphone and transcribe."""
        if not STT_AVAILABLE:
            self._safe_print("[Error] sounddevice not installed. Run: pip install sounddevice numpy")
            return None
        
        self._safe_print(f"\n[Recording] Speak now... (max {duration}s, Ctrl+C to stop)")
        
        SAMPLE_RATE = 16000
        
        try:
            # Record
            recording = sd.rec(
                int(duration * SAMPLE_RATE),
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype='int16'
            )
            sd.wait()
            
            # Save to temp file
            temp_path = Path("_temp_cli_recording.wav")
            with wave.open(str(temp_path), 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(recording.tobytes())
            
            self._safe_print("[Transcribing] ...")
            
            # Use STT service
            from app.services.stt_service import transcribe_audio
            audio_bytes = temp_path.read_bytes()
            text = await transcribe_audio(audio_bytes, language=self.language)
            
            # Cleanup
            temp_path.unlink(missing_ok=True)
            
            return text.strip() if text else None
            
        except KeyboardInterrupt:
            self._safe_print("\n[Recording cancelled]")
            return None
        except Exception as e:
            self._safe_print(f"[Error] Recording failed: {e}")
            return None
    
    async def _speak(self, text: str):
        """Convert text to speech."""
        try:
            # Extract clean text (remove markdown, emojis)
            clean_text = self._clean_text_for_tts(text)
            if not clean_text:
                return
            
            audio_data = await generate_speech(
                text=clean_text,
                tts_engine=self.tts_engine,
                voice=self.voice,
                language=self.language,
                return_base64=False
            )
            
            # Play audio (platform-specific)
            if audio_data and "audio_path" in audio_data:
                self._play_audio(audio_data["audio_path"])
        except Exception as e:
            self._safe_print(f"[TTS Warning] {e}")
    
    def _clean_text_for_tts(self, text: str) -> str:
        """Remove markdown, emojis, and other non-spoken elements."""
        import re
        
        # Remove markdown formatting
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'`(.*?)`', r'\1', text)
        text = re.sub(r'#+\s*', '', text)
        
        # Remove URLs
        text = re.sub(r'https?://\S+', '', text)
        
        # Remove emojis and special unicode
        text = re.sub(r'[^\x00-\x7F]+', ' ', text)
        
        # Clean up whitespace
        text = ' '.join(text.split())
        
        return text.strip()
    
    def _play_audio(self, audio_path: str):
        """Play audio file using platform-specific player."""
        try:
            if sys.platform == "win32":
                import subprocess
                # Windows: use PowerShell to play
                subprocess.run([
                    "powershell", "-c",
                    f"(New-Object Media.SoundPlayer '{audio_path}').PlaySync();"
                ], check=True, capture_output=True)
            elif sys.platform == "darwin":
                os.system(f"afplay '{audio_path}'")
            else:
                os.system(f"aplay '{audio_path}'")
        except Exception as e:
            self._safe_print(f"[Audio playback] {e}")
    
    async def interactive_loop(self):
        """Main interactive chat loop."""
        try:
            print("\n" + "=" * 60)
            print("  KiloChat CLI - Local AI Assistant")
            print("=" * 60)
            print(f"  Provider : {self.provider}")
            print(f"  Model    : {self.model}")
            print(f"  Language : {self.language}")
            print(f"  STT      : {'Enabled' if self.enable_stt else 'Disabled'}")
            print(f"  TTS      : {'Enabled' if self.enable_tts else 'Disabled'}")
            print("=" * 60)
            print("\nCommands:")
            print("  /voice   - Switch to voice input mode")
            print("  /text    - Switch to text input mode")
            print("  /tts on  - Enable text-to-speech")
            print("  /tts off - Disable text-to-speech")
            print("  /clear   - Clear chat history")
            print("  /history - Show conversation history")
            print("  /quit    - Exit")
            print("\n" + "-" * 60)
        except UnicodeEncodeError:
            # Fallback for Windows encoding issues
            print("\nKiloChat CLI - Local AI Assistant")
            print(f"Provider: {self.provider}, Model: {self.model}")
        
        while True:
            try:
                # Get input
                if self.enable_stt:
                    user_input = self._safe_input("\n[Text/Voice] (Type '/' for commands, or just type) > ")
                    
                    if user_input.startswith('/'):
                        await self._handle_command(user_input)
                        continue
                    
                    # Confirm if they want to use voice
                    use_voice = self._safe_input("Use voice input? (y/N): ").lower().strip() == 'y'
                    if use_voice:
                        transcribed = await self.record_from_microphone()
                        if transcribed:
                            user_input = transcribed
                            self._safe_print(f"[You said] {user_input}")
                        else:
                            continue
                else:
                    user_input = self._safe_input("\n[You] > ").strip()
                    
                    if user_input.startswith('/'):
                        await self._handle_command(user_input)
                        continue
                
                if not user_input:
                    continue
                
                if user_input.lower() in ('/quit', '/exit', '/q'):
                    self._safe_print("\nGoodbye!")
                    break
                
                # Get response
                await self.chat_once(user_input, stream=True)
                
            except KeyboardInterrupt:
                self._safe_print("\n\nGoodbye!")
                break
            except Exception as e:
                self._safe_print(f"\n[Error] {e}")
    
    async def _handle_command(self, cmd: str):
        """Handle slash commands."""
        parts = cmd.lower().split()
        command = parts[0]
        
        if command == '/voice':
            self.enable_stt = True
            self._safe_print("[STT] Voice input enabled")
        elif command == '/text':
            self.enable_stt = False
            self._safe_print("[STT] Text input only")
        elif command == '/tts':
            if len(parts) > 1:
                if parts[1] == 'on':
                    self.enable_tts = True
                    self._safe_print("[TTS] Voice output enabled")
                elif parts[1] == 'off':
                    self.enable_tts = False
                    self._safe_print("[TTS] Voice output disabled")
            else:
                self._safe_print(f"[TTS] Currently: {'ON' if self.enable_tts else 'OFF'}")
        elif command == '/clear':
            self.history = []
            self._safe_print("[History] Cleared")
        elif command == '/history':
            self._safe_print("\n[Chat History]")
            self._safe_print("-" * 40)
            for msg in self.history:
                prefix = "You" if msg["role"] == "user" else "Bot"
                self._safe_print(f"{prefix}: {msg['content'][:100]}...")
        elif command in ('/quit', '/exit', '/q'):
            self._safe_print("\nGoodbye!")
            sys.exit(0)
        else:
            self._safe_print(f"[Unknown command] {command}")
    
    async def list_voices(self):
        """List available TTS voices."""
        if not TTS_AVAILABLE:
            self._safe_print("[Error] TTS service not available")
            return
        
        try:
            # Try to get voices from config/environment
            self._safe_print(f"\nTTS Engine: {self.tts_engine}")
            
            if self.tts_engine == "piper":
                voice_dir = settings.PIPER_VOICE_DIR if hasattr(settings, 'PIPER_VOICE_DIR') else "piper_voices"
                self._safe_print(f"Voice directory: {voice_dir}")
                self._safe_print("Piper voices are stored as .onnx files in the voice directory.")
                self._safe_print("Use voice name like: en_US-amy-medium")
            elif self.tts_engine == "xtts":
                voice_dir = settings.XTTS_VOICE_DIR if hasattr(settings, 'XTTS_VOICE_DIR') else "xtts_voices"
                self._safe_print(f"Voice directory: {voice_dir}")
                self._safe_print("XTTS uses speaker reference files (.wav) or built-in voices.")
                self._safe_print("Common built-in voices: p273, p234, p256, etc.")
                self._safe_print("Set XTTS_DEFAULT_SPEAKER in .env or use --tts-voice")
            else:
                self._safe_print("Unknown TTS engine")
        except Exception as e:
            self._safe_print(f"[Error] {e}")


async def main():
    parser = argparse.ArgumentParser(
        description="KiloChat CLI - Local AI chat with STT/TTS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                              # Interactive chat
  %(prog)s "Hello, how are you?"        # Single message
  %(prog)s --voice                      # Voice input mode
  %(prog)s --speak                      # Text-to-speech output
  %(prog)s --voice --speak              # Full voice conversation
  %(prog)s --list-voices                # Show available TTS voices
  %(prog)s --language es                # Chat in Spanish
        """
    )
    
    parser.add_argument(
        "message",
        nargs="?",
        help="Single message to send (non-interactive mode)"
    )
    parser.add_argument(
        "--provider", "-p",
        default="ollama",
        choices=["ollama", "kilo_code"],
        help="LLM provider: 'ollama' uses local Ollama API; 'kilo_code' uses the Kilo CLI tool"
    )
    parser.add_argument(
        "--model", "-m",
        default=None,
        help="Override model (default from .env)"
    )
    parser.add_argument(
        "--language", "-l",
        default="en",
        help="Language code (default: en)"
    )
    parser.add_argument(
        "--voice", "-v",
        action="store_true",
        help="Enable voice input (speech-to-text)"
    )
    parser.add_argument(
        "--speak", "-s",
        action="store_true",
        help="Enable voice output (text-to-speech)"
    )
    parser.add_argument(
        "--tts-engine",
        default=None,
        choices=["piper", "xtts"],
        help="TTS engine (default from .env)"
    )
    parser.add_argument(
        "--tts-voice",
        default=None,
        help="Specific TTS voice name"
    )
    parser.add_argument(
        "--list-voices",
        action="store_true",
        help="List available TTS voices"
    )
    parser.add_argument(
        "--no-stream",
        action="store_true",
        help="Disable streaming (wait for full response)"
    )
    
    args = parser.parse_args()
    
    # Check dependencies
    if args.voice and not STT_AVAILABLE:
        print("[Error] Voice input requires: pip install sounddevice numpy")
        sys.exit(1)
    
    if args.speak and not TTS_AVAILABLE:
        print("[Error] Voice output requires TTS service")
        sys.exit(1)
    
    # Handle list voices
    if args.list_voices:
        cli = KiloChatCLI(
            provider=args.provider,
            model=args.model,
            language=args.language,
            tts_engine=args.tts_engine,
            voice=args.tts_voice,
            enable_tts=args.speak,
            enable_stt=args.voice
        )
        await cli.list_voices()
        return
    
    # Create CLI instance
    cli = KiloChatCLI(
        provider=args.provider,
        model=args.model,
        language=args.language,
        tts_engine=args.tts_engine,
        voice=args.tts_voice,
        enable_tts=args.speak,
        enable_stt=args.voice
    )
    
    # Single message mode
    if args.message:
        await cli.chat_once(args.message, stream=not args.no_stream)
    else:
        # Interactive mode
        await cli.interactive_loop()


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code or 0)
    except KeyboardInterrupt:
        print("\n\nInterrupted.")
        sys.exit(130)
    except Exception as e:
        print(f"[Fatal error] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
