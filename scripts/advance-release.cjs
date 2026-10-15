'use strict';
// Explicit version input: never silently advance a candidate during a test run.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function advanceRelease(version, { directory = root } = {}) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('An explicit semantic release version is required.');
  const read = file => fs.readFileSync(path.join(directory, file), 'utf8');
  const write = (file, value) => fs.writeFileSync(path.join(directory, file), value);
  const json = file => JSON.parse(read(file));
  const save = (file, value) => write(file, JSON.stringify(value, null, 2) + '\n');
  const previous = json('package.json').version;
  const parts = version.split('.').map(Number);
  const code = parts[0] * 10000 + parts[1] * 100 + parts[2];
  if (parts[1] > 99 || parts[2] > 99 || code > 2100000000) throw new Error('Native version code bounds exceeded.');
  const pkg = json('package.json');
  pkg.version = version;
  pkg.scripts['test:source'] = 'node scripts/validate-current-release.cjs';
  pkg.scripts[`validate:${version}`] = pkg.scripts['test:source'];
  pkg.scripts[`test:repair:${version}`] = 'npm run test:current-release-targeted';
  pkg.scripts['test:current-release-targeted'] = pkg.scripts['test:current-release-targeted'].replace('node scripts/validate-18-0-19.js', pkg.scripts['test:source']);
  if (!pkg.scripts['test:current-release-targeted'].includes('testing-promotion-boundary-19.test.cjs')) {
    pkg.scripts['test:current-release-targeted'] = 'node --test api/testing-promotion-boundary-19.test.cjs && ' + pkg.scripts['test:current-release-targeted'];
  }
  save('package.json', pkg);
  const lock = json('package-lock.json'); lock.version = version; lock.packages[''].version = version; save('package-lock.json', lock);
  for (const file of ['api/_version.js','api/_pos-bridge-config.js','src/core/appCore.js','src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs']) {
    write(file, read(file).replaceAll(previous, version));
  }
  for (const file of ['test-tools/certification/groups.json','test-tools/certification/cost-performance-baselines.json','test-tools/regressions/registry.json']) {
    const value = json(file); value.release = version; save(file, value);
  }
  const pub = json('public/version.json');
  for (const key of ['version','build']) pub[key] = version;
  for (const key of ['name','label','title']) pub[key] = `86 Chaos ${version}`;
  pub.releaseTitle = 'Complete mobile source promoted to testing';
  pub.releasedAt = new Date().toISOString();
  pub.summary = 'The complete mobile application is the testing foundation with guarded Firebase isolation and universal platform parity requirements.';
  pub.description = 'Testing candidate. Scheduling phases and final certification are pending.';
  pub.notes = ['Complete current mobile source retained.', 'Testing web/API uses chaos-test-d1601; APK production configuration remains protected.', 'No GitHub Actions or production deployment authorized.'];
  pub.changes = [`Testing candidate ${version}`, 'Baseline targeted/delta validation required before Phase 1.'];
  save('public/version.json', pub);
  write('android/app/build.gradle', read('android/app/build.gradle').replace(/versionCode \d+/, `versionCode ${code}`).replace(/versionName "[^"]+"/, `versionName "${version}"`));
  write('ios/App/App.xcodeproj/project.pbxproj', read('ios/App/App.xcodeproj/project.pbxproj').replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${code};`).replace(/MARKETING_VERSION = [\d.]+;/g, `MARKETING_VERSION = ${version};`));
  const native = json('mobile/native-platform-contract.json'); native.release = version; native.branch = 'testing';
  Object.assign(native.capacitor.android, { versionCode: code, versionName: version });
  Object.assign(native.capacitor.ios, { currentProjectVersion: code, marketingVersion: version });
  save('mobile/native-platform-contract.json', native);
  return { previous, version, code };
}
module.exports = { advanceRelease };
if (require.main === module) console.log(JSON.stringify(advanceRelease(process.argv[2] || '')));
