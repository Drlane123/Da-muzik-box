@echo off
setlocal EnableExtensions
cd /d "E:\Da-Music-Box-v4-SOURCE-COMPLETE"

set "STAMP=%date:~-4%-%date:~4,2%-%date:~7,2%_%time:~0,2%%time:~3,2%"
set "STAMP=%STAMP: =0%"
set "ZIP=E:\Da-Music-Box-SOURCE-APP_%STAMP%.zip"

echo.
echo ============================================
echo  SAVE APP SOURCE ONLY - fast, reliable
echo  app + scripts + config (no public/git)
echo ============================================
echo.
echo Writing: %ZIP%
echo.

tar -a -c -f "%ZIP%" app scripts package.json bun.lock bunfig.toml vite.config.ts tsconfig.json index.html .gitignore main.tsx .cursor/rules Da-Music-Box-v4.code-workspace README.md 2>nul
if errorlevel 1 (
  echo tar ERROR - try closing Cursor first, then run this again from Explorer.
  pause
  exit /b 1
)

tar -tf "%ZIP%" >nul 2>&1
if errorlevel 1 (
  echo ZIP FAILED verification - delete bad file and retry.
  pause
  exit /b 1
)

for %%A in ("%ZIP%") do set SIZE=%%~zA
echo.
echo BACKUP COMPLETE
echo   %ZIP%
echo   Size bytes: %SIZE%
echo.
echo You can keep working. For public samples + git run SAVE-SOURCE-NOW.bat later.
echo.
pause
