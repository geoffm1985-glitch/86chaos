const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('Play Store regression: READY deployment cannot expose a stale release identity', async ({ request }, testInfo) => {
  const root = process.cwd();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const publicVersion = JSON.parse(fs.readFileSync(path.join(root, 'public/version.json'), 'utf8'));
  const client = fs.readFileSync(path.join(root, 'src/core/appCore.js'), 'utf8');
  const apiVersion = fs.readFileSync(path.join(root, 'api/_version.js'), 'utf8');

  expect(publicVersion.version).toBe(pkg.version);
  expect(publicVersion.build).toBe(pkg.version);
  expect(client).toContain(`CURRENT_VERSION = '${pkg.version}'`);
  expect(apiVersion).toContain(`APP_VERSION = '${pkg.version}'`);

  const [versionResponse, buildResponse] = await Promise.all([
    request.get('/version.json', { failOnStatusCode: false }),
    request.get('/build-identity.json', { failOnStatusCode: false })
  ]);
  expect(versionResponse.ok()).toBe(true);
  expect(buildResponse.ok()).toBe(true);
  const deployedVersion = await versionResponse.json();
  const buildIdentity = await buildResponse.json();
  await testInfo.attach('07-release-identity-play-store.json', {
    body: JSON.stringify({ sourceVersion: pkg.version, deployedVersion, buildIdentity: { version: buildIdentity.version, commit: buildIdentity.commit, sourceHash: buildIdentity.sourceHash } }, null, 2),
    contentType: 'application/json'
  });
  expect(deployedVersion.version).toBe(pkg.version);
  expect(deployedVersion.build).toBe(pkg.version);
  expect(buildIdentity.version).toBe(pkg.version);
  expect(String(buildIdentity.commit || '')).toMatch(/^[0-9a-f]{40}$/i);
});
