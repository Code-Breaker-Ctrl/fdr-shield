@echo off
title Stop FDR Shield
color 0c
echo ===================================================
echo       Stopping all FDR Shield background tasks...
echo ===================================================

echo Stopping services on Port 5000 and 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

echo Ports 5000 and 3000 are now freed.
echo Done!
timeout /t 2 >nul
