'use strict';
const { test, expect } = require('@playwright/test');
const pkg = require('../../package.json');
const { ownerLikeCreds, login, gotoTab, dismissBlockingDialogs } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
function promotionScenarios() {
  test('client and API serve the same promoted testing candidate', async ({request,baseURL}) => {
    const [clientResponse,apiResponse] = await Promise.all([request.get('/build-identity.json'),request.get('/api/build-identity')]);
    expect(clientResponse.status()).toBe(200); expect(apiResponse.status()).toBe(200);
    const client = await clientResponse.json(), api = await apiResponse.json();
    expect(client.version).toBe(pkg.version); expect(api.version).toBe(pkg.version);
    expect(client.branch).toBe('testing'); expect(api.gitBranch).toBe('testing');
    expect(client.commit).toMatch(/^[a-f0-9]{40}$/); expect(api.gitCommit).toBe(client.commit);
    expect(client.sourceHash).toMatch(/^[a-f0-9]{64}$/); expect(api.sourceManifestHash).toBe(client.sourceHash);
    expect(client.identityStampStatus).toBe('verified');
    const local = ['127.0.0.1','localhost'].includes(new URL(baseURL).hostname);
    expect(client.firebaseTestingProject).toBe(local ? 'demo-86chaos' : 'chaos-test-d1601');
    if (process.env.CHAOS_EXPECTED_GIT_COMMIT) expect(client.commit).toBe(process.env.CHAOS_EXPECTED_GIT_COMMIT);
  });
  test('authenticated promoted Schedule Builder retains its workflow without startup crashes', async ({page,baseURL}) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const creds = ownerLikeCreds(); expect(Boolean(creds.email && creds.password),'Owner/manager credentials are required for baseline acceptance').toBe(true);
    await login(page,creds.email,creds.password);
    await gotoTab(page,'schedule-builder'); await dismissBlockingDialogs(page);
    await expect(page.getByTestId('schedule-builder-sticky-day-header')).toBeVisible();
    const expectedProject = ['127.0.0.1','localhost'].includes(new URL(baseURL).hostname) ? 'demo-86chaos' : 'chaos-test-d1601';
    await expect.poll(() => page.evaluate(() => window.__CHAOS_FIREBASE_DIAGNOSTICS__?.projectId)).toBe(expectedProject);
    await expect(page.getByTestId('testing-environment')).toHaveText(expectedProject === 'demo-86chaos' ? 'LOCAL EMULATOR' : 'TESTING');
    await expect(page.locator('body')).not.toContainText('Firebase environment boundary mismatch');
    expect(errors).toEqual([]);
  });
  test('testing API cannot use a production-project bearer token', async ({request}) => {
    const token = ['e30',Buffer.from(JSON.stringify({aud:'cheers-34b8d',iss:'https://securetoken.google.com/cheers-34b8d',sub:'unauthorized-environment-probe'})).toString('base64url'),'invalid-signature'].join('.');
    const response = await request.post('/api/safe-write',{headers:{authorization:`Bearer ${token}`},data:{action:'shift-change-list',restaurantId:'unauthorized-environment-probe'}});
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
    expect((await response.json()).ok).toBe(false);
  });
}
module.exports = { promotionScenarios };
