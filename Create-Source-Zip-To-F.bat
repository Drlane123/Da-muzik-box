@echo off
setlocal
cd /d "%~dp0"

if not exist F:\ (
  echo F: drive not found.
  pause
  exit /b 1
)

set "ZIP=F:\Da-Music-Box-v4-SOURCE-COMPLETE-source.zip"
if exist "%ZIP%" del /f /q "%ZIP%"

echo Creating source zip on F: ...
tar -a -c -f "%ZIP%" --exclude=node_modules --exclude=dist --exclude=.git --exclude=.vite --exclude=coverage --exclude=_zip_log.txt .
if errorlevel 1 (
  echo tar failed.
  pause
  exit /b 1
)

echo.
echo Done: %ZIP%
dir "%ZIP%"
pause
