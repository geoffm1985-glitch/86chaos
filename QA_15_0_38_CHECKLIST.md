# QA Checklist - 86 Chaos 15.0.38

## Version and deploy
- [ ] Deploy to Vercel Preview/testing.
- [ ] Confirm `/version.json` shows `15.0.38`.
- [ ] Confirm the app loads without a white screen.

## System Administrator layout
- [ ] Desktop: open System Administrator and confirm the left Admin Menu starts at the top-left of the admin workspace.
- [ ] Desktop: confirm the Command Deck/Info Board appears to the right of the menu, not above it.
- [ ] Mobile: confirm the Admin Menu still opens/collapses from the menu button.

## Diagnostics fixes
- [ ] Run Health Checks and confirm `/api/health-checks` reports real route readiness instead of every route as missing.
- [ ] Run Full System Diagnostics and inspect the JSON for `signedUrl`; values should be absent or redacted.
- [ ] Confirm Security Diagnostics shows backup age, stale status, and watchdog fields.

## Backups
- [ ] Click Run Backup Now and confirm a manual backup completes and verifies integrity.
- [ ] Click Check Watchdog Now and confirm it reports either fresh/no backup needed or runs a catch-up backup.
- [ ] Open Backup Center, refresh backups, and confirm backup rows load.
- [ ] Confirm Backup Center Download still opens a signed download link when requested from the UI.

## Regression smoke test
- [ ] Confirm System Administrator Manual still opens.
- [ ] Confirm Ask Gemini still shows a server/env warning if no Gemini key is configured, or answers if the key exists.
- [ ] Confirm Backup Center restore path selection still fills the selected Storage path.
