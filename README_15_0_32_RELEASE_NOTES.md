# 86 Chaos 15.0.32 Release Notes

## AI Support Manual
- Replaced the long System Administrator Manual browsing experience with a question-driven support console.
- Added local support playbooks for the most common customer problems: login, permissions, time clock/GPS, push, AI scans, blank screen, Firebase rules, MFA recovery, and account deletion.
- Added quick sample questions, likely cause, first checks, fix order, do-not-do warnings, escalation notes, and a copyable support answer.
- Kept the full manual/search database available as bounded article results instead of one endless page.

## Security and Privacy
- Added Security Center account deletion request review controls.
- Account deletion requests can now be marked reviewing, completed, or denied with admin notes, security alerts, and audit logs.
- Hardened MFA recovery code handling so recovery codes cannot be generated or used unless `RECOVERY_CODE_SECRET` is configured.
- Tightened admin APIs so Firestore profile flags and custom claims are recognized consistently.
- Protected Super Admin accounts from accidental bulk or single-user deletion.

## Firebase Rules
- Firestore and Storage rules no longer rely on baked-in personal email fallbacks.
- Before publishing rules, make sure your Super Admin account has a Firebase custom claim or Firestore profile flag.
- Publish `firestore.rules` and `storage.rules` to testing first, then production after QA passes.

## Deployment
- Vercel redeploy required.
- New required env var for recovery codes: `RECOVERY_CODE_SECRET` with at least 32 characters.
- Confirm `/version.json` reports `15.0.32` after deployment.
