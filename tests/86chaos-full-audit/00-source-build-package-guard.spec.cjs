const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { EXPECTED_VERSION, APP_ROOT, attachJson } = require('./utils/audit-helpers.cjs');
test.describe('00 universal source / package / credential guards', () => {
  test('available version files agree and source contains no release-blocking packaging or secret mistakes', async ({}, testInfo) => {
    const root=APP_ROOT; const read=rel=>fs.existsSync(path.join(root,rel))?fs.readFileSync(path.join(root,rel),'utf8'):'';
    const parse=rel=>{try{return JSON.parse(read(rel)||'{}')}catch(_){return {}}};
    const pkg=parse('package.json'), lock=parse('package-lock.json'), versionJson=parse('public/version.json');
    const files=[]; for(const rel of ['src/App.js','src/core/appCore.js','src/features/schedule.jsx','src/features/management.jsx','src/components/Modal.js','firestore.rules','storage.rules','vercel.json']) if(read(rel)) files.push(rel);
    const all=files.map(read).join('\n'); const failures=[]; const add=(c,m)=>{if(!c) failures.push(m)}; const appVersion=pkg.version||versionJson.version||EXPECTED_VERSION;
    add(Boolean(pkg.name||appVersion),'package.json should identify the application.');
    if(EXPECTED_VERSION&&appVersion) add(appVersion===EXPECTED_VERSION,`Detected app version ${appVersion} does not match expected ${EXPECTED_VERSION}.`);
    if(versionJson.version&&appVersion) add(versionJson.version===appVersion,`public/version.json ${versionJson.version} does not match ${appVersion}.`);
    if(lock.version&&appVersion) add(lock.version===appVersion,`package-lock root version ${lock.version} does not match ${appVersion}.`);
    if(lock.packages?.['']?.version&&appVersion) add(lock.packages[''].version===appVersion,`package-lock root package version ${lock.packages[''].version} does not match ${appVersion}.`);
    add(!/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(all),'Hardcoded private key detected in app source.');
    add(!/(?:^|\n)<<<<<<< |(?:^|\n)=======\s*$|(?:^|\n)>>>>>>> /m.test(all),'Unresolved merge conflict marker detected.');
    add(!/@types\/yargs-[0-9]+\.[0-9]+\.[0-9]+\.tgz/i.test(read('package-lock.json')),'package-lock contains suspicious app-version dependency tarball.');
    await attachJson(testInfo,'00-universal-source-guard.json',{appVersion,expectedVersion:EXPECTED_VERSION,files,failures});
    expect(failures,failures.join('\n')).toEqual([]);
  });
});
