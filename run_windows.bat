@echo off
cd /d "%~dp0"
echo Starting The Far Backrooms at http://localhost:8000
start "" http://localhost:8000
node server.js 8000
