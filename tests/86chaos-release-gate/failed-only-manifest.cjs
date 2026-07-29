const FAILED_ONLY_TESTS = [
  { spec: '86chaos-full-audit/01-auth-route-health.spec.cjs', title: 'owner-like account logs in and every major route renders without fatal UI, NaN, Invalid Date, or 5xx', projects: ['chromium'] },
  { spec: '86chaos-full-audit/01-auth-route-health.spec.cjs', title: 'no route shows unresolved placeholders or app-breaking empty states', projects: ['chromium'] },
  { spec: '86chaos-full-audit/02-permission-role-security.spec.cjs', title: 'manager account does not see system admin unless explicitly configured as admin', projects: ['chromium'] },
  { spec: '86chaos-full-audit/03-safe-button-crawl.spec.cjs', title: 'safe visible buttons across every major tab do not crash or poison the next route', projects: ['chromium'] },
  { spec: '86chaos-full-audit/04-schedule-math-oracle.spec.cjs', title: 'if fake restaurant seed exists, visible Schedule Builder text must expose seeded staff/events and not hide invalid-time evidence', projects: ['chromium'] },
  { spec: '86chaos-full-audit/05-schedule-builder-mutation.spec.cjs', title: 'fake QA schedule seed has one-target-only data: no wrong-employee duplicate and exact IDs for deletion audits', projects: ['chromium'] },
  { spec: '86chaos-full-audit/05-schedule-builder-mutation.spec.cjs', title: 'Schedule Builder shows seeded employees without row-index corruption after navigation/refresh', projects: ['chromium'] },
  { spec: '86chaos-full-audit/14-export-import-regression-graveyard.spec.cjs', title: 'known bug graveyard stays dead: no AppleWebKit, fake dependency, preview mic label, broken presence/math strings, or bad System Admin label', projects: ['chromium'] },
  { spec: '86chaos-release-gate/00-qa-restaurant-lifecycle.spec.cjs', title: 'creates the exact cleanup-compatible restaurant and attaches all release roles', projects: ['chromium'] },
  { spec: '86chaos-release-gate/00-qa-restaurant-lifecycle.spec.cjs', title: 'System Administrator exposes the matching Platform Operations cleanup tool', projects: ['chromium'] },
  { spec: '86chaos-release-gate/15-interactive-control-census.spec.cjs', title: 'every visible control has an accessible name and every mutating control is explicitly covered', projects: ['chromium', 'mobile-chromium'] },
  { spec: '86chaos-release-gate/16-accessibility-release-gate.spec.cjs', title: 'every major route has zero serious or critical axe violations', projects: ['chromium', 'mobile-chromium'] },
  { spec: '86chaos-release-gate/16-accessibility-release-gate.spec.cjs', title: 'forms expose labels, errors, keyboard focus, and no keyboard traps', projects: ['chromium', 'mobile-chromium'] },
  { spec: '86chaos-release-gate/17-resilience-chunk-offline.spec.cjs', title: 'one failed lazy chunk never leaves a permanent blank screen or reload loop', projects: ['chromium'] },
  { spec: '86chaos-release-gate/20-firebase-cost-idempotency.spec.cjs', title: 'opening and reopening unchanged routes does not create write storms or duplicate listener churn', projects: ['chromium'] },
  { spec: '86chaos-release-gate/21-runtime-code-coverage.spec.cjs', title: 'route and safe-interaction crawl executes the required share of shipped application JavaScript', projects: ['chromium'] },
  { spec: '86chaos-release-gate/22-security-headers-input-fuzz.spec.cjs', title: 'visible non-password text fields tolerate Unicode, SQL-like text, XSS text, and long input without crashing before submit', projects: ['chromium'] },
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function specsFromManifest(manifest = FAILED_ONLY_TESTS) {
  return [...new Set(manifest.map(item => item.spec))].sort();
}

function grepFromManifest(manifest = FAILED_ONLY_TESTS) {
  const titles = [...new Set(manifest.map(item => item.title))];
  if (!titles.length) return /$a/;
  return new RegExp(titles.map(title => `(?:^|.* > )${escapeRegExp(title)}$`).join('|'));
}

function projectUsesTest(projectName, title) {
  const item = FAILED_ONLY_TESTS.find(row => row.title === title);
  return !item || item.projects.includes(projectName);
}

module.exports = { FAILED_ONLY_TESTS, specsFromManifest, grepFromManifest, projectUsesTest };
