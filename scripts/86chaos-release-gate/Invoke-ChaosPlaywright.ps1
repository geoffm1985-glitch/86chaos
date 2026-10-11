param(
  [Parameter(Mandatory=$true)][string]$Config,
  [Parameter(ValueFromRemainingArguments=$true)][string[]]$TestArguments
)
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$env:FORCE_COLOR = '0'
Remove-Item Env:NO_COLOR -ErrorAction SilentlyContinue
$runner = Join-Path $PSScriptRoot 'playwright-console.cjs'
. (Join-Path $PSScriptRoot 'Write-ChaosConsole.ps1')
$logPath = if ($env:CHAOS_RELEASE_GATE_RUN_DIR) { Join-Path $env:CHAOS_RELEASE_GATE_RUN_DIR 'playwright-console.log' } else { $null }
if ($logPath) { New-Item -ItemType Directory -Path (Split-Path $logPath) -Force | Out-Null }
& node $runner --config $Config @TestArguments | ForEach-Object {
  $line = [string]$_
  if ($logPath) { Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8 }
  Write-ChaosConsoleLine $line
}
$testExitCode = $LASTEXITCODE
exit $testExitCode
