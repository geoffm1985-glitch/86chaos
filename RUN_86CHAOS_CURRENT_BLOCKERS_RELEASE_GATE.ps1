# Runs only the 4 current FAIL/TIMEOUT tests from the latest 16.0.178 current-blockers Play Store report.
# It intentionally excludes PASS, SKIP, NOT-RUN, and the mobile Schedule Builder identity that passed in that report.
$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1"
& $script -SelectionMode reported-current-blockers @args
exit $LASTEXITCODE
