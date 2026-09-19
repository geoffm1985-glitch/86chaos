const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
let failures = 0;
const assert = (condition, message) => {
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${message}`);
  } else {
    console.log(`OK ${message}`);
  }
};

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const app = read('src/App.js');

assert(pkg.version === '16.0.7', 'package.json version is 16.0.7');
assert(lock.version === '16.0.7' && lock.packages?.['']?.version === '16.0.7', 'package-lock.json version is 16.0.7');
assert(version.version === '16.0.7' && version.build === '16.0.7', 'public/version.json is 16.0.7');
assert(appCore.includes("CURRENT_VERSION = '16.0.7'"), 'CURRENT_VERSION is 16.0.7');

assert(app.includes('getTourSeenOnceKey'), 'tour has non-versioned seen-once local key helper');
assert(app.includes('markTourSeenOnce'), 'tour skip/finish marks seen once');
assert(app.includes('onboardingTourSeen'), 'employee guided tour seen state persists to user profile');
assert(app.includes('managerOnboardingSeen'), 'manager guided tour seen state persists to user profile');
assert(!app.includes('tourSeenThisSession_${liveAppUser?.id || \'guest\'}_${mode || \'tour\'}_${CURRENT_VERSION}'), 'auto-tour session key is no longer tied to app version');
assert(!app.includes('tourSeenThisSession_${liveAppUser.id}_manager_${CURRENT_VERSION}'), 'manager auto-tour check is no longer tied to app version');
assert(!app.includes('tourSeenThisSession_${liveAppUser.id}_employee_${CURRENT_VERSION}'), 'employee auto-tour check is no longer tied to app version');
assert(app.includes("Skip and don't show again"), 'tour skip button tells users it will not keep reopening');

if (failures) {
  console.error(`16.0.7 first-login tour persistence validator failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log('16.0.7 first-login tour persistence validator passed.');
