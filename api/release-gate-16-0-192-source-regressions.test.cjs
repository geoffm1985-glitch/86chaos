'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('workspace switch reuses canonical route transition so schedule resolves schedule-builder query state', () => {
  const source = read('src/App.js');
  assert.match(source, /const transitionActiveTabState = useCallback\(\(nextTab\) => \{[\s\S]*?if \(normalized === 'schedule'\)[\s\S]*?setActiveScheduleSubTab\('schedule-builder'\)/);
  const switchBlock = source.match(/const switchWorkspace = \(workspace\) => \{[\s\S]*?addToast\('Workspace Switched'/)?.[0] || '';
  assert.ok(switchBlock, 'switchWorkspace block must be present');
  assert.match(switchBlock, /const nextDefaultTab = normalizeRouteTab\(nextUser\.preferences\?\.defaultTab \|\| 'today'\);\s*transitionActiveTabState\(nextDefaultTab\);/);
  assert.doesNotMatch(switchBlock, /activeTabStateRef\.current = nextDefaultTab;\s*setActiveTabState\(nextDefaultTab\);/, 'workspace switching must not bypass the canonical transition helper');
});

test('System Administrator read APIs have controlled unexpected-error boundaries without leaking internals', () => {
  const expectations = [
    ['api/system-admin/people.js', 'system-admin-people-failed', 'Could not load people.'],
    ['api/system-admin/people-search.js', 'system-admin-people-search-failed', 'Could not search people.'],
    ['api/system-admin/workspaces.js', 'system-admin-workspaces-failed', 'Could not load workspaces.'],
  ];
  for (const [file, code, message] of expectations) {
    const source = read(file);
    assert.match(source, /if \(req\.method !== 'GET'\) return res\.status\(405\)/, `${file} keeps method guard`);
    assert.match(source, /try \{[\s\S]*authorize\(req, app, \{ allowTenantAdmin: false, allowCrossProjectMaster: true \}\)[\s\S]*\} catch \(error\) \{/s, `${file} wraps authorized read path`);
    assert.match(source, new RegExp(`code: '${code}'`), `${file} returns public failure code`);
    assert.match(source, new RegExp(`error: '${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), `${file} returns public failure message`);
    assert.doesNotMatch(source, /stack\s*:/, `${file} must not return stack traces`);
    assert.doesNotMatch(source, /serviceAccount|privateKey|credential|token\s*:/i, `${file} must not expose secret-shaped fields`);
  }
});

test('failed release-gate harness source corrections are narrow and preserve real assertions', () => {
  const routeMatrix = read('scripts/86chaos-release-gate/route-access-matrix.cjs');
  assert.match(routeMatrix, /staff:\s*\[[^\]]*'hr-training'[^\]]*\]/s, 'staff route matrix allows published HR & Training route');

  const fakeProfile = read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs');
  assert.match(fakeProfile, /const fixture = buildAuditScheduleFixture\(today\);[\s\S]*validAllenCurrentWeekShifts[\s\S]*employeeName !== 'Allen QA'[\s\S]*date !== tomorrowStr/s, 'Allen request-off fixture derives from a valid seeded Allen shift distinct from Sara conflict date');
  assert.match(fakeProfile, /QA fixture requires a valid Allen QA shift date distinct from Sara QA conflict date\./, 'fixture fails closed instead of seeding contradictory request-off data');

  const helpers = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
  assert.match(helpers, /\\bInvalid Date\\b\(\?!s\)/, 'broken-value detector still catches literal Invalid Date but not normal invalid dates prose');
});
