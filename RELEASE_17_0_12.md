# 86 Chaos 17.0.12

**Release:** Hostile Certification Source Identity Regression Repair

## Scope

Surgical release-gate/test-fidelity repair after the 17.0.11 full Play Store gate stopped in hostile certification before Playwright.

## Root cause

The historical 17.0.5 source-identity regression forced `VERCEL=1` in a temporary fixture that did not include the bundled `release-source-manifest.json`, then expected normal Vercel builds to detect temporary-workspace drift. That expectation became stale after 17.0.8 intentionally changed normal Vercel identity to immutable Git metadata plus the committed manifest, with byte-for-byte workspace verification reserved for the opt-in strict diagnostic path.

## Repair

- Updated the historical 17.0.5 regression to provide valid bundled-manifest evidence.
- Normal Vercel-mode assertions now verify manifest/Git-bound deployment-safe identity with no workspace scan.
- Modified/deleted runtime-input assertions now execute under `CHAOS_STRICT_VERCEL_BUILD_WORKSPACE=1`.
- Added focused 17.0.12 regression coverage for both normal and strict identity paths.
- Production source-identity behavior, Firebase security, Vercel security, Schedule Builder behavior, and tenant/data boundaries are unchanged.

A complete full Play Store release gate is still required before certification.
