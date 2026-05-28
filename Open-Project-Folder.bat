@echo off
title Da Music Box - Project Folder
echo.
echo Opening project folder in File Explorer...
echo.
echo %~dp0
echo.
explorer "%~dp0"
dir /a "%~dp0" | more
echo.
pause
