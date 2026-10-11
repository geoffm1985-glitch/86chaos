function Write-ChaosConsoleLine {
  param([string]$Line)
  $color = 'Gray'
  if ($Line -match '^\[PASS\]|^RESULT: PASSED') { $color = 'Green' }
  elseif ($Line -match '^\[(FAIL|TIMEOUT|INTERRUPTED)\]|^RUN ERROR:|^RESULT: (FAILED|BLOCKED)|^FAILED TEST') { $color = 'Red' }
  elseif ($Line -match '^\[SKIP\]') { $color = 'Yellow' }
  elseif ($Line -match '^\[PROGRESS\]|^86 CHAOS|^=+$') { $color = 'Cyan' }
  elseif ($Line -match '^\[RUNNING\]') { $color = 'Magenta' }
  Write-Host $Line -ForegroundColor $color
}
