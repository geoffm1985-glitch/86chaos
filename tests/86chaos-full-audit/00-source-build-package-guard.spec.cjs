const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { EXPECTED_VERSION, attachJson } = require('./utils/audit-helpers.cjs');

test.describe('00 source / build / deploy / package guards', () => {
  test('version files, package-lock, Firebase markers, and known deploy landmines are correct', async ({}, testInfo) => {
    const root = process.cwd();
    const read = (rel) => fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : '';
    const pkg = JSON.parse(read('package.json') || '{}');
    const lock = JSON.parse(read('package-lock.json') || '{}');
    const versionJson = JSON.parse(read('public/version.json') || '{}');
    const appCore = read('src/core/appCore.js');
    const schedule = read('src/features/schedule.jsx');
    const management = read('src/features/management.jsx');
    const modal = read('src/components/Modal.js');
    const all = [appCore, schedule, management, modal, read('src/App.js')].join('\n');
    const failures = [];
    const appVersion = pkg.version;
    const add = (condition, message) => { if (!condition) failures.push(message); };

    add(appVersion === EXPECTED_VERSION, `package.json version ${appVersion} does not match CHAOS_EXPECTED_VERSION ${EXPECTED_VERSION}`);
    add(versionJson.version === appVersion, `public/version.json version ${versionJson.version} does not match ${appVersion}`);
    add(lock.version === appVersion, `package-lock root version ${lock.version} does not match ${appVersion}`);
    add(lock.packages?.['']?.version === appVersion, `package-lock packages[""] version ${lock.packages?.['']?.version} does not match ${appVersion}`);
    add(new RegExp(`CURRENT_VERSION\\s*=\\s*['\"]${String(appVersion || '').replace(/\./g, '\\.')}['\"]`).test(appCore), `CURRENT_VERSION does not match ${appVersion}`);
    add(!/@types\/yargs-[0-9]+\.[0-9]+\.[0-9]+\.tgz/i.test(read('package-lock.json')), 'package-lock contains fake @types/yargs app-version tarball');
    add(!Object.entries(lock.packages || {}).some(([name, meta]) => name && name !== '' && /^node_modules\//.test(name) && String(meta?.version || '') === appVersion && !/86chaos/i.test(name)), 'Nested dependency appears to have the app version');
    for (const marker of ['chaos-test-d1601', 'cheers-34b8d', 'REACT_APP_TEST_FIREBASE_API_KEY', 'REACT_APP_PROD_FIREBASE_API_KEY']) add(all.includes(marker), `Missing Firebase safety marker ${marker}`);
    add(!(/["']private_key["']\s*:\s*["']-----BEGIN/i.test(all)), 'Hardcoded private key value appears in app source');
    add(/INVALID TIME|Invalid time|CHECK TIME RANGE|invalid time/i.test(schedule), 'Schedule Builder should flag invalid time ranges');
    add(/Online Now|Recently Active|Active Today|Last Seen/i.test(management), 'Presence board should split online/recent/active-today/last-seen');
    add(!/id:\s*['"]branding['"]\s*,\s*label:\s*['"]Branding\s*\/\s*Display['"]/i.test(management), 'System Administrator nav should not expose Branding / Display');
    add(/special_event|Events \/ staff up|event/i.test(schedule), 'Schedule Builder should include events row/visibility logic');
        add(/activeElement|focus|keyboard|modal/i.test(modal + schedule), 'Mobile modal input focus protection is not obvious');

    await attachJson(testInfo, '00-source-guard.json', { appVersion, expectedVersion: EXPECTED_VERSION, failures, checkedFiles: ['package.json', 'package-lock.json', 'public/version.json', 'src/core/appCore.js', 'src/features/schedule.jsx', 'src/features/management.jsx', 'src/components/Modal.js'] });
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
