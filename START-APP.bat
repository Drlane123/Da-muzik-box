@echo off
setlocal
cd /d "%~dp0"

echo.
echo  Da Music Box — clean dev start
echo  ==============================
echo.

echo [1/3] Stopping old dev servers on ports 5173 / 5174 / 4173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5174" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4173" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Starting Vite dev server...
echo.
echo  IMPORTANT: Use ONE browser tab only at http://localhost:5173/
echo  First open of Beat Lab or Studio Editor 2 can take 1-2 minutes in dev.
echo  Close extra localhost tabs before opening — they freeze the server.
echo.

start "Da Music Box Dev" cmd /k "cd /d %~dp0 && bun run dev"

timeout /t 3 /nobreak >nul
echo [3/3] Opening browser...
start "" "http://localhost:5173/"

echo.
echo  Dev server window opened separately. Leave it running while you use the app.
echo.
pause
