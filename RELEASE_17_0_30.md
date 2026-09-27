# 86 Chaos 17.0.30

<<<<<<< HEAD
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
=======
## Unified Feature and Release-Gate Parity Merge

17.0.30 reunifies the divergent 17.0.29 feature line and 16.0.244 testing/robustness line.

The 17.0.29 application feature surface remains authoritative, including Phase 1 Spanish/i18n, Schedule Builder assignment and deletion performance repairs, role-based schedule publishing, Request Off policy/runtime work, POS Bridge foundation, and the later release-gate maturity work.

The newer 16.0.244 robustness work is carried forward without rolling back 17.x behavior: explicit testing/experimental alias safety, line-ending-stable validator hashing, automatic isolated QA role bootstrap, native Firestore backup watchdog timeout/pagination hardening, and deployment-identity regression coverage.

Schedule PDF behavior is deliberately combined rather than choosing one branch: normal months remain compact on the single month calendar page with 12-hour shift labels, while a day too dense to fit safely gains deterministic overflow detail pages that preserve complete shift identity, time, and role text.

New merged-release Node and Play Store regressions verify both capability sets remain present. Full Play Store certification is still required for release approval.
>>>>>>> 1fb9648590016d97432aa4c21a1d5758ab3b8992
