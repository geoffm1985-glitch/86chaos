const { test, expect } = require('@playwright/test');
const {
  ROUTE_SPECS, ownerLikeCreds, creds, requireCreds, login, gotoTab,
  attachJson, PERMISSION_GATE_RE, bodyText,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { ROUTE_STATES } = require('./exhaustive-surface-matrix.cjs');
const { applyStatePath, auditState } = require('./utils/exhaustive-ui-helpers.cjs');

async function loginForRoute(page, route) {
  const sys = creds('SYSTEM_ADMIN');
  const account = route === 'godmode' && sys.email && sys.password ? sys : ownerLikeCreds();
  requireCreds(account, route === 'godmode' ? 'System Administrator or owner-like account' : 'owner-like account');
  await login(page, account.email, account.password);
  return account.label;
}

test.describe('28 ultimate route + nested-state + control graph', () => {
  test('every real route, declared nested surface, field, and safe control is rendered and probeable', async ({ page }, testInfo) => {
    test.setTimeout(70 * 60 * 1000);
    let loggedLabel = '';
    const report = { routes: [], missingStates: [], permissionGates: [], totals: { states: 0, controls: 0, mutationsObserved: 0, formControls: 0 } };

    for (const route of ROUTE_SPECS) {
      // GodMode needs the dedicated platform account. Re-auth only when the credential class changes.
      const wanted = route.tab === 'godmode' ? 'SYSTEM_ADMIN' : 'OWNER';
      if (!loggedLabel || (wanted === 'SYSTEM_ADMIN' && loggedLabel !== 'SYSTEM_ADMIN') || (wanted === 'OWNER' && loggedLabel === 'SYSTEM_ADMIN')) {
        await page.context().clearCookies().catch(() => {});
        await page.goto('about:blank');
        loggedLabel = await loginForRoute(page, route.tab);
      }

      const baseText = await gotoTab(page, route.tab, { settleMs: 1200, maxText: 50000 });
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
        // The route has already been settled above. Walk declared sibling/nested states from the rendered route
        // instead of re-dispatching the same top-level route before every state; this preserves coverage while
        // removing the release-gate timeout caused by hundreds of redundant route transitions.
        let stateResult;
        try {
          stateResult = await applyStatePath(page, path, { strict: true });
        } catch (err) {
          const body = await bodyText(page, 30000);
          const missing = { route: route.tab, path: path.map(String), error: String(err.message || err), bodySample: body.slice(0, 4000) };
          report.missingStates.push(missing);
          routeRow.states.push({ path: path.map(String), missing: true });
          continue;
        }
        const identity = `28-${route.tab}-${stateIndex}-${path.map(String).join('-') || 'root'}`;
        const audit = await auditState(page, testInfo, identity, {
          probeForms: true,
          allowFormValueMutation: route.tab !== 'godmode',
          probeSafeButtons: stateIndex === 0 || path.length > 0,
          maxSafeButtons: 100,
        });
        report.totals.states += 1;
        report.totals.controls += audit.controls.length;
        report.totals.mutationsObserved += audit.controls.filter(c => c.classification === 'mutation').length;
        report.totals.formControls += audit.controls.filter(c => c.classification === 'form-control').length;
        routeRow.states.push({ path: path.map(String), ok: stateResult.ok, controls: audit.controls.length, permissionGated: audit.permissionGated || false });
      }
      report.routes.push(routeRow);
    }

    await attachJson(testInfo, '28-exhaustive-route-state-control-graph.json', report);
    expect(report.missingStates, 'Every source-derived nested application surface must be reachable; missing states are release blockers').toEqual([]);
    expect(report.totals.states, 'Exhaustive gate should visit a substantial state graph, not just route smoke pages').toBeGreaterThanOrEqual(80);
    expect(report.totals.controls, 'Exhaustive gate should observe hundreds of real interactive controls').toBeGreaterThanOrEqual(400);
  });
});
