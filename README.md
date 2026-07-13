# 86 Chaos — Version 15.0.63

Version **15.0.63** is a targeted maintenance-mode hotfix. It prevents Firestore `undefined` field errors when System Administrator enables or clears workspace maintenance mode. It preserves the 15.0.62 voice reminder timing, 15.0.61 intelligent voice-command system, 15.0.60 mark-done matching, 15.0.59 manual coverage, 15.0.58 website-claims hardening, 15.0.57 desktop polish, 15.0.56 restaurant-group push broadcasts, and the tier / Founder Beta / feature gate system.

## What changed in 15.0.63

- Maintenance Mode enable/clear payloads are sanitized before Firestore writes.
- Settings history for maintenance actions now stores `null` for missing prior fields instead of `undefined`.
- Clearing maintenance also clears stale maintenance message, audience, start, and end values with safe `null` values.
- No Firebase rules, Storage rules, Vercel env vars, plan gates, voice workflows, or retention functions changed.

## Deployment

Deploy this ZIP to the testing/Vercel preview side first. Confirm `/version.json` reports `15.0.63`, then test System Administrator → Maintenance Mode Controls on one workspace before using global maintenance.
