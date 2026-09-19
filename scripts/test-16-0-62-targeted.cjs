#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`OK ${message}`);
};

const pkg = json('package.json');
const version = json('public/version.json');
const schedule = read('src/features/schedule.jsx');
const styles = read('src/styles.css');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');

assert(pkg.version === '16.0.62', 'package.json version is 16.0.62');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-62.js', 'test:source points at the 16.0.62 source validator');
assert(version.version === '16.0.62' && version.build === '16.0.62', 'public version is 16.0.62');
assert(appCore.includes("CURRENT_VERSION = '16.0.62'"), 'app core visible version is 16.0.62');
assert(apiVersion.includes("APP_VERSION = '16.0.62'"), 'API version is 16.0.62');

assert(schedule.includes('schedule-builder-events-cell'), 'Schedule Builder has a dedicated events row cell class');
assert(schedule.includes('schedule-builder-event-chip'), 'Schedule Builder renders event chips with a dedicated class');
assert(schedule.includes('title={formatScheduleBuilderEventTitle(ev)}'), 'Event chips preserve the full event detail in the tooltip/title');
assert(styles.includes('16.0.62 schedule builder event chip containment'), 'event chip containment CSS marker is present');
assert(/\.schedule-builder-events-cell\s*\{[\s\S]*overflow:\s*hidden !important;[\s\S]*contain:\s*paint !important;[\s\S]*\}/.test(styles), 'event cells clip overflow and contain paint');
assert(/\.schedule-builder-events-cell\s*>\s*div\s*\{[\s\S]*max-width:\s*100% !important;[\s\S]*overflow:\s*hidden !important;[\s\S]*\}/.test(styles), 'event chip stack is constrained to its day cell');
assert(/\.schedule-builder-events-cell \.schedule-builder-event-chip,[\s\S]*\.schedule-builder-events-cell \.schedule-builder-event-more\s*\{[\s\S]*max-width:\s*100% !important;[\s\S]*min-width:\s*0 !important;[\s\S]*white-space:\s*nowrap !important;[\s\S]*overflow:\s*hidden !important;[\s\S]*text-overflow:\s*ellipsis !important;[\s\S]*\}/.test(styles), 'event chips are no-wrap ellipsized inside the cell');
assert(!/\.schedule-builder-events-cell \.schedule-builder-event-chip[\s\S]*overflow:\s*visible !important/.test(styles), 'event-chip containment rule does not allow visible overflow');

console.log('16.0.62 targeted test passed. Schedule Builder event chips stay inside their own date cell without vertical/sideways spillover.');
