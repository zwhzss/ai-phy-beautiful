@echo off
REM ============================================================
REM  Physics Beauty - one-click release build (launcher)
REM  Runs build-release.ps1 with execution policy bypassed.
REM  Any extra arguments are forwarded, e.g.:
REM      build-release.bat -SkipFrontend
REM      build-release.bat -NoInstaller
REM  Keep this file ASCII-only.
REM ============================================================

setlocal
set "SCRIPT_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%build-release.ps1" %*
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
    echo [FAILED] build exited with code %EXITCODE%.
    pause
    exit /b %EXITCODE%
)

echo [DONE] release build finished.
pause
exit /b 0
