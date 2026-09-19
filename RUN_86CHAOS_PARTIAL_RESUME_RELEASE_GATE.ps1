# Resumes the latest captured full run only when source, commit, Preview, project, and test inventory still match.
# Completed passes remain prior evidence; required skip companions are rerun. Full certification is still required.
$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1"
& $script -SelectionMode partial-resume @args
exit $LASTEXITCODE
