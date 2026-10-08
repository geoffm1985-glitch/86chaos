'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const bridge = require('../yardmaster.firebase.json');
function run(args, env = process.env) {
  const child = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (child.error) throw child.error;
  if (child.status !== 0) process.exit(child.status || 1);
}
run(['--test', 'api/yardmaster-firebase-bridge-17-0-57.test.cjs', 'api/firebase-emulator-bridge-17-0-54.test.cjs', 'api/firebase-emulator-cra-import-17-0-55.test.cjs', 'api/firebase-emulator-entry-import-17-0-56.test.cjs']);
run([require.resolve('firebase-tools/lib/bin/firebase.js'), 'emulators:exec', '--project', bridge.projectId, '--config', bridge.firebaseConfig, '--only', bridge.products.join(','), 'node node_modules/@playwright/test/cli.js test --config=playwright.firebase-bridge.config.cjs'], { ...process.env, YARDMASTER_FIREBASE_TARGET: 'emulator', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' });
