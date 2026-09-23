# 86 Chaos 17.0.33 — Exact Concept 1 System Administrator Home

## Scope
- Removed the old System Administrator home dashboard headed “What needs your attention?”.
- Removed its Next actions list, Quick work tiles, summary number cards, and old Admin areas directory from the live overview.
- Rebuilt the live System Administrator overview to match the selected Concept 1 softer-dark-card mockup with seven primary cards on desktop and mobile.
- Kept the underlying System Administrator tools available; non-home tool pages include an All System Administrator tools jump selector plus Console home.
- Extended the existing Spanish Phase 2 dictionary to the Concept 1 card titles and descriptions.
- Preserved the testing.86chaos.com delta/repair runner pin and the 17.0.30 presence retirement.

## Targeted evidence
- `npm run test:current-release-targeted`: 40/40 Node subtests passed before source validation.
- `node scripts/validate-17-0-33.js`: passed.
- New deployed browser regression: `tests/86chaos-new-implementations/11-system-admin-concept1-exact.spec.cjs` on chromium and mobile-chromium through the current-release repair scope.

This targeted evidence does not constitute full Play Store certification.
