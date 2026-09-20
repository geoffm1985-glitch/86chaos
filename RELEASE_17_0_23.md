# 86 Chaos 17.0.23

## Node Test Reporter Compatibility Repair

17.0.23 is a surgical release-workflow repair over 17.0.22. It does not change restaurant production behavior.

### Confirmed defect

On Windows Node 24, nested `node --test` child processes passed with exit code 0 but emitted the default spec reporter form (`✔ test name`) instead of TAP text (`ok 1 - test name`). Two historical regressions incorrectly treated the reporter presentation as part of the contract and therefore false-failed the current release regression stage.

### Repair

- Nested child-process regressions continue to require exit status 0.
- Output assertions now verify the semantic test name only and do not require a reporter-specific prefix.
- A permanent 17.0.23 regression proves nested Node tests are reporter-agnostic and prevents reintroduction of hard-coded TAP success/failure prefixes in the affected historical regressions.
- The complete current repair universe remains routed through the 17.0.22 hermetic child runner so stale release workflow state remains isolated.

### Certification

17.0.23 is not certified by this repair. Certification still requires the complete deployed `npm run test:play-store` gate against the exact immutable 17.0.23 testing candidate.
