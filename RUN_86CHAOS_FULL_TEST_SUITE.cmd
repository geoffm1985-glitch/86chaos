@echo off
setlocal
set SCRIPT_DIR=%~dp0
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%RUN_86CHAOS_FULL_TEST_SUITE.ps1" %*
exit /b %ERRORLEVEL%
