@echo off
echo ================================================
echo   IRRA - Intelligent RAG Revision Assistant
echo ================================================
echo.
echo Starting Backend (FastAPI)...
start "IRRA Backend" cmd /k "python -m uvicorn api:app --host 0.0.0.0 --port 8001"

echo Starting Frontend (React)...
start "IRRA Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both services are launching in separate windows!
echo   Backend  ^>  http://localhost:8001
echo   Frontend ^>  http://localhost:5173
echo.
pause
