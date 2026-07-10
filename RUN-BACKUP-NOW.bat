@echo off
setlocal
cd /d "E:\Da-Music-Box-v4-SOURCE-COMPLETE"
echo.
echo Da Music Box — timestamped source backup to E:\
echo (skips node_modules, .cache, dist, .vite-cache)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\pack-to-e-now.ps1" -ZipOnly
echo.
if exist pack-result.txt type pack-result.txt
echo.
pause
