# 86 Chaos 17.0.46

Surgical repairs from the completed 17.0.45 full release gate.

- Disables Playwright retries in the standard, full Play Store, and failed/delta configurations.
- Fixes the mobile Schedule Builder sticky-header offset by using the control deck's resolved CSS top.
- Avoids browser PDF stalls by loading and embedding only the font subsets required by the current schedule.
- Replaces stale labels, table scope, reminder form assumptions, and historical version pins with current stable contracts.
- Resets dedicated release-gate QA profiles to English so localized account residue cannot invalidate English contract tests.
- Adds explicit node and Play Store/release-gate regression coverage for every repair.

No push, deployment, or release-gate execution is part of this local repair handoff.
