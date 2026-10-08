#!/usr/bin/env node
'use strict';
const cp = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function run({ spawn = cp.spawnSync, firebaseBin, env = process.env } = {}) {
  const port = await reservePort();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-pos-emulator-'));
  const configPath = path.join(temp, 'firebase.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify({
      firestore: { rules: path.resolve('firestore.rules'), indexes: path.resolve('firestore.indexes.json') },
      emulators: { firestore: { host: '127.0.0.1', port }, ui: { enabled: false }, singleProjectMode: true }
    }, null, 2));
    if (!firebaseBin) {
      const packagePath = require.resolve('firebase-tools/package.json', { paths: [process.cwd()] });
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      firebaseBin = path.resolve(path.dirname(packagePath), typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.firebase);
    }
    const command = `"${process.execPath}" --test api/pos-bridge-emulator-16-0-236.test.cjs`;
    const result = spawn(process.execPath, [firebaseBin, 'emulators:exec', '--only', 'firestore', '--project', 'demo-pos-bridge', '--config', configPath, command], {
      cwd: process.cwd(), stdio: 'inherit', env: {
        ...env, GCLOUD_PROJECT: 'demo-pos-bridge', FIREBASE_ACTIVE_PROJECT_ID: 'demo-pos-bridge', FIREBASE_PROJECT_ID: 'demo-pos-bridge'
      }
    });
    return result.status === 0 ? 0 : (result.status || 1);
  } finally {
    fs.unlinkSync(configPath);
    fs.rmdirSync(temp);
  }
}

if (require.main === module) run().then(code => { process.exitCode = code; }).catch(error => {
  console.error(error.message || error); process.exitCode = 1;
});
module.exports = { run };
