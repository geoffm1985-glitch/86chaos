# 86 Chaos 17.0.44

Pre-Playwright certification blocker repair.

- Corrects Customer Help release metadata so it matches the active application version.
- Preserves restaurant-facing behavior from 17.0.43.
- Adds explicit node and Play Store/release-gate coverage for Customer Help release-version parity.
- Retries the full Play Store certification because 17.0.43 was blocked before Playwright and executed zero Play Store tests.
