# 86 Chaos 17.0.30

## Unified Feature and Release-Gate Parity Merge

17.0.30 reunifies the divergent 17.0.29 feature line and 16.0.244 testing/robustness line.

The 17.0.29 application feature surface remains authoritative, including Phase 1 Spanish/i18n, Schedule Builder assignment and deletion performance repairs, role-based schedule publishing, Request Off policy/runtime work, POS Bridge foundation, and the later release-gate maturity work.

The newer 16.0.244 robustness work is carried forward without rolling back 17.x behavior: explicit testing/experimental alias safety, line-ending-stable validator hashing, automatic isolated QA role bootstrap, native Firestore backup watchdog timeout/pagination hardening, and deployment-identity regression coverage.

Schedule PDF behavior is deliberately combined rather than choosing one branch: normal months remain compact on the single month calendar page with 12-hour shift labels, while a day too dense to fit safely gains deterministic overflow detail pages that preserve complete shift identity, time, and role text.

New merged-release Node and Play Store regressions verify both capability sets remain present. Full Play Store certification is still required for release approval.
