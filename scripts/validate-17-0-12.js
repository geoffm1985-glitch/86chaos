'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
assert.equal(pkg.version, '17.0.12');
assert.equal(lock.version, '17.0.12');
assert.equal(lock.packages[''].version, '17.0.12');
assert.equal(version.version, '17.0.12');
assert.equal(version.build, '17.0.12');
assert.equal(pkg.scripts['validate:17.0.12'], 'node scripts/validate-17-0-12.js');
assert.match(pkg.scripts['test:repair:17.0.12'], /schedule-publish-17-0-12\.test\.cjs/);
assert.match(pkg.scripts['test:repair:17.0.12'], /pwa-firefox-retry-17-0-12\.test\.cjs/);

for (const file of ['src/core/appCore.js', 'api/_version.js', 'api/_pos-bridge-config.js']) {
  assert(read(file).includes("'17.0.12'"), `${file} carries 17.0.12`);
}
const planner = read('src/core/scheduleQueryPlanner.js');
assert.match(planner, /return wanted && \(!actual \|\| wanted !== actual\);/);
assert.doesNotMatch(planner, /const missingRequired = \['scheduleUserId', 'employeeId', 'rosterUserId', 'employeeName', 'assignedName'\]/);
for (const file of ['playwright.play-store-release.config.cjs', 'playwright.failed-release.config.cjs']) {
  const source = read(file);
  assert.match(source, /\{ name: 'firefox-pwa', retries: 1,/);
}
assert(fs.existsSync('api/schedule-publish-17-0-12.test.cjs'));
assert(fs.existsSync('api/pwa-firefox-retry-17-0-12.test.cjs'));
console.log('17.0.12 precision repair validation passed; this is targeted validation, not full release certification.');
