@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1" %*
exit /b %errorlevel%
