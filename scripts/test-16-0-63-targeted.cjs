#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const version = JSON.parse(read('public/version.json'));
const styles = read('src/styles.css');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');

assert.strictEqual(pkg.version, '16.0.63', 'package.json version is 16.0.63');
assert.strictEqual(pkg.scripts['test:source'], 'node scripts/validate-16-0-63.js', 'test:source points at 16.0.63 validator');
assert.strictEqual(version.version, '16.0.63', 'public version is 16.0.63');
assert.strictEqual(version.build, '16.0.63', 'public build is 16.0.63');
assert(appCore.includes("CURRENT_VERSION = '16.0.63'"), 'visible app version is 16.0.63');
assert(apiVersion.includes("APP_VERSION = '16.0.63'"), 'API version is 16.0.63');

const marker = '16.0.63: desktop Schedule Builder number readability';
assert(styles.includes(marker), 'desktop schedule number readability CSS marker exists');
const blockStart = styles.indexOf(marker);
assert(blockStart >= 0, '16.0.63 CSS block found');
const block = styles.slice(blockStart, blockStart + 900);
assert(block.includes('@media (min-width: 1024px)'), 'fix is desktop-only');
assert(block.includes('.schedule-builder-time-chip:not(.schedule-builder-event-chip):not(.schedule-builder-event-more)'), 'time-chip selector excludes event chips');
assert(block.includes('font-size: 10px !important'), 'desktop shift time numbers are larger');
assert(block.includes('font-size: 15px !important'), 'desktop day date numbers are larger');
const declarationsOnly = block.replace('@media (min-width: 1024px)', '');
assert(!/\b(width|min-width|max-width|height|min-height|max-height|padding)\s*:/.test(declarationsOnly), 'fix does not change boxes, columns, heights, widths, or padding');

console.log('16.0.63 targeted test passed. Desktop Schedule Builder numbers are larger without changing boxes or columns.');
