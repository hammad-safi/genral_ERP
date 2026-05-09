@echo off
echo ===== ELECTRON CACHE CLEAR SCRIPT =====
echo.

echo 1. Killing running Electron processes...
taskkill /f /im electron.exe 2>nul
taskkill /f /im "ERP Application.exe" 2>nul
echo    Done.

echo.
echo 2. Cleaning build cache folders...
rmdir /s /q "release" 2>nul
rmdir /s /q "dist" 2>nul
rmdir /s /q "node_modules\.vite" 2>nul
rmdir /s /q "node_modules\.cache" 2>nul
echo    Done.

echo.
echo 3. Rebuilding application...
call npm run electron:build

echo.
echo ===== BUILD COMPLETE =====
echo.
echo Your updated Electron app is now in the 'release' folder!
echo The UI freezing issue should be resolved.
echo.
pause
