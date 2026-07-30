const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pkg = JSON.parse(read('package.json'));
const publicVersion = JSON.parse(read('public/version.json'));
const indexHtml = read('public/index.html');
const srcIndex = read('src/index.js');
const noZoomGuard = read('src/core/mobileNoZoom.js');
const styles = read('src/styles.css');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');

assert.strictEqual(pkg.version, '16.0.65', 'package.json version is 16.0.65');
assert.strictEqual(pkg.scripts['test:source'], 'node scripts/validate-16-0-65.js', 'test:source points at 16.0.65 validator');
assert.strictEqual(publicVersion.version, '16.0.65', 'public version is 16.0.65');
assert(appCore.includes("CURRENT_VERSION = '16.0.65'"), 'visible app version is 16.0.65');
assert(apiVersion.includes("APP_VERSION = '16.0.65'"), 'API version is 16.0.65');

assert.match(
  indexHtml,
  /<meta\s+name="viewport"\s+content="[^"]*maximum-scale=1[^"]*user-scalable=no[^"]*viewport-fit=cover[^"]*"\s*\/>/i,
  'public viewport disables mobile zoom with maximum-scale=1 and user-scalable=no'
);

assert(srcIndex.includes('installMobileNoZoomGuard'), 'src/index.js imports and calls the mobile no-zoom guard');
assert(
  srcIndex.indexOf('installMobileNoZoomGuard();') < srcIndex.indexOf('createRoot(rootElement)'),
  'mobile no-zoom guard is installed before React mounts'
);

assert(noZoomGuard.includes('maximum-scale=1, user-scalable=no'), 'mobile no-zoom guard enforces no-zoom viewport at runtime');
assert(noZoomGuard.includes("document.addEventListener('touchmove'") && noZoomGuard.includes('event.touches.length > 1'), 'pinch touchmove is blocked on mobile');
assert(noZoomGuard.includes("document.addEventListener('gesturestart'") && noZoomGuard.includes("document.addEventListener('gesturechange'") && noZoomGuard.includes("document.addEventListener('gestureend'"), 'iOS gesture zoom events are blocked');
assert(noZoomGuard.includes("document.addEventListener('touchend'") && noZoomGuard.includes('lastTouchEnd'), 'double-tap zoom is blocked');

assert(!/pinch-zoom/.test(styles), 'global CSS must not explicitly allow pinch zoom');
assert.match(styles, /html,\s*body\s*\{[\s\S]*?touch-action:\s*pan-x\s+pan-y;/, 'html/body keep panning but not pinch zoom');
assert.match(styles, /@media\s*\(pointer:\s*coarse\)[\s\S]*?#root\s*\{[\s\S]*?touch-action:\s*pan-x\s+pan-y;/, 'mobile root keeps pan gestures but not pinch zoom');
assert.match(styles, /input,\s*textarea,\s*select\s*\{[\s\S]*?font-size:\s*16px;/, 'mobile form controls keep 16px font to prevent focus zoom');

console.log('16.0.65 targeted test passed. Mobile no-zoom viewport, gesture guard, and CSS hardening are wired.');
