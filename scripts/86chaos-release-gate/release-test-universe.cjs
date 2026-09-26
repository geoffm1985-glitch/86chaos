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
]);

const PWA_SPEC_PATTERN = /86chaos-release-gate\/(26-pwa-icon-source-deployed-parity|27-pwa-browser-icon-matrix)\.spec\.cjs/;
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
