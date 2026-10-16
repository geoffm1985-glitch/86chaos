'use strict';
const base = require('@playwright/test');
const { installEmulatorPage, drainEmulatorPage } = require('./emulator-navigation.cjs');
const { expectedFirebaseProject } = require('../../scripts/86chaos-firebase-target.cjs');
const test = base.test.extend({
  _emulatorNavigation: [async ({ context }, use, testInfo) => {
    if (expectedFirebaseProject(process.env) !== 'demo-86chaos') { await use(); return; }
    const install = page => installEmulatorPage(page);
    context.on('page', install); context.pages().forEach(install);
    try { await use(); }
    finally {
      const evidence = [];
      for (const page of context.pages()) evidence.push(await drainEmulatorPage(page));
      await testInfo.attach('local-emulator-listener-teardown', { body: JSON.stringify(evidence), contentType: 'application/json' });
      context.off('page', install);
    }
  }, { auto: true }],
});
module.exports = { ...base, test };
