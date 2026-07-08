# 86 Chaos 14.0.10 Release Notes

## Push, Schedule Alert, and Firebase Wiring Audit

- Fixed a backend push-notification crash that could happen when a recipient had Mute on Days Off enabled.
- Updated `/api/send-push` so alert recipients and caller authorization work with both legacy user workspace fields and the canonical `workspaceMembers` model.
- Updated `/api/send-schedule-alert` so published schedule alerts reach active multi-workspace employees attached to the selected restaurant.
- Updated `/api/push-token-repair` so stale-token pruning and repair permissions use the same workspace-aware staff lookup.
- Aligned production Firebase Messaging selection across the app and service worker for `app.86chaos.com`, `86chaos.com`, and `www.86chaos.com`.
- Bumped the app, package, public version file, release guardrail, Help Center note, and Administrator Manual note to 14.0.10.

## Important behavior

Push token creation still must happen on the employee's own browser/device. Admin tools can queue repair, clear stale records, and send reconnect links, but Firebase Messaging tokens cannot be created for someone else's device from the server.
