@echo off
setlocal
set SCRIPT_DIR=%~dp0
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%INSTALL_AND_RUN_86CHAOS_ULTIMATE_TESTS.ps1" %*
exit /b %ERRORLEVEL%
