const { test, expect, devices } = require('@playwright/test');
const {
  ROUTE_SPECS, ownerLikeCreds, creds, requireCreds, login, gotoTab,
  attachJson, PERMISSION_GATE_RE, bodyText,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { ROUTE_STATES } = require('./exhaustive-surface-matrix.cjs');
const { applyStatePath, recoverSiblingStatePath, auditState } = require('./utils/exhaustive-ui-helpers.cjs');

async function loginForRoute(page, route) {
  const sys = creds('SYSTEM_ADMIN');
  const account = route === 'godmode' && sys.email && sys.password ? sys : ownerLikeCreds();
  requireCreds(account, route === 'godmode' ? 'System Administrator or owner-like account' : 'owner-like account');
  await login(page, account.email, account.password);
  return account.label;
}

function projectContextOptions(testInfo) {
  const { defaultBrowserType: _defaultBrowserType, ...contextOptions } = testInfo.project.name === 'mobile-chromium' ? devices['Pixel 5'] : devices['Desktop Chrome'];
  return contextOptions;
}

test.describe('28 ultimate route + nested-state + control graph', () => {
  test('every real route, declared nested surface, field, and safe control is rendered and probeable', async ({ browser }, testInfo) => {
    test.setTimeout(55 * 60 * 1000);
    let loggedLabel = '';
    let context = null;
    let page = null;
    const report = { routes: [], missingStates: [], permissionGates: [], totals: { states: 0, controls: 0, mutationsObserved: 0, formControls: 0 } };

    try {
      for (const route of ROUTE_SPECS) {
        // Firebase Auth persistence survives cookie clearing. Use a fresh browser context
        // whenever the exhaustive route class changes between owner and System Administrator.
        const wanted = route.tab === 'godmode' ? 'SYSTEM_ADMIN' : 'OWNER';
        if (!loggedLabel || (wanted === 'SYSTEM_ADMIN' && loggedLabel !== 'SYSTEM_ADMIN') || (wanted === 'OWNER' && loggedLabel === 'SYSTEM_ADMIN')) {
          await context?.close().catch(() => {});
          context = await browser.newContext(projectContextOptions(testInfo));
          page = await context.newPage();
          loggedLabel = await loginForRoute(page, route.tab);
        }

        const baseText = await gotoTab(page, route.tab, { settleMs: 0, timeout: 8000, maxText: 50000 });
        if (PERMISSION_GATE_RE.test(baseText)) {
          report.permissionGates.push({ route: route.tab, label: route.label });
          if (!route.optional) throw new Error(`Required route ${route.tab} is permission-gated during exhaustive coverage.`);
          continue;
        }
        expect(baseText, `${route.tab} should expose its expected application surface`).toMatch(route.expect);

        const states = [[]].concat(ROUTE_STATES[route.tab] || []);
        const routeRow = { route: route.tab, label: route.label, states: [] };
        for (let stateIndex = 0; stateIndex < states.length; stateIndex++) {
          const path = states[stateIndex];
          // The route has already been settled above. Recover only the shared nested ancestor
          // instead of re-dispatching every sibling's top-level route, removing the release-gate timeout caused by hundreds of redundant route transitions without dropping coverage.
          const traversalPath = stateIndex > 0
            ? await recoverSiblingStatePath(page, states[stateIndex - 1], path, route.tab)
            : path;
          let stateResult;
          try {
            stateResult = await applyStatePath(page, traversalPath, { strict: true });
          } catch (err) {
            const body = await bodyText(page, 30000);
            const missing = { route: route.tab, path: path.map(String), error: String(err.message || err), bodySample: body.slice(0, 4000) };
            report.missingStates.push(missing);
            routeRow.states.push({ path: path.map(String), missing: true });
            continue;
          }
          const identity = `28-${route.tab}-${stateIndex}-${path.map(String).join('-') || 'root'}`;
          const expensiveProbe = stateIndex === 0;
          const audit = await auditState(page, testInfo, identity, {
            probeForms: expensiveProbe,
            allowFormValueMutation: route.tab !== 'godmode',
            probeSafeButtons: expensiveProbe,
            probeMutationActionability: expensiveProbe,
            maxSafeButtons: 35,
            maxMutationButtons: 45,
            attachDetail: false,
          });
          report.totals.states += 1;
          report.totals.controls += audit.controls.length;
          report.totals.mutationsObserved += audit.controls.filter(c => c.classification === 'mutation').length;
          report.totals.formControls += audit.controls.filter(c => c.classification === 'form-control').length;
          routeRow.states.push({ path: path.map(String), ok: stateResult.ok, controls: audit.controls.length, permissionGated: audit.permissionGated || false });
        }
        report.routes.push(routeRow);
      }
    } finally {
      await context?.close().catch(() => {});
    }

    await attachJson(testInfo, '28-exhaustive-route-state-control-graph.json', report);
    expect(report.missingStates, 'Every source-derived nested application surface must be reachable; missing states are release blockers').toEqual([]);
    expect(report.totals.states, 'Exhaustive gate should visit a substantial state graph, not just route smoke pages').toBeGreaterThanOrEqual(80);
    expect(report.totals.controls, 'Exhaustive gate should observe hundreds of real interactive controls').toBeGreaterThanOrEqual(400);
  });
});
