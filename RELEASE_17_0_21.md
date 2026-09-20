# 86 Chaos 17.0.21

## Hermetic Release Harness Environment Isolation Repair

This is a surgical release-harness repair of 17.0.20 after the real Windows/Node 24 updater run exposed a false synthetic collector failure before Playwright.

### Confirmed defect reproduced

The lifecycle test `collector keeps node summary expected-skipped when provisioning blocks before tests` passed in a clean shell but failed when the one-paste updater's real release identity remained in the environment.

The synthetic fixture declared version `16.0.95`, while ambient `CHAOS_EXPECTED_VERSION=17.0.20` and related certification/deployment variables caused the actual collector to add a version/reporting mismatch that did not belong to the fixture. The assertion at lifecycle line 691 therefore observed a false `reporting` failure group.

### Repair

- Synthetic collector fixtures now temporarily isolate ambient release/deployment identity variables before invoking the actual collector.
- Fixture-owned run ID and step-failure variables remain available to the collector.
- Every isolated environment value is restored afterward.
- `process.exitCode` is restored in `finally`, including assertion/error paths.
- A permanent 17.0.21 regression launches the exact lifecycle test in a child process with polluted updater-style release identity and requires it to pass.
- The one-paste updater now clears stale deployed-gate identity variables before local repair tests, then sets the authoritative values only after the exact immutable Vercel deployment is verified.

### Preserved behavior

No production application behavior or collector certification semantics changed. The 17.0.20 bounded failure-evidence repair, the 17.0.19 fail-closed collector/full-universe/retry repairs, Playwright-first ordering, Firebase test/production separation, immutable deployment identity, same-version resume, and mandatory post-Playwright certification remain intact.

17.0.21 is not certified by this repair. Certification still requires a complete successful `npm run test:play-store` against the exact immutable deployed 17.0.21 testing candidate.
