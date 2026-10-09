# Launch the complete gate through Windows services so it survives a chat/tool exit.
$ErrorActionPreference = 'Stop'
$gateRoot = $PSScriptRoot
Set-Location -LiteralPath $gateRoot
$gateCommit = [string](git rev-parse HEAD)
if ($LASTEXITCODE -ne 0 -or $gateCommit.Trim() -notmatch '^[0-9a-f]{40}$') { throw 'A committed Git checkout is required.' }
$gateCommit = $gateCommit.Trim()
if ((git branch --show-current).Trim() -ne 'testing') { throw 'The background full gate requires the testing branch.' }
if (git status --porcelain) { throw 'Commit the intended source before launching the full gate.' }
$gateVersion = [string]((Get-Content (Join-Path $gateRoot 'package.json') -Raw | ConvertFrom-Json).version)
if ($gateVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'A numeric release version is required.' }
$gateTaskName = '86Chaos-FullReleaseGate-' + $gateVersion
$gateExisting = Get-ScheduledTask -TaskName $gateTaskName -ErrorAction SilentlyContinue
if ($gateExisting -and $gateExisting.State -eq 'Running') { throw 'The background release gate is already running.' }
$gateSupervisor = Join-Path $gateRoot 'scripts\86chaos-release-gate\run-background-full-gate.ps1'
$gateArguments = '-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -WindowStyle Hidden -File "' + $gateSupervisor + '" -ExpectedCommit ' + $gateCommit + ' -ExpectedVersion ' + $gateVersion + ' -TaskName ' + $gateTaskName
$gateAction = New-ScheduledTaskAction -Execute 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -Argument $gateArguments -WorkingDirectory $gateRoot
$gatePrincipal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$gateSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Days 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $gateTaskName -Action $gateAction -Principal $gatePrincipal -Settings $gateSettings -Description 'On-demand complete testing release gate. Independent of the launching shell; no recurring trigger.' -Force | Out-Null
Start-ScheduledTask -TaskName $gateTaskName
[ordered]@{taskName=$gateTaskName;version=$gateVersion;commit=$gateCommit;launchRecord=(Join-Path $gateRoot '.cache\full-release-gate-background.json')} | ConvertTo-Json
