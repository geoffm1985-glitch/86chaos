# Runs only the 5 current FAIL/TIMEOUT tests from the 16.0.177 partial-resume Play Store report.
# It intentionally excludes the 149 PASS identities and the 2 SKIP identities from that report.
$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1"
& $script -SelectionMode reported-current-blockers @args
exit $LASTEXITCODE
