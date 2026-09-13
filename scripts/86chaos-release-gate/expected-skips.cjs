'use strict';

const { expectedRoutesForRole } = require('./route-access-matrix.cjs');

const RESPONSIVE_FILE = '86chaos-release-gate/31-exhaustive-responsive-nested-layout.spec.cjs';
const RESPONSIVE_SUITE = '31 exhaustive responsive layout across nested states';
const RESPONSIVE_LEAF = 'every route and nested surface fits phone/tablet/laptop/desktop without unusable overflow or tap targets';
const RESPONSIVE_REASON = 'Responsive matrix is executed once from Chromium and creates its own viewport contexts.';
const VIEWPORTS = Object.freeze(['narrow-phone', 'phone', 'tablet', 'laptop', 'desktop']);
const AUTH_FILE = 'e2e/authenticated-release.spec.cjs';
const DENIED_LEAF = 'direct navigation follows the canonical denied-route matrix';
const PERMITTED_LEAF = 'opens every permitted primary surface without runtime or layout failure';
const ADMIN_REASON = 'system-admin has no denied primary routes in the canonical matrix';

function skipDefinition(row = {}) {
  const identity = { file: row.file, title: row.title, projectName: row.projectName };
  const viewport = VIEWPORTS.find(name => row.title === `${RESPONSIVE_SUITE} > ${RESPONSIVE_LEAF} [${name}]`);
  if (row.file === RESPONSIVE_FILE && row.projectName === 'mobile-chromium' && viewport) {
    return { reason: RESPONSIVE_REASON, coverage: [{ ...identity, projectName: 'chromium' }] };
  }
  if (row.file === AUTH_FILE && ['chromium', 'mobile-chromium'].includes(row.projectName)
    && row.title === `system-admin authenticated release surfaces > ${DENIED_LEAF}`) {
    return { reason: ADMIN_REASON, systemAdmin: true, coverage: [
      { ...identity, title: `system-admin authenticated release surfaces > ${PERMITTED_LEAF}` },
      ...['owner', 'manager', 'staff'].map(role => ({ ...identity, title: `${role} authenticated release surfaces > ${DENIED_LEAF}` })),
    ] };
  }
  return { reason: '', coverage: [] };
}

// Selection can include these companions; only validateReleaseSkips can accept
// a skip, using real annotations and real passed results from the current run.
function requiredSkipCoverage(row) { return skipDefinition(row).coverage; }

// The collector supplies its existing normalized spec paths and full suite titles.
// These are the seven intentional cases already declared by the existing specs.
// A reason alone never authorizes a skip: its exact identity and current-run
// companion coverage must agree. New or unexplained skips remain blockers.
function validateReleaseSkips(results = [], { systemAdminRoutes = expectedRoutesForRole('system-admin') } = {}) {
  const expected = [];
  const unexpected = [];
  const seen = new Set();
  const reference = row => ({ file: row.file, title: row.title, projectName: row.projectName });
  const same = (a, b) => a.file === b.file && a.title === b.title && a.projectName === b.projectName;
  const passed = target => {
    const attempts = results.filter(row => same(row, target));
    return attempts.length > 0 && attempts.every(row => row.status === 'passed');
  };
  for (const row of results.filter(result => result.status === 'skipped')) {
    const identity = reference(row);
    const key = JSON.stringify(identity);
    let reason = '';
    let coverage = [];
    let problem = '';
    const definition = skipDefinition(row);
    reason = definition.reason;
    coverage = definition.coverage;
    if (!reason) problem = 'This skipped test is not an approved duplicate or non-applicable case.';
    else if (definition.systemAdmin && (!Array.isArray(systemAdminRoutes) || !systemAdminRoutes.length || systemAdminRoutes.some(route => route.directNavigationAllowed !== true))) {
      problem = 'The canonical System Administrator matrix has denied or unknown routes.';
    }
    if (seen.has(key)) problem = 'This intentional skip identity occurred more than once.';
    seen.add(key);
    if (!problem && !(row.annotations || []).some(annotation => annotation.type === 'skip' && annotation.description === reason)) {
      problem = 'The recorded skip reason does not match the existing test condition.';
    }
    const missingCoverage = coverage.filter(target => !passed(target));
    if (!problem && missingCoverage.length) problem = 'Required companion coverage did not pass in this run.';
    if (problem) unexpected.push({ ...identity, reason: problem, missingCoverage });
    else expected.push({ ...identity, reason, coverage });
  }
  return { ok: unexpected.length === 0, expected, unexpected };
}

module.exports = { validateReleaseSkips, requiredSkipCoverage };
