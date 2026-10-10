# Testing 17.0.86 reliability additions

This revision adds **86 scenarios**: 40 browser scenarios executed on desktop and mobile Chromium (80 executions), 30 local regression tests, and 16 physical-device acceptance scenarios. Browser emulation does not complete the device scenarios.

## Automated coverage

- `tests/86chaos-release-gate/100-operational-reliability.spec.cjs`: 10 catalog, 10 item-sales, 8 history, 6 attendance, 4 forecast and 2 training scenarios. Included in the full release universe and critical-spec inventory.
- `src/components/OperationalReliability.test.jsx`: 12 component/hook regressions for workspace and identity changes, late responses, cancellation, duplicate approvals, safe retries, source deduplication and scan limits.
- `api/reliability-release-gate.test.cjs`: 12 final-result and device-evidence validation regressions.
- `api/reliability-qa-cleanup.test.cjs`: 6 tests for cleanup ownership, tenant isolation, bounded traversal and removal of reviewed QA children.

Catalog/sales/policy saves, deduplication, forecast creation and training completion use the deployed app and real testing backend. Fault tests deliberately intercept individual network responses. Synthetic history pages exercise pagination edge cases; the separate real-history scenario checks the deployed endpoint. Existing API and emulator suites verify business rules and transactions.

Run the small regression set locally with `npm run test:reliability`. Run the complete local gate using `START_86CHAOS_PLAY_STORE_RELEASE_GATE_BACKGROUND.ps1` from the clean testing checkout after deployment identity matches. Do not dispatch GitHub Actions. The launcher must report failure when final certification is incomplete, including missing device evidence.

## Connected Android device acceptance

The authoritative 16 scenarios are in `test-tools/certification/device-acceptance.json`. They are **pending**, not skipped passes. When hardware is connected:

1. Record `adb devices -l`, Android version, model, installed package/version code, signing certificate and SHA-256 of the tested APK/AAB. Identify the source commit, manifest hash and app version corresponding to that Android artifact; the mobile release may differ from this web testing revision.
2. Install/upgrade the signed artifact and execute every checklist scenario on the connected device. Capture observations and relevant screenshots/logcat evidence under the matching release run. Inspect crashes and ANRs after lifecycle, offline and long-session exercises.
3. Write `real-device-evidence.json` into the matching release run with `ok:true` only after every check passes. Record actual observations and dates. Never copy old evidence to a new source identity or mark browser emulation as device evidence.
4. Validate with `validateDeviceEvidence` from `scripts/86chaos-release-gate/device-evidence.cjs`, then rerun/collect the matching release gate. Store submission requirements, signing and Play Console policy review remain separate release checks.

Evidence shape (illustration only; this is not passing evidence):

```json
{
  "ok": false,
  "version": "ACTUAL_ANDROID_RELEASE",
  "commit": "ACTUAL_SOURCE_COMMIT",
  "sourceManifestHash": "ACTUAL_SOURCE_HASH",
  "device": {"serial": "CONNECTED_SERIAL", "model": "ACTUAL_MODEL", "androidVersion": "ACTUAL_VERSION"},
  "artifact": {"sha256": "ACTUAL_APK_SHA256", "packageName": "ACTUAL_PACKAGE", "versionCode": 0},
  "results": [{"id": "android-install", "status": "pending", "testedAt": "", "evidence": ""}]
}
```

This work improves coverage and fixes discovered defects. It does not claim that every possible failure is tested or that Play Store certification is complete before physical-device and submission evidence exists.
