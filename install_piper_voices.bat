@echo off
REM Piper TTS Voice Models Installer for Windows
REM =============================================
REM This script downloads high-quality neural voice models for Piper TTS.
REM
REQUIREMENTS:
  - Python 3.9+ with pip
  - Internet connection to download ~40MB voice models
  - pip install piper-tts (already in requirements.txt)

echo ================================
echo Piper TTS Voice Model Installer
echo ================================
echo.

REM Check if piper-tts is installed
pip show piper-tts >nul 2>&1
if errorlevel 1 (
    echo [ERROR] piper-tts package not found.
    echo Run: pip install -r requirements.txt
    exit /b 1
)

echo [1/3] Creating models directory...
if not exist "piper_voices" mkdir piper_voices

echo.
echo [2/3] Downloading voice models...
echo Note: If downloads fail due to network restrictions,
echo you can manually download from:
echo   https://github.com/rhasspy/piper-voices/releases
echo Place .onnx and .onnx.json files in piper_voices\

py -3.11 -c "
import urllib.request, os, sys

# Updated URLs: HuggingFace direct links (resolve)
base_urls = [
    'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium',
    'https://github.com/rhasspy/piper-voices/releases/download/v1.0/en_US-amy-medium',
]

voices = [
    ('en_US-amy-medium', 'en_US-amy-medium'),
    ('ml_IN-swetha-medium', 'ml_IN-swetha-medium'),
]

def try_download(name, remote_name):
    dest = f'piper_voices/{name}.onnx'
    if os.path.exists(dest):
        print(f'  [OK] Already exists: {dest}')
        return True
    for base in base_urls:
        url = f'{base}/{remote_name}.onnx'
        try:
            print(f'  Trying {url}')
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as r, open(dest, 'wb') as f:
                f.write(r.read())
            print(f'  [OK] Downloaded: {dest}')
            # Also try to download .json config if not exists
            json_dest = f'piper_voices/{name}.onnx.json'
            if not os.path.exists(json_dest):
                json_url = f'{base}/{remote_name}.onnx.json'
                try:
                    req2 = urllib.request.Request(json_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req2, timeout=30) as r2, open(json_dest, 'wb') as f2:
                        f2.write(r2.read())
                    print(f'  [OK] Downloaded config: {json_dest}')
                except Exception as e:
                    print(f'  [WARN] Could not download config: {e}')
            return True
        except Exception as e:
            print(f'  [FAIL] {e}')
    return False

ok_en = try_download('en_US-amy-medium', 'en_US-amy-medium')
ok_ml = try_download('ml_IN-swetha-medium', 'ml_IN-swetha-medium')
"

if errorlevel 1 (
    echo.
    echo [ERROR] Download script failed. See messages above.
    echo Manual steps:
    echo   1. Download voice model .onnx + .onnx.json from:
    echo      https://github.com/rhasspy/piper-voices/releases
    echo      or HuggingFace: https://huggingface.co/rhasspy/piper-voices
    echo   2. Place both files in piper_voices\
    echo   3. Update .env: PIPER_DEFAULT_VOICE=your-model-name (without extension)
    pause
    exit /b 1
)

echo.
echo [3/3] Verifying installation...
py -3.11 -c "
from piper import PiperVoice
import sys
try:
    voice = PiperVoice.load('piper_voices/en_US-amy-medium.onnx')
    print('[OK] Piper voice loaded successfully!')
    sys.exit(0)
except Exception as e:
    print(f'[ERROR] {e}')
    print('Voice model may be corrupted. Try re-downloading.')
    sys.exit(1)
"

if errorlevel 1 (
    echo.
    echo [ERROR] Piper voice verification failed.
    pause
    exit /b 1
)

echo.
echo ================================
echo Installation complete!
echo ================================
echo Piper TTS is ready. Restart the backend server.
echo.
pause
