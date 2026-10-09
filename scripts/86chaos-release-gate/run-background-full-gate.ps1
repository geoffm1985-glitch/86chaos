param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ExpectedCommit,
  [Parameter(Mandatory=$true)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$ExpectedVersion,
  [Parameter(Mandatory=$true)][ValidatePattern('^86Chaos-FullReleaseGate-[0-9.]+$')][string]$TaskName
)
$ErrorActionPreference = 'Stop'
$gateRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $gateRoot
$gateCache = Join-Path $gateRoot '.cache'
New-Item -ItemType Directory -Path $gateCache -Force | Out-Null
$gateRecordPath = Join-Path $gateCache 'full-release-gate-background.json'
$gateStdout = Join-Path $gateCache 'full-release-gate-background.stdout.log'
$gateStderr = Join-Path $gateCache 'full-release-gate-background.stderr.log'
$gateRecord = [ordered]@{status='starting';taskName=$TaskName;supervisorPid=$PID;startedAt=(Get-Date -Format o);branch='testing';version=$ExpectedVersion;commit=$ExpectedCommit;stdout=$gateStdout;stderr=$gateStderr}
function Save-BackgroundGate { $gateRecord | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $gateRecordPath -Encoding utf8 }
Save-BackgroundGate
try {
  if ((git branch --show-current).Trim() -ne 'testing') { throw 'Testing checkout required.' }
  if ((git rev-parse HEAD).Trim() -ne $ExpectedCommit) { throw 'Source commit changed before task startup.' }
  if (git status --porcelain) { throw 'Clean committed source required.' }
  if ((Get-Content 'package.json' -Raw | ConvertFrom-Json).version -ne $ExpectedVersion) { throw 'Release version changed before task startup.' }
  $env:APP_URL = 'https://testing.86chaos.com'
  $env:CHAOS_BASE_URL = 'https://testing.86chaos.com'
  $env:CHAOS_EXPECTED_BRANCH = 'testing'
  $env:CHAOS_EXPECTED_VERCEL_PROJECT_SLUG = '86chaos'
  $env:YARDMASTER_FIREBASE_TARGET = 'live'
  $env:YARDMASTER_FIREBASE_PROJECT = 'chaos-test-d1601'
  $env:CHAOS_BLOCK_LIVE_FIREBASE = '0'
  $gateScript = Join-Path $gateRoot 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'
  # Direct redirection preserves npm stderr notices without turning them into
  # terminating PowerShell pipeline errors. The native exit code is authoritative.
  $gateChild = Start-Process -FilePath 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',('"' + $gateScript + '"')) -WorkingDirectory $gateRoot -WindowStyle Hidden -RedirectStandardOutput $gateStdout -RedirectStandardError $gateStderr -PassThru
  $gateRecord.runnerPid = $gateChild.Id
  $gateRecord.status = 'running'
  Save-BackgroundGate
  $gateChild.WaitForExit()
  $gateChild.Refresh()
  $gateRecord.exitCode = $gateChild.ExitCode
  $gateRecord.finishedAt = Get-Date -Format o
  $gateRecord.status = if ($gateChild.ExitCode -eq 0) { 'passed' } else { 'failed' }
  Save-BackgroundGate
  exit $gateChild.ExitCode
} catch {
  $gateRecord.status = 'launch-failed'
  $gateRecord.error = $_.Exception.Message
  $gateRecord.finishedAt = Get-Date -Format o
  Save-BackgroundGate
  throw
}
