'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const schedule = fs.readFileSync(path.join(root, 'src/features/schedule.jsx'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');

test('Schedule Builder IN and OUT time controls remain readable without changing scheduling behavior', () => {
  assert.match(schedule, /schedule-builder-time-control-row flex gap-1\.5/, 'time controls have a dedicated row class for scoped readability styling');
  assert.match(schedule, /schedule-builder-time-field relative flex-1/, 'each time input has a dedicated field wrapper');
  assert.match(schedule, /schedule-builder-time-label[^>]*>In<\/span>/, 'IN label uses the readable scoped label class');
  assert.match(schedule, /schedule-builder-time-label[^>]*>Out<\/span>/, 'OUT label uses the readable scoped label class');
  assert.match(schedule, /aria-label=\{`Schedule Builder start time \$\{formatShortTime\(startTime\)\}`\}/, 'start time exposes a clear accessible name with the current formatted time');
  assert.match(schedule, /aria-label=\{`Schedule Builder end time \$\{formatShortTime\(endTime\)\}`\}/, 'end time exposes a clear accessible name with the current formatted time');
  assert.match(schedule, /className=\{`\$\{T\.input\} schedule-builder-compact-control schedule-builder-time-input/, 'both native time inputs use a scoped readability class');
  assert.match(styles, /\.schedule-builder-time-input[\s\S]*font-size:\s*\.95rem !important[\s\S]*font-weight:\s*900 !important/, 'time input text is larger and bolder than the compact default');
  assert.match(styles, /\.schedule-builder-time-input::-webkit-datetime-edit[\s\S]*font-weight:\s*900 !important/, 'native time edit fields inherit readable weight');
  assert.match(styles, /\.schedule-builder-assignment-row > \.schedule-builder-time-control-row[\s\S]*min-width:\s*16rem !important/, 'desktop controls reserve enough width for readable time text');
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.schedule-builder-time-input[\s\S]*height:\s*44px !important[\s\S]*font-size:\s*1rem !important/, 'mobile time controls keep tap height while enlarging the time text');
  assert.match(schedule, /onChange=\{e=>\{setStartTime\(e\.target\.value\);setPresetShift\('Custom'\);\}\}/, 'start time still updates the same state and switches to Custom');
  assert.match(schedule, /onChange=\{e=>\{setEndTime\(e\.target\.value\);setPresetShift\('Custom'\);\}\}/, 'end time still updates the same state and switches to Custom');
});
