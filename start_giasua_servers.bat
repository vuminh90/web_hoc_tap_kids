@echo off
cd /d "d:\Du An AI\2. Test\backend"
start /b cmd /c ".\venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000"

cd /d "d:\Du An AI\2. Test\frontend"
start /b cmd /c "npm run dev"
exit
