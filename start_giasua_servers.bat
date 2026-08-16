@echo off
cd /d "%~dp0backend"
if exist ".\venv\Scripts\python.exe" (
  start /b cmd /c ".\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
) else (
  start /b cmd /c "python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
)

cd /d "%~dp0frontend"
start /b cmd /c "npm.cmd run dev -- --host 0.0.0.0 --port 3000"
exit /b 0
