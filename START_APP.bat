@echo off
REM Simple launcher for Shop ERP Electron Application
REM This batch file runs the unpacked Electron app

set APP_PATH=%~dp0release\win-unpacked\Shop ERP.exe
set APP_NAME=Shop ERP

if exist "%APP_PATH%" (
    echo Starting %APP_NAME%...
    start "" "%APP_PATH%"
) else (
    echo Error: Application executable not found at %APP_PATH%
    echo Please ensure the application has been built.
    pause
)
