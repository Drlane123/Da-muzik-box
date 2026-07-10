@echo off
setlocal
cd /d "E:\Da-Music-Box-v4-SOURCE-COMPLETE"
title Da Music Box - Saving Your Code...
echo.
echo Saving your code to E:\ ...
echo DO NOT CLOSE THIS WINDOW until you see "BACKUP COMPLETE"
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\pack-code-only-zip.ps1"
echo.
if exist pack-result.txt type pack-result.txt
echo.
pause
