# 86 Chaos 17.0.13

Schedule Publish Candidate Evidence Repair

- Schedule publishing now confirms evidence for both shifts that need writes and shifts that are already validly published in the selected scope.
- The server now accepts that confirmed evidence as a safe superset, writes only stale/draft candidates, and still fails closed if a server-side writable shift has no matching confirmed evidence or if a confirmed shift changed before publication.
- This repairs the mobile publishing failure that surfaced as `candidate_set_changed` / “The saved schedule changed or the candidate query is incomplete.”
- Carries forward the request-only PWA icon metadata check so the release gate does not fail because an optional Firefox binary exits before a page is created.

Targeted validation:

- `node --test api/schedule-publish-17-0-0.test.cjs`
- `node scripts/validate-17-0-13.js`
