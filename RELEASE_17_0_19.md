# 86 Chaos 17.0.19

## Release Gate Certification Integrity, Full-Universe, and Resume Repair

This is a surgical release-gate repair of 17.0.18 based on confirmed hostile-review findings. Application business behavior, Firebase security, tenant isolation, App Check, MFA, API-key restrictions, deployment identity, and the full test universe are preserved.

### Confirmed defects repaired

- Four mandatory historical maturity tests pinned current-source assertions to stale 17.0.12/17.0.10 metadata. They now validate the authoritative current release metadata contract while preserving their historical behavioral assertions.
- The collector could write `ok:false` and still exit zero. It now exits nonzero for a non-green current verdict, and the PowerShell wrapper independently requires a present, parseable, `ok:true` current summary before it can report success.
- Full mode now reconciles unique executed Playwright identities against the authoritative `playwright --list` inventory using spec path, suite path, leaf title, and project. Missing, extra, duplicate, focused, or incomplete identities block certification.
- Release configs now set `forbidOnly:true` independently of CI, and inventory generation performs a source focus scan before discovery so `.only` cannot shrink both discovery and execution unnoticed.
- Same-version one-paste resume now reuses a clean manifest-verified existing commit, safely pushes only when needed, and does not create an empty commit.
- Streamed release checks retain a separately bounded actionable-failure window with chunk-boundary handling, so an early assertion remains available even after more than 512 KiB of later output.
- Collector Playwright totals now count one final outcome per test identity. Retry attempts and flaky history remain explicit separate evidence.
- Timed-out and interrupted required post-Playwright groups are retained as named actionable collector failures.

### Gate order preserved

1. Dependency, immutable deployment, Firebase, and test-account preconditions.
2. Bounded source/version, API/script syntax, and Python readiness.
3. Main full Playwright release universe.
4. Mandatory hostile, concurrency, recovery, scale, server, client, build, Java, Firestore, and Storage certification checks.
5. Cleanup, final source/deployment identity verification, report collection, and fail-closed final verdict.

Implementation and local validation do not certify 17.0.19. Certification still requires the complete `npm run test:play-store` run against the exact immutable deployed testing candidate with every mandatory evidence group green.

### Local validation note

The final repair bundle is designed for the project-required Node 24.x environment. In the implementation workspace, Node 22.16.0 correctly causes the historical preflight/lock checks to refuse execution. Dependency-independent 17.0.19 collector, metadata, retry, inventory, failure-evidence, Firebase-boundary, Vercel-target, and harness lifecycle regressions pass. This environment limitation is not treated as a release pass; the complete Node 24 full gate remains required.
