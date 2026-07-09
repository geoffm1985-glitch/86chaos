# 86 Chaos 15.0.26 MFA Recovery & Safer Enforcement

## Summary
15.0.26 keeps Google sign-in out of scope and focuses on the remaining MFA hardening work: backup phone enrollment, Super Admin recovery, and safer elevated-role enforcement guidance.

## Changes
- Added backup MFA phone enrollment from Account Security after the first SMS factor is enrolled.
- Added Super Admin MFA Recovery in Account Security to inspect a user MFA status and reset lost/broken-phone factors.
- MFA recovery actions require a written reason and write an audit log entry.
- Account Security now explains that MFA is required for owners, managers, admins, and System Administrators when enforcement is enabled, while regular employees may enroll optionally.
- Improved Firebase MFA error messaging so `auth/operation-not-allowed` no longer claims MFA is disabled when SMS regions/domains/provider settings are the real issue.
- Updated `/api/account-security` with admin MFA inspection and reset actions.

## Deploy notes
- Vercel/API redeploy is required because `/api/account-security` changed.
- No Firestore rules changes.
- No Storage rules changes.
- No new Vercel environment variables.
- Keep `MFA_ENFORCE_ELEVATED_ROLES=false` until at least one elevated account and the recovery reset flow are tested.
