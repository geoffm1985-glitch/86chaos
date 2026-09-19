# 86 Chaos 17.0.11

Release title: Schedule Builder Runtime, Firebase Gate Referrer, and Automated Release Workflow Repair

Status: implemented candidate. A successful, inspected complete `npm run test:play-store` run against the exact immutable Vercel deployment is still required for certification.

## Confirmed defects repaired

- Schedule Builder filtered legacy `special_event` rows with `e.date.startsWith(...)` before normalizing the date. A missing or non-string legacy date threw during render and activated the recovery boundary. The builder now normalizes all directly consumed schedule collections and event dates before filtering, sorting, navigation, or rendering.
- Firebase Auth REST requests derived `Origin` and `Referer` from `APP_URL`. Certification intentionally pins `APP_URL` to a deployment-specific immutable Vercel hostname, which is not approved by the testing browser API-key restrictions. Firebase Auth now requires the separate stable testing referrer `CHAOS_FIREBASE_AUTH_REFERRER_URL`; application identity calls continue to use the immutable deployment URL.

## Release workflow and evidence

- `RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1` safely locates, validates, and overlays the app-only release ZIP without deleting the repository or `.git`; refuses dirty repositories; validates, tests, builds, stages, commits, pushes `testing`, verifies the remote SHA and exact Vercel identity, then runs only the complete Play Store gate.
- The Playwright release reporter shows discovered-suite overall progress plus elapsed-time-versus-timeout progress for the current test. Retries are retained as attempt evidence but counted once in final totals.
- The full release gate persists per-test duration evidence and whole-run start, finish, elapsed milliseconds, and formatted duration in the slim upload artifact. The exported ZIP path precedes the final total elapsed line.
- The 17.0.10 repository safety behavior is preserved: `release-source-manifest.json` is deliberately tracked while generated identities, reports, environment files, secrets, release ZIPs, and build output remain forbidden.

## Security boundaries unchanged

This release does not modify Firebase rules, Storage rules, production Firebase identity, authentication or MFA policy, App Check policy, tenant isolation, production secrets, Vercel production configuration, or API-key restrictions.
