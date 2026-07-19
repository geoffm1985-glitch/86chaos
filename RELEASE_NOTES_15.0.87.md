# 86 Chaos 15.0.87 Release Notes

## Release type
Audit repair and hardening pass.

## Fixed before further beta use

- Team Management no longer grants broad financial or inventory write power.
- Audit records are created through an authenticated server route instead of direct client Firestore writes.
- Crash reports are created through `/api/report-bug`; direct client crash-report writes are blocked.
- Invoice scan files now require inventory/scan/financial authority in Storage rules.
- Profile-photo uploads are scoped to the signed-in user or staff managers.
- Founder Beta creation and plan constants now use 90 days.
- Plan-gated Firestore rule checks now require an active entitlement and deny terminal statuses such as canceled, expired, suspended, and disabled.
- AI scan authorization no longer trusts custom role label strings such as “Admin” or “Owner.”
- Elevated MFA checks no longer depend on plain-text role names.
- Reminder cron processing retries safe failures, preserves monthly date intent, and avoids starving due reminder queues.
- Firebase Messaging startup is guarded for unsupported browsers.
- Geocode lookup requires authenticated workspace authorization.

## Preserved by request

- Generic complete JSON `FIREBASE_SERVICE_ACCOUNT_KEY` handling is unchanged and remains supported.

## Known limitations

Authenticated end-to-end workflow verification still requires safe Firebase test users or emulator seed data. Those checks are listed in `POST_REPAIR_QA.md`.
