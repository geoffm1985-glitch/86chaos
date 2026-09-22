# 86 Chaos 17.0.19

## Release Gate Expected Version Pinning Repair

The 17.0.18 full Play Store gate proved that the deployed application, source manifest, Git commit, branch, and Firebase testing boundary all matched 17.0.18, but certification stopped before tests because an old `CHAOS_EXPECTED_VERSION=17.0.8` remained in the PowerShell process and `.env.test.local`.

17.0.19 makes the current `package.json` version authoritative for **full certification**. After local environment values are loaded, the full Play Store runner overwrites the process-level `CHAOS_EXPECTED_VERSION` with the package version before preflight. Full-certification target-conflict checks also exclude persisted expected-version values, so an old value cannot block the next sequential build.

This does **not** weaken deployment safety. The gate still requires the expected Git branch and commit, clean source manifest, immutable Vercel deployment identity, deployed client/server version, canonical testing URL, protected configuration hashes, and testing Firebase project to match. Non-certification preflight retains strict configured-version mismatch behavior.

Application behavior, Schedule Builder, schedule publishing, POS Bridge, Firebase rules, permissions, and restaurant data paths are unchanged.
