# Runs only the 2 current FAIL tests from the latest 16.0.179 current-blockers Play Store report.
# It intentionally excludes PASS, SKIP, TIMEOUT, NOT-RUN, cost-regression, Schedule Builder, and unrelated identities.
$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1"
& $script -SelectionMode reported-current-blockers @args
exit $LASTEXITCODE
