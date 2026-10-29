@echo off
title AICTE FDR Shield - Launcher
color 0b

echo ===================================================
echo     AICTE FDR Shield - Quick Launcher
echo           Team FLUX ^| SIH 2026 PS-26265
echo ===================================================
echo.

:: Detect project directory
set BASE_DIR=%~dp0
if exist "%BASE_DIR%fdr-shield-backend" (
    set PROJECT_ROOT=%BASE_DIR%
) else if exist "D:\Programs\fdr-shield\fdr-shield-backend" (
    set PROJECT_ROOT=D:\Programs\fdr-shield\
) else (
    echo [ERROR] Could not locate FDR Shield project folder!
    pause
    exit /b 1
)

set BACKEND_DIR=%PROJECT_ROOT%fdr-shield-backend
set FRONTEND_DIR=%PROJECT_ROOT%fdr-shield-frontend

echo [1/3] Starting Backend API on http://localhost:5000 ...
start "FDR Shield Backend API (Port 5000)" cmd /k "cd /d "%BACKEND_DIR%" && npm run dev"

echo [2/3] Starting Frontend Portal on http://localhost:3000 ...
start "FDR Shield Frontend Portal (Port 3000)" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

echo [3/3] Waiting 4 seconds for servers to start...
timeout /t 4 /nobreak >nul

echo Opening FDR Shield Portal in browser...
start http://localhost:3000

echo.
echo ===================================================
echo  FDR Shield is now live!
echo  - Frontend: http://localhost:3000
echo  - Backend:  http://localhost:5000
echo.
echo  Keep the opened terminal windows running.
echo  To shut down both servers, press any key below.
echo ===================================================
echo.
pause >nul

echo Shutting down FDR Shield services...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo Done! All servers stopped cleanly.
timeout /t 2 >nul
