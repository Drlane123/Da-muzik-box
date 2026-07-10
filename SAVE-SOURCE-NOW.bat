@echo off
setlocal
cd /d "E:\Da-Music-Box-v4-SOURCE-COMPLETE"
echo.
echo ========================================
echo  Da Music Box - SAVE SOURCE TO E:\
echo  Split zip: APP + PUBLIC + GIT
echo  Run from Explorer — keep window open
echo ========================================
echo.
echo Step 1: Creating verified source zips on E:\ ...
echo   Part 1 APP  (~10 MB)  — your code
echo   Part 2 PUBLIC (~650 MB) — samples/assets
echo   Part 3 GIT   (~1+ GB) — version history
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\pack-source-split-zip.ps1"
if errorlevel 1 (
  echo.
  echo BACKUP FAILED — see message above. Do not close until you read it.
  echo Your last good APP zip may still be on E:\ as *APP-SOURCE* or *EMERGENCY*
  pause
  exit /b 1
)
echo.
echo -------- RESULT (also in pack-result.txt) --------
if exist pack-result.txt type pack-result.txt
echo.
echo Open E:\ in File Explorer — look for *APP-SOURCE* *PUBLIC* *GIT* zips
echo.
pause
