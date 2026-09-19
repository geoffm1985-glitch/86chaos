# 86 Chaos release test-selection policy

- Normal small feature, bug, or UI change: run tests directly relevant to the implementation plus targeted regression coverage.
- Known test-failure repair: failed-only testing may be used only when specifically requested.
- Major or high-risk release: run the complete Play Store release gate.
- Before promoting `testing` to production: always run the complete Play Store release gate.

Only a complete successful Play Store gate against the exact immutable deployment may certify a release. Targeted, delta, repair, failed-only, blocked, partial, or zero-test runs do not certify.

For 17.0.11, after deploying and verifying the exact testing candidate, the user workflow runs only:

```text
npm run test:play-store
```
