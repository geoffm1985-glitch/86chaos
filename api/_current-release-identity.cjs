'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function assertCurrentReleaseIdentity(root) {
  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
  const json = relative => JSON.parse(read(relative));
  const pkg = json('package.json');
  const lock = json('package-lock.json');
  const publicVersion = json('public/version.json');
  const apiVersion = read('api/_version.js');
  const appCore = read('src/core/appCore.js');
  const escaped = pkg.version.replaceAll('.', '\\.');
  const versionSlug = pkg.version.replaceAll('.', '-');

  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(publicVersion.version, pkg.version);
  assert.equal(publicVersion.build, pkg.version);
  assert.equal(pkg.scripts['test:source'], `node scripts/validate-${versionSlug}.js`);
  assert.ok(fs.existsSync(path.join(root, `scripts/validate-${versionSlug}.js`)));
  assert.match(apiVersion, new RegExp(`APP_VERSION = '${escaped}'`));
  assert.match(apiVersion, new RegExp(`SECURITY_SCHEMA_VERSION = '${escaped}'`));
  assert.match(appCore, new RegExp(`CURRENT_VERSION = '${escaped}'`));
  return pkg.version;
}

module.exports = { assertCurrentReleaseIdentity };
