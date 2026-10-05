'use strict';

const RELEASE_TEST_MATCH = Object.freeze([
  '86chaos-full-audit/**/*.spec.cjs',
  '86chaos-release-gate/**/*.spec.cjs',
  'e2e/**/*.spec.cjs',
  '86chaos-cross-browser/**/*.spec.cjs',
  '86chaos-new-implementations/**/*.spec.cjs',
]);

const RELEASE_CRITICAL_SPECS = Object.freeze([
  'tests/e2e/app-health.spec.cjs',
  'tests/e2e/authenticated-release.spec.cjs',
  'tests/e2e/chunk-recovery.spec.cjs',
  'tests/e2e/compact-ui-layout.spec.cjs',
  'tests/e2e/cost-regression.spec.cjs',
  'tests/86chaos-release-gate/35-reminder-notification-certification.spec.cjs',
  'tests/86chaos-release-gate/36-restaurant-brain.spec.cjs',
  'tests/86chaos-new-implementations/06-pos-bridge-contract.spec.cjs',
  'tests/86chaos-new-implementations/07-pos-bridge-security.spec.cjs',
  'tests/86chaos-release-gate/37-native-backup-watchdog-hardening.spec.cjs',
  'tests/86chaos-release-gate/38-release-identity-deployment-parity.spec.cjs',
  'tests/86chaos-release-gate/39-testing-alias-mutation-safety.spec.cjs',
  'tests/86chaos-release-gate/40-validator-line-ending-safety.spec.cjs',
  'tests/86chaos-release-gate/41-auto-provision-role-env.spec.cjs',
  'tests/86chaos-release-gate/42-merged-17-0-30-parity.spec.cjs',
  'tests/86chaos-release-gate/43-restaurant-readiness-command-center.spec.cjs',
  'tests/86chaos-release-gate/44-device-local-reminders.spec.cjs',
  'tests/86chaos-release-gate/45-firebase-admin-url-api.spec.cjs',
  'tests/86chaos-release-gate/46-firebase-admin-runtime-module-load.spec.cjs',
  'tests/86chaos-release-gate/47-reminder-mobile-runtime-recovery.spec.cjs',
  'tests/86chaos-release-gate/48-needs-attention-readiness-2.spec.cjs',
  'tests/86chaos-release-gate/49-restaurant-intelligence-review-boundaries.spec.cjs',
  'tests/86chaos-release-gate/50-purchase-reconciliation-browser.spec.cjs',
  'tests/86chaos-release-gate/51-security-cost-observability.spec.cjs',
  'tests/86chaos-release-gate/52-listener-route-cleanup.spec.cjs',
  'tests/86chaos-release-gate/53-reminder-voice-lifecycle.spec.cjs',
  'tests/86chaos-release-gate/54-emergency-schedule-requestoff.spec.cjs',
  'tests/86chaos-release-gate/55-full-surface-traceability.spec.cjs',
  'tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs',
  'tests/86chaos-release-gate/57-sticky-header-touch-handoff.spec.cjs',
  'tests/86chaos-release-gate/58-testing-gate-17-0-43.spec.cjs',
  'tests/86chaos-release-gate/60-customer-help-version-17-0-45.spec.cjs',
  'tests/86chaos-release-gate/61-release-gate-surgical-repairs-17-0-46.spec.cjs',
  'tests/86chaos-release-gate/63-testing-deployment-identity-file-reader-17-0-49.spec.cjs',
  'tests/86chaos-release-gate/64-system-admin-recovery-boundary-17-0-51.spec.cjs',
  'tests/86chaos-release-gate/65-system-admin-firebase-cost-runtime-17-0-52.spec.cjs',
  'tests/86chaos-release-gate/67-firebase-emulator-cra-build-17-0-55.spec.cjs',
  'tests/86chaos-release-gate/68-firebase-emulator-entry-import-17-0-56.spec.cjs',
  'tests/86chaos-release-gate/69-yardmaster-firebase-bridge-17-0-57.spec.cjs',
  'tests/86chaos-release-gate/70-release-gate-emulator-target-coherence-17-0-58.spec.cjs',
  'tests/86chaos-release-gate/71-release-gate-staleness-manifest-17-0-59.spec.cjs',
  'tests/86chaos-release-gate/72-release-gate-source-inventory-17-0-60.spec.cjs',
  'tests/86chaos-release-gate/73-release-gate-ignored-local-source-17-0-61.spec.cjs',
  'tests/86chaos-release-gate/74-release-gate-root-source-archive-17-0-62.spec.cjs',
  'tests/86chaos-release-gate/75-yardmaster-readiness-bootstrap-17-0-63.spec.cjs',
  'tests/86chaos-release-gate/76-emulator-runtime-boundaries-17-0-64.spec.cjs',
  'tests/86chaos-release-gate/77-release-gate-lineage-title-migration-17-0-65.spec.cjs',
  'tests/86chaos-release-gate/78-release-gate-lineage-suite-prefix-17-0-66.spec.cjs',
  'tests/86chaos-release-gate/79-runtime-isolation-csp-sticky-a11y-17-0-67.spec.cjs',
  'tests/86chaos-release-gate/80-failed-new-evidence-17-0-68.spec.cjs',
  'tests/86chaos-release-gate/81-source-manifest-authority-17-0-69.spec.cjs',
  'tests/86chaos-release-gate/82-release-gate-hostile-fixture-manifest-17-0-70.spec.cjs',
  'tests/86chaos-release-gate/83-failed-only-manifest-emulator-target-17-0-71.spec.cjs',
  'tests/86chaos-release-gate/84-failed-only-manifest-reporter-independence-17-0-72.spec.cjs',
  'tests/86chaos-release-gate/85-failed-only-repair-selection-emulator-target-17-0-73.spec.cjs',
  'tests/86chaos-release-gate/86-partial-run-evidence-emulator-target-17-0-74.spec.cjs',
  'tests/86chaos-release-gate/87-qa-role-emulator-target-17-0-75.spec.cjs',
  'tests/86chaos-release-gate/88-ghost-request-off-selector-17-0-76.spec.cjs',
  'tests/86chaos-release-gate/89-server-certification-drift-17-0-77.spec.cjs',
  'tests/86chaos-release-gate/90-emulator-playwright-fidelity-17-0-78.spec.cjs',
  'tests/86chaos-release-gate/91-emulator-runtime-equivalent-baseline-17-0-79.spec.cjs',
  'tests/86chaos-release-gate/92-failure-lineage-baseline-17-0-80.spec.cjs',
  'tests/86chaos-release-gate/93-lazy-chunk-interception-17-0-81.spec.cjs',
  'tests/86chaos-release-gate/94-failed-new-lineage-repair-17-0-82.spec.cjs',
  'tests/86chaos-release-gate/95-request-off-maturity-refactor-17-0-83.spec.cjs',
  'tests/86chaos-release-gate/96-owned-full-fidelity-17-0-84.spec.cjs',
]);

const PWA_SPEC_PATTERN = /86chaos-release-gate\/(26-pwa-icon-source-deployed-parity|27-pwa-browser-icon-matrix|66-firebase-emulator-bridge-17-0-54|70-release-gate-emulator-target-coherence-17-0-58)\.spec\.cjs/;
const RUNTIME_COVERAGE_PATTERN = /21-runtime-code-coverage\.spec\.cjs|runtime-code-coverage/i;

function normalizeSpecPath(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^tests\//, 'tests/');
}

function specIsInReleaseUniverse(specPath = '') {
  const normalized = normalizeSpecPath(specPath);
  if (!normalized.startsWith('tests/')) return false;
  return RELEASE_TEST_MATCH.some(pattern => {
    const prefix = `tests/${String(pattern).replace('/**/*.spec.cjs', '')}`;
    return normalized.startsWith(prefix.replace(/\*\*$/,''));
  });
}

module.exports = {
  RELEASE_TEST_MATCH,
  RELEASE_CRITICAL_SPECS,
  PWA_SPEC_PATTERN,
  RUNTIME_COVERAGE_PATTERN,
  normalizeSpecPath,
  specIsInReleaseUniverse,
};
