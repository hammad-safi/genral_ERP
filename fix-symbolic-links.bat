@echo off
echo ============================================
echo Fix for Electron Builder Symbolic Link Error
echo ============================================
echo.
echo This script will enable Developer Mode on Windows to allow symbolic links.
echo.
echo OPTION 1: Enable Developer Mode (Recommended)
echo ----------------------------------------------
echo Please follow these steps manually:
echo 1. Open Settings
echo 2. Go to Privacy ^& Security (or Update ^& Security on Windows 10)
echo 3. Click on "For developers"
echo 4. Toggle "Developer Mode" to ON
echo.
echo OPTION 2: Grant Symbolic Link Privilege via Command
echo ---------------------------------------------------
echo If you have Administrator access, run this script as Administrator
echo to automatically grant the "Create symbolic links" privilege.
echo.

:: Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Running as Administrator...
    echo.
    echo Granting "Create symbolic links" privilege to current user...
    whoami > "%TEMP%\currentuser.txt"
    set /p USERNAME=<"%TEMP%\currentuser.txt"
    del "%TEMP%\currentuser.txt"
    
    secpol.msc /s
    echo.
    echo Please navigate to:
    echo Local Policies -^> User Rights Assignment -^> Create symbolic links
    echo And add your user account: %USERNAME%
    echo.
    echo After making the change, restart your computer and try building again.
    pause
) else (
    echo NOTE: This script needs to be run as Administrator to automatically fix the issue.
    echo.
    echo Please either:
    echo 1. Enable Developer Mode manually (Settings ^> Privacy ^> For developers)
    echo 2. Right-click this file and select "Run as Administrator"
    echo.
    pause
)