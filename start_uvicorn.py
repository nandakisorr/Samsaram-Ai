#!/usr/bin/env python
"""Start uvicorn; write output to log; exit only when uvicorn dies."""
import subprocess, os, sys

os.chdir(r"C:\nkr\projects\chatbot_v2")
log_path = r"C:\kilo\uv_alive.log"
proc = subprocess.Popen(
    [r"C:\Program Files\Python311\python.exe", "-m", "uvicorn",
     "app.main:app", "--host", "127.0.0.1", "--port", "8000",
     "--no-access-log", "--log-level", "warning"],
    stdout=subprocess.DEVNULL,  # discard output
    stderr=subprocess.DEVNULL,
    creationflags=subprocess.CREATE_NO_WINDOW,
)
with open(log_path, "w") as f:
    f.write(f"PID={proc.pid}\n")
proc.wait()
with open(log_path, "a") as f:
    f.write(f"EXIT={proc.returncode}\n")
