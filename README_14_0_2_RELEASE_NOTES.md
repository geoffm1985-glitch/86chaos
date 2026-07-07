# 86 Chaos 14.0.2 Release Notes

## Version 14.0.2: Tip Declaration Reliability

### Fixed

- Mandatory Tip Declaration now works for all staff clock-outs when the workspace setting is enabled.
- Legacy restaurant settings that do not yet contain a `tips` field now default to mandatory tip declaration instead of silently bypassing the modal.
- Time Clock & Schedule now reads the newest workspace settings from the restaurant document, not just the cached user object.
- Tip entries are normalized to safe positive dollar values, with `0` allowed when the employee did not receive tips.
- Closed punches now store tip declaration metadata so managers can verify whether the declaration was required and completed.
- Mandatory Tip Declaration is no longer blocked by Starter/Pro plan gating in Settings.
- Schema Doctor now detects and can repair missing `systemSettings.tips` by stamping the workspace default explicitly.

### Notes

No new Vercel environment variables are required.
