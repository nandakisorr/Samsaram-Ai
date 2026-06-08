@echo off
echo Downloading Piper female voice model: en_US-amy-medium...
echo.

REM Create piper_voices directory if it doesn't exist
if not exist "piper_voices" mkdir piper_voices

echo Fetching latest release info from GitHub...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/rhasspy/piper-voices/releases/latest' -OutFile 'release_page.html' 2>$null"

echo.
echo Please manually download from: https://github.com/rhasspy/piper-voices/releases
echo.
echo Files needed (in piper_voices\ folder):
echo   - en_US-amy-medium.onnx
echo   - en_US-amy-medium.onnx.json
echo.
echo Or run: curl -L -o piper_voices/en_US-amy-medium.onnx https://github.com/rhasspy/piper-voices/releases/download/v1.0/en_US-amy-medium.onnx
echo      curl -L -o piper_voices/en_US-amy-medium.onnx.json https://github.com/rhasspy/piper-voices/releases/download/v1.0/en_US-amy-medium.onnx.json
echo.
pause
