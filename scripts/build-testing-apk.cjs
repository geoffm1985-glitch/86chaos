'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const TEST_ORIGIN = 'https://testing.86chaos.com';
const TEST_PROJECT = 'chaos-test-d1601';
function testingEnvironment(parent = process.env) {
  return { ...parent, CI: 'false', GENERATE_SOURCEMAP: 'false',
    REACT_APP_FIREBASE_DEPLOYMENT_MODE: 'testing', REACT_APP_FIREBASE_ACTIVE_PROJECT_ID: TEST_PROJECT,
    REACT_APP_NATIVE_API_BASE_URL: TEST_ORIGIN, REACT_APP_NATIVE_UPDATED_API_BASE_URL: TEST_ORIGIN };
}
function verifyTestingServices(services) {
  assert.equal(services.project_info.project_id, TEST_PROJECT, 'Testing APK requires testing Firebase');
  assert(services.client.some(client => client.client_info.android_client_info.package_name === 'com.chiltonappworks.chaos86'), 'Testing Firebase Android registration is missing');
}
async function main() {
  const root = path.resolve(__dirname, '..');
  const read = file => fs.readFileSync(path.join(root, file));
  const json = file => JSON.parse(read(file));
  const branch = cp.execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(branch, 'mobile', 'Build only from the mobile branch');
  assert.equal(cp.execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(), '', 'Commit reviewed source before building an APK');
  const source = require('./86chaos-release-gate/source-identity.cjs').captureSourceIdentity(root);
  assert.equal(source.sourceHash, json('release-source-manifest.json').sourceHash, 'Seal the exact mobile source before building');
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const key = process.env.CHAOS_PREVIEW_KEYSTORE;
  assert(sdk && fs.existsSync(sdk), 'Local Android SDK is required');
  assert(key && fs.existsSync(key), 'Retained preview signing key is required');
  const services = json('mobile/testing/google-services.json');
  verifyTestingServices(services);
  const env = testingEnvironment();
  const run = (command, args, cwd = root) => new Promise((resolve, reject) => {
    console.log('[BUILD] ' + path.basename(command) + ' ' + args.join(' '));
    const child = cp.spawn(command, args, { cwd, env, stdio: ['inherit', 'inherit', 1], windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('Local build step failed: ' + code)));
  });
  const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  await run(process.execPath, [npm, 'run', 'build']);
  assert.equal(json('build/build-identity.json').identityStampStatus, 'verified');
  const target = { environment: 'testing', firebaseProjectId: TEST_PROJECT, apiBaseUrl: TEST_ORIGIN,
    updatedApiBaseUrl: TEST_ORIGIN, localHostname: 'testing.86chaos.com', version: source.version, commit: source.commit, sourceHash: source.sourceHash };
  fs.writeFileSync(path.join(root, 'build/native-build-target.json'), JSON.stringify(target, null, 2) + '\n');
  const overlays = ['capacitor.config.json', 'android/app/google-services.json', 'android/app/src/main/res/values/strings.xml'];
  const originals = new Map(overlays.map(file => [file, read(file)]));
  try {
    const capacitor = json('capacitor.config.json');
    capacitor.appName = '86 Chaos Testing';
    capacitor.server.hostname = target.localHostname;
    fs.writeFileSync(path.join(root, overlays[0]), JSON.stringify(capacitor, null, 2) + '\n');
    fs.writeFileSync(path.join(root, overlays[1]), JSON.stringify(services, null, 2) + '\n');
    fs.writeFileSync(path.join(root, overlays[2]), originals.get(overlays[2]).toString().replace(/>86 Chaos</g, '>86 Chaos Testing<'));
    await run(process.execPath, [path.join(root, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'android']);
    // Windows batch files require cmd; arguments here are fixed build targets.
    await run(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'gradlew.bat assembleDebug testDebugUnitTest lintDebug --no-daemon'], path.join(root, 'android'));
  } finally {
    for (const [file, bytes] of originals) fs.writeFileSync(path.join(root, file), bytes);
  }
  const outputDir = path.join(root, '.cache/testing-apk');
  fs.mkdirSync(outputDir, { recursive: true });
  const apk = path.join(outputDir, `86Chaos-${source.version}-testing-preview.apk`);
  fs.copyFileSync(path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk'), apk);
  const buildTools = fs.readdirSync(path.join(sdk, 'build-tools')).sort((a, b) => b.localeCompare(a, undefined, {numeric:true}));
  const zipalign = buildTools.map(version => path.join(sdk, 'build-tools', version, process.platform === 'win32' ? 'zipalign.exe' : 'zipalign')).find(file => fs.existsSync(file));
  assert(zipalign, 'Android zipalign is required');
  await run(zipalign, ['-c', '-P', '16', '4', apk]);
  await run(process.platform === 'win32' ? 'python' : 'python3', [path.join(root, 'scripts/verify-native-push-apk.py'), apk, '--testing']);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
  fs.writeFileSync(apk + '.sha256', sha256 + '  ' + path.basename(apk) + '\n');
  fs.writeFileSync(path.join(outputDir, 'build-result.json'), JSON.stringify({ ...target, apk, sha256, builtLocally: true, physicalDeviceVerified: false, finishedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log('[PASS] Locally built testing APK: ' + apk);
  console.log('SHA256: ' + sha256);
  console.log('Verify APK resources and signing certificate before publishing.');
}
module.exports = { testingEnvironment, verifyTestingServices };
if (require.main === module) main().catch(error => { console.log('[FAIL] ' + error.message); process.exitCode = 1; });
