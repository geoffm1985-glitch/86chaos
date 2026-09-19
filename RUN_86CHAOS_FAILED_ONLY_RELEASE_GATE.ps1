# Backward-compatible launcher for the strict failed-only diagnostic gate.
# RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1 remains the shared parameterized runner.
# Safety-pattern documentation retained for release-gate source tests:
# $WritesStarted = [bool]($setup.writesStarted -or $setup.qaDataWritesStarted
# $CleanupEligible = $WritesStarted -and ($SetupRunId -eq $RunId) -and ($SetupProjectId -eq 'chaos-test-d1601')
# cleanup unnecessary because no current-run Firebase writes began
$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1"
& $script -SelectionMode failed-only @args
exit $LASTEXITCODE
