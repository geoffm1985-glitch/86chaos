@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0RUN_86CHAOS_FULL_APP_AUDIT.ps1" %*
exit /b %ERRORLEVEL%
