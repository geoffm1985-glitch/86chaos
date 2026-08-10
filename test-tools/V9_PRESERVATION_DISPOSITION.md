# V9 Preservation Tool Disposition

`test-tools/validate-v9-preservation.cjs` previously required `V9_BASELINE_TEST_MANIFEST.json`.
The current distributed 86 Chaos source ZIP does not include an authoritative V9 baseline manifest,
and the V9 validator is not part of the active package.json test scripts.

Because there is no source-shipped authoritative baseline to validate against, the V9 preservation
validator is retired from the current distributed regression pack. Do not fabricate a replacement
baseline. If a real baseline is restored later, re-enable the validator and add an explicit source
integrity test for that baseline.
