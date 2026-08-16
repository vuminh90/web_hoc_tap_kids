@echo off
setlocal
cd /d "%~dp0"
call start_giasua_servers.bat
timeout /t 4 /nobreak >nul
if exist "backend\venv\Scripts\python.exe" (
  "backend\venv\Scripts\python.exe" kiosk_controller.py
) else (
  python kiosk_controller.py
)
endlocal
