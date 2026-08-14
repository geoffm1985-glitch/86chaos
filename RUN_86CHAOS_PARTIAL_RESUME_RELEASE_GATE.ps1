# Runs only FAIL/TIMEOUT plus NOT-RUN tests from the uploaded interrupted 16.0.175 Play Store run.
# It intentionally excludes tests that already passed in that partial run.
$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1"
& $script -SelectionMode partial-resume @args
exit $LASTEXITCODE
