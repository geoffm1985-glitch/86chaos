const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));

test.describe('38 release identity deployment parity release gate', () => {
  test('local release identity is synchronized across package, client, API, Help, and public metadata', async ({}, testInfo) => {
    const pkg = json('package.json');
    const lock = json('package-lock.json');
    const version = json('public/version.json');
    const checks = {
      packageLock: lock.version === pkg.version && lock.packages?.['']?.version === pkg.version,
      publicVersion: version.version === pkg.version && version.build === pkg.version,
      clientVersion: read('src/core/appCore.js').includes(`CURRENT_VERSION = '${pkg.version}'`),
      apiVersion: read('api/_version.js').includes(`APP_VERSION = '${pkg.version}'`) && read('api/_version.js').includes(`SECURITY_SCHEMA_VERSION = '${pkg.version}'`),
      helpJs: read('src/core/customerHelpKnowledge.js').includes(`CUSTOMER_HELP_VERSION = '${pkg.version}'`),
      helpCjs: read('src/core/customerHelpKnowledge.cjs').includes(`CUSTOMER_HELP_VERSION = '${pkg.version}'`)
    };
    await testInfo.attach('38-release-identity-local-parity.json', { body: JSON.stringify({ version: pkg.version, checks }, null, 2), contentType: 'application/json' });
    expect(Object.entries(checks).filter(([, ok]) => !ok)).toEqual([]);
  });

  test('deployed metadata presents the same release version as source', async ({ request }, testInfo) => {
    const pkg = json('package.json');
    const [versionResponse, identityResponse] = await Promise.all([
      request.get('/version.json', { failOnStatusCode: false }),
      request.get('/build-identity.json', { failOnStatusCode: false })
    ]);
    expect(versionResponse.ok()).toBe(true);
    expect(identityResponse.ok()).toBe(true);
    const version = await versionResponse.json();
    const identity = await identityResponse.json();
    await testInfo.attach('38-release-identity-deployed-parity.json', { body: JSON.stringify({ sourceVersion: pkg.version, deployedVersion: version.version, buildVersion: identity.version, commit: identity.commit }, null, 2), contentType: 'application/json' });
    expect(version.version).toBe(pkg.version);
    expect(version.build).toBe(pkg.version);
    expect(identity.version).toBe(pkg.version);
  });
});
