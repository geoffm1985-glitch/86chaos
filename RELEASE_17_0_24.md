# 86 Chaos 17.0.24

## App-Only Package Preflight and Installer Integrity Repair

17.0.24 is a surgical release-workflow and packaging-integrity repair over 17.0.23. It does not change restaurant production behavior.

### Confirmed defect

The 17.0.23 app-only archive accidentally contained generated `test-results/` output from local verification. The outer one-paste updater only checked version and manifest metadata during extraction, so the contaminated archive reached the repository-install stage before the stricter installer rejected it.

### Repair

- The one-paste updater now runs the same deep app-only validator immediately after extraction and before repository verification or mutation.
- App-only validation rejects generated test results, build output, caches, build identity leftovers, logs, archives, credential-like files, Python bytecode, and other forbidden content.
- Every packaged source file must be represented by `release-source-manifest.json`; unmanifested stray files fail closed.
- Manifest rows themselves may not point at forbidden/generated paths.
- A permanent 17.0.24 regression verifies clean-package acceptance, generated-artifact rejection, unmanifested-file rejection, and updater preflight ordering.
- 17.0.23 reporter compatibility and 17.0.22 hermetic regression isolation remain intact.

### Certification

17.0.24 is not certified by this repair. Certification still requires the complete deployed `npm run test:play-store` gate against the exact immutable 17.0.24 testing candidate.
