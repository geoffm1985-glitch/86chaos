'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { run } = require('../scripts/run-pos-bridge-emulator-tests.cjs');

test('POS concurrency launcher avoids the occupied Yardmaster port and pins all project aliases', async () => {
  const occupied = net.createServer();
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  let configPath;
  try {
    const code = await run({
      firebaseBin: 'fixture-firebase.js',
      env: { FIRESTORE_EMULATOR_HOST: `127.0.0.1:${occupied.address().port}`, GCLOUD_PROJECT: 'demo-86chaos', FIREBASE_ACTIVE_PROJECT_ID: 'demo-86chaos', FIREBASE_PROJECT_ID: 'demo-86chaos' },
      spawn: (executable, args, options) => {
        configPath = args[args.indexOf('--config') + 1];
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        assert.equal(executable, process.execPath);
        assert.equal(config.emulators.firestore.host, '127.0.0.1');
        assert.notEqual(config.emulators.firestore.port, occupied.address().port);
        assert.equal(config.firestore.rules, path.resolve('firestore.rules'));
        assert.equal(args[args.indexOf('--project') + 1], 'demo-pos-bridge');
        assert.match(args.at(-1), /--test api\/pos-bridge-emulator-16-0-236\.test\.cjs/);
        for (const key of ['GCLOUD_PROJECT', 'FIREBASE_ACTIVE_PROJECT_ID', 'FIREBASE_PROJECT_ID']) assert.equal(options.env[key], 'demo-pos-bridge');
        return { status: 0 };
      }
    });
    assert.equal(code, 0);
    assert.equal(fs.existsSync(path.dirname(configPath)), false);
    assert.equal(occupied.listening, true);
  } finally { await new Promise(resolve => occupied.close(resolve)); }
});

test('POS concurrency launcher preserves test failure and cleans temporary configuration', async () => {
  let configPath;
  const code = await run({ firebaseBin: 'fixture-firebase.js', spawn: (executable, args) => {
    configPath = args[args.indexOf('--config') + 1];
    return { status: 7 };
  } });
  assert.equal(code, 7);
  assert.equal(fs.existsSync(path.dirname(configPath)), false);
});
