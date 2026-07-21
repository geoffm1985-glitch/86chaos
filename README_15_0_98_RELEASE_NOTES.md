# 86 Chaos 15.0.98 Release Notes

## Push Duplicate Browser Token Hotfix

This release extends the 15.0.97 push duplicate fix to desktop browsers and reminder dispatch.

### Fixed
- Reminder dispatch now treats `users.fcmToken` as the canonical current push token.
- Legacy token arrays/objects are only used as fallback when no current `fcmToken` exists.
- This prevents old desktop/browser service-worker tokens from receiving the same reminder alongside the current token.
- Push token sync now marks the current token as canonical for diagnostics.

### Still preserved
- Stable notification tags from 15.0.97 remain in place.
- Firebase service worker still avoids manually displaying Firebase notification payloads that the browser/FCM layer already displays.
- Reminder, schedule, message, bug-report, account-security, and owner/admin alert click targets remain intact.

## Notes
After deploying, open the app once on each device/browser that should receive notifications so the current service worker and canonical token sync.
