'use strict';
const fs = require('fs');
const path = require('path');
const { writeJson } = require('./run-context.cjs');
const CRITICAL_WORKFLOWS = [
  { category: 'Restaurant invoice-to-menu intelligence', specHint: '36-restaurant-brain', titleHint: 'brutal restaurant scanner E2E' },
  { category: 'Authentication', specHint: '01-auth-route-health', titleHint: 'logs in and every major route renders' },
  { category: 'Major route health', specHint: '01-auth-route-health', titleHint: 'every major route' },
  { category: 'Role boundaries', specHint: '02-permission-role-security', titleHint: 'staff account cannot see' },
  { category: 'Schedule Builder integrity', specHint: '05-schedule-builder-mutation', titleHint: 'Schedule Builder shows seeded employees' },
  { category: 'Request Off conflict warning', specHint: '06-request-off-events-integration', titleHint: 'Request Off' },
  { category: 'Ghost Mode Request Off', specHint: '06-request-off-events-integration', titleHint: 'Ghost Mode Request Off' },
  { category: '86Voice lifecycle', specHint: '11-mobile-desktop-voice-upload', titleHint: '86Voice mic button' },
  { category: 'Chunk recovery', specHint: '17-resilience-chunk-offline', titleHint: 'failed lazy chunk' },
  { category: 'Accessibility', specHint: '16-accessibility-release-gate', titleHint: 'axe violations' },
  { category: 'PWA installability', specHint: '25-pwa-android-installability', titleHint: 'PWA' },
  { category: 'Reminder notification delivery', specHint: '35-reminder-notification-certification', titleHint: 'reminder notification' },
  { category: 'POS Bridge contract boundary', specHint: '06-pos-bridge-contract', titleHint: 'POS Bridge v1 rejects unsupported contracts' },
  { category: 'POS Bridge machine security boundary', specHint: '07-pos-bridge-security', titleHint: 'POS Bridge rejects human and provider tokens' },
  { category: 'PWA icon source parity', specHint: '26-pwa-icon-source-deployed-parity', titleHint: 'source and deployed icon bytes' },
  { category: 'Cross-browser icon matrix', specHint: '27-pwa-browser-icon-matrix', titleHint: 'PWA icon metadata matrix' },
  { category: 'QA cleanup', specHint: 'global-teardown', titleHint: 'QA cleanup' },
];
function buildCriticalInventory({ outputPath='', runId='', sourceVersion='' }={}) {
  const report = { ok: true, generatedAt: new Date().toISOString(), runId, sourceVersion, workflows: CRITICAL_WORKFLOWS };
  if (outputPath) writeJson(outputPath, report);
  return report;
}
if (require.main === module) {
  const out = process.argv[2] || path.join(process.cwd(), 'release-critical-test-inventory.json');
  const report = buildCriticalInventory({ outputPath: out });
  console.log(`Wrote ${report.workflows.length} critical workflow entries -> ${out}`);
}
module.exports = { CRITICAL_WORKFLOWS, buildCriticalInventory };
