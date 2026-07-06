# 86 Chaos 13.1.26 Release Notes

## Focus

Preview-login guidance cleanup.

## Changes

- Replaced the vague Firebase preview/referrer login warning with an actionable message.
- The login screen now explains that an unapproved Vercel preview URL can block login, push-token repair, and owner-only Settings tab loading.
- The warning now shows the exact domain to add to Firebase Auth authorized domains.
- The warning now shows the exact `https://domain/*` referrer pattern to add to Google Cloud API key restrictions for preview testing.
- Multiline login errors now render cleanly instead of becoming one hard-to-read paragraph.

## Deploy impact

- Firestore rules: no change.
- Storage rules: no change.
- Vercel config/API routes: no change.
- Firebase Console: only needed if you want to test from a Vercel preview URL. Production URL login is unchanged.
