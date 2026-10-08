'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net'), cp = require('node:child_process');
const { applyFirebaseEmulatorEnv } = require('./86chaos-firebase-target.cjs');
async function port() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
async function run() {
  const root = path.resolve(__dirname, '..'), tempRoot = path.resolve(os.tmpdir());
  const temp = fs.mkdtempSync(path.join(tempRoot, '86chaos-native-push-'));
  const [firestore, auth, hub, logging] = await Promise.all([port(), port(), port(), port()]);
  const config = path.join(temp, 'firebase.json');
  fs.writeFileSync(config, JSON.stringify({ firestore: { rules: path.join(root, 'firestore.rules'), indexes: path.join(root, 'firestore.indexes.json') }, emulators: { firestore: { host: '127.0.0.1', port: firestore }, auth: { host: '127.0.0.1', port: auth }, hub: { host: '127.0.0.1', port: hub }, logging: { host: '127.0.0.1', port: logging }, ui: { enabled: false }, singleProjectMode: true } }));
  const env = { ...process.env, YARDMASTER_FIREBASE_TARGET: 'emulator', CHAOS_BLOCK_LIVE_FIREBASE: '1', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' };
  for (const key of ['FIREBASE_EMULATOR_HUB', 'FIREBASE_CONFIG', 'GOOGLE_APPLICATION_CREDENTIALS']) delete env[key];
  for (const product of ['FIRESTORE', 'AUTH']) delete env[`REACT_APP_86CHAOS_${product}_EMULATOR_PORT`];
  const cli = require.resolve('firebase-tools/lib/bin/firebase.js');
  const command = `"${process.execPath}" "${__filename}" --child`;
  try {
    const child = cp.spawn(process.execPath, [cli, 'emulators:exec', '--only', 'auth,firestore', '--project', 'demo-86chaos', '--config', config, command], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    return await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code ?? 1)); });
  } finally {
    const resolved = path.resolve(temp);
    if (!resolved.startsWith(tempRoot + path.sep) || !path.basename(resolved).startsWith('86chaos-native-push-')) throw Error('Unsafe emulator temporary directory');
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
if (process.argv.includes('--child')) {
  applyFirebaseEmulatorEnv(process.env);
  const child = cp.spawnSync(process.execPath, ['--test', 'tests/native-push-emulator.test.cjs'], { cwd: path.resolve(__dirname, '..'), env: process.env, stdio: 'inherit', windowsHide: true });
  process.exitCode = child.status ?? 1;
} else run().then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
