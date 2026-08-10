86 Chaos Full Test Suite

Primary command:
  npm run test:full-suite

Local-only command:
  npm run test:full-suite:local

The runner writes test-results/86chaos-full-local-suite/<runId> and always attempts to create:
  86chaos-FULL-SUITE-UPLOAD-ME-16.0.174-<timestamp>.zip

Statuses are PASS, FAIL, or BLOCKED. BLOCKED means a required external capability was unavailable, such as Java, Firebase emulator, or a safe QA Playwright deployment.
