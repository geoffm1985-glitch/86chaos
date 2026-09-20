'use strict';

const fs = require('fs');
const path = require('path');

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}
function readText(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function versionDash(version = '') { return String(version).replace(/\./g, '-'); }
function extract(source, re, label, errors) {
  const match = String(source || '').match(re);
  if (!match) {
    errors.push(`Unable to read ${label}.`);
    return '';
  }
  return match[1];
}

function validateCurrentReleaseMetadata(root = process.cwd()) {
  const errors = [];
  let pkg = {};
  let lock = {};
  let publicVersion = {};
  try { pkg = readJson(root, 'package.json'); } catch (error) { errors.push(`package.json: ${error.message}`); }
  try { lock = readJson(root, 'package-lock.json'); } catch (error) { errors.push(`package-lock.json: ${error.message}`); }
  try { publicVersion = readJson(root, 'public/version.json'); } catch (error) { errors.push(`public/version.json: ${error.message}`); }
  const version = String(pkg.version || '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) errors.push(`package.json version is invalid: ${version || '<missing>'}`);
  if (String(lock.version || '') !== version) errors.push(`package-lock.json version ${lock.version || '<missing>'} does not match ${version}.`);
  if (String(lock.packages?.['']?.version || '') !== version) errors.push(`package-lock root version ${lock.packages?.['']?.version || '<missing>'} does not match ${version}.`);
  if (String(publicVersion.version || '') !== version) errors.push(`public/version.json version ${publicVersion.version || '<missing>'} does not match ${version}.`);
  if (String(publicVersion.build || '') !== version) errors.push(`public/version.json build ${publicVersion.build || '<missing>'} does not match ${version}.`);
  if (!String(publicVersion.releaseTitle || '').trim()) errors.push('public/version.json releaseTitle is missing.');

  let apiVersion = '';
  let appCore = '';
  try { apiVersion = readText(root, 'api/_version.js'); } catch (error) { errors.push(`api/_version.js: ${error.message}`); }
  try { appCore = readText(root, 'src/core/appCore.js'); } catch (error) { errors.push(`src/core/appCore.js: ${error.message}`); }
  const apiAppVersion = extract(apiVersion, /APP_VERSION\s*=\s*['"]([^'"]+)['"]/, 'api APP_VERSION', errors);
  const securitySchemaVersion = extract(apiVersion, /SECURITY_SCHEMA_VERSION\s*=\s*['"]([^'"]+)['"]/, 'SECURITY_SCHEMA_VERSION', errors);
  const coreVersion = extract(appCore, /CURRENT_VERSION\s*=\s*['"]([^'"]+)['"]/, 'CURRENT_VERSION', errors);
  if (apiAppVersion && apiAppVersion !== version) errors.push(`api APP_VERSION ${apiAppVersion} does not match ${version}.`);
  if (securitySchemaVersion && securitySchemaVersion !== version) errors.push(`SECURITY_SCHEMA_VERSION ${securitySchemaVersion} does not match ${version}.`);
  if (coreVersion && coreVersion !== version) errors.push(`CURRENT_VERSION ${coreVersion} does not match ${version}.`);

  const expectedValidator = `node scripts/validate-${versionDash(version)}.js`;
  if (String(pkg.scripts?.['test:source'] || '') !== expectedValidator) {
    errors.push(`package test:source must be ${expectedValidator}, got ${pkg.scripts?.['test:source'] || '<missing>'}.`);
  }
  const validatorPath = path.join(root, `scripts/validate-${versionDash(version)}.js`);
  if (!fs.existsSync(validatorPath)) errors.push(`Current validator is missing: ${path.relative(root, validatorPath).replace(/\\/g, '/')}.`);
  const releaseNotePath = path.join(root, `RELEASE_${version.replace(/\./g, '_')}.md`);
  if (!fs.existsSync(releaseNotePath)) errors.push(`Current release note is missing: ${path.basename(releaseNotePath)}.`);

  return {
    ok: errors.length === 0,
    version,
    releaseTitle: String(publicVersion.releaseTitle || ''),
    expectedValidator,
    errors,
    values: {
      packageVersion: String(pkg.version || ''),
      lockVersion: String(lock.version || ''),
      lockRootVersion: String(lock.packages?.['']?.version || ''),
      publicVersion: String(publicVersion.version || ''),
      publicBuild: String(publicVersion.build || ''),
      apiAppVersion,
      securitySchemaVersion,
      coreVersion,
      testSource: String(pkg.scripts?.['test:source'] || ''),
    },
  };
}

module.exports = { validateCurrentReleaseMetadata, versionDash };
