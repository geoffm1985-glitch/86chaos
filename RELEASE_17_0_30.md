# 86 Chaos 17.0.30

## Testing Domain Cutover and Presence Retirement

- Canonical release-gate testing target is now `https://testing.86chaos.com/`.
- The browser explicitly treats `testing.86chaos.com` as testing and keeps it on Firebase project `chaos-test-d1601`.
- User online/last-seen tracking is retired end to end: no RTDB presence session, heartbeat API, presence snapshot API, presence rules, System Administrator presence board, Staff Roster online badge, or last-online display remains.
- Realtime Database rules are fail-closed because 86 Chaos no longer uses RTDB for presence.
- The testing PWA uses `manifest-testing.json` and installs as **86chaos testing** only on `testing.86chaos.com`. Production remains **86 Chaos** with the existing production manifest and app identity.
- The already-passed 17.0.25 delta clean-baseline regression has been retired from the targeted suite. The delta workflow itself remains available.

### External testing-domain requirement

Firebase Authentication Authorized Domains and the Google Cloud browser API-key HTTP referrer restriction are separate gates. The testing project's browser API key must allow `https://testing.86chaos.com/*` if referrer restrictions are enabled. This source release cannot change that Google Cloud console setting.

This release is not certified until the requested release gate is run against the deployed 17.0.30 candidate.
