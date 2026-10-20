@echo off
chcp 65001 >nul
echo ========================================
echo   Physics Beauty - Dev Environment Launcher
echo ========================================
echo.

echo [1/2] Starting backend server (Go + Gin)...
cd /d "%~dp0server"
start "PhysicsBeauty Server" cmd /c "go run ./cmd/server && pause"
timeout /t 3 >nul

echo [2/2] Starting frontend dev server (Angular)...
cd /d "%~dp0client"
start "PhysicsBeauty Client" cmd /c "npm run dev && pause"

echo.
echo ========================================
echo   Backend:  http://localhost:8080
echo   Frontend: http://localhost:4200
echo ========================================
echo.
pause
