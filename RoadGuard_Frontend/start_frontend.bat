@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:5173 in your browser.
echo Keep your FastAPI backend running in its separate terminal.
python -m http.server 5173 --bind 127.0.0.1
pause
