@echo off
rem Starts a tiny local web server so the game can load model files from the models folder,
rem then opens the game in your browser. Close this window to stop the server.
cd /d "%~dp0"
start "" http://localhost:8765/
python -m http.server 8765 --bind 127.0.0.1
