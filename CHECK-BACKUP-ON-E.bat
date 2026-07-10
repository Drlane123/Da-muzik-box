@echo off
setlocal
cd /d "E:\Da-Music-Box-v4-SOURCE-COMPLETE"
echo.
echo ========================================
echo  CHECK BACKUP ON E: (size + file count)
echo  Run from File Explorer — NOT inside Cursor
echo ========================================
echo.
where bun >nul 2>&1 && (
  bun "scripts\verify-backup-on-e.mjs"
) || (
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\verify-backup-on-e.ps1"
)
echo.
if exist pack-result.txt type pack-result.txt
echo.
pause
