@echo off

setlocal EnableExtensions

cd /d "%~dp0"



REM Saves working source to E: — does NOT touch your other backup folders.

if not exist E:\ (

  echo E: drive not found.

  pause

  exit /b 1

)



REM Stage on E: when C: is low on space (temp on C: can make tar fail)
set "STAGE=E:\DaMusicBox-WORKING-source-STAGING.zip"

set "DEST=E:\DaMusicBox-WORKING-source.zip"



if exist "%STAGE%" del /f /q "%STAGE%"

if exist "%DEST%" del /f /q "%DEST%"



echo.

echo [1/3] Building zip on C: temp first (so we can verify it)...

echo      Excludes: node_modules, dist, .git, .vite, coverage

echo.



tar -a -c -f "%STAGE%" --exclude=node_modules --exclude=dist --exclude=.git --exclude=.vite --exclude=coverage --exclude=_zip_log.txt --exclude=_e_zip_diag.txt .

if errorlevel 1 (

  echo tar failed while creating staging zip.

  pause

  exit /b 1

)



for %%A in ("%STAGE%") do set STAGESIZE=%%~zA

if "%STAGESIZE%"=="0" (

  echo ERROR: Staging zip is 0 bytes — archive is empty. Aborting.

  pause

  exit /b 1

)



echo.

echo [2/3] Verifying archive has files...

tar -t -f "%STAGE%" >nul 2>&1

if errorlevel 1 (

  echo ERROR: Staging zip is corrupt or unreadable. Aborting.

  pause

  exit /b 1

)



echo.

echo [3/3] Copying verified zip to E: ...

copy /y "%STAGE%" "%DEST%" >nul

if errorlevel 1 (

  echo copy to E: failed.

  pause

  exit /b 1

)



del /f /q "%STAGE%" >nul 2>&1



echo.

echo Done — your backups on E: were not modified.

echo.

dir "%DEST%"

echo.

echo Open this file: %DEST%

pause

