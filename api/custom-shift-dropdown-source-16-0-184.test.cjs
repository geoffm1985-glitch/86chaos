'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const schedule = fs.readFileSync(path.join(root, 'src/features/schedule.jsx'), 'utf8');

test('Schedule Builder dropdown dedupes custom shifts against built-in labels without changing the manager list', () => {
  assert.match(schedule, /const presetLabelKeyClient = \(p = \{\}\) => String\(p\.label \|\| ''\)\.trim\(\)\.toLowerCase\(\)/, 'shared label key helper exists');
  assert.match(schedule, /const SHIFT_PRESETS = useMemo\(\(\) => \{/, 'dropdown presets are computed through a memoized merge');
  assert.match(schedule, /const customRowsByLabel = new Map\(\)/, 'custom presets are indexed by visible label');
  assert.match(schedule, /if \(key && !customRowsByLabel\.has\(key\)\) customRowsByLabel\.set\(key, preset\)/, 'custom duplicate labels collapse before dropdown rendering');
  assert.match(schedule, /const usedLabels = new Set\(\)/, 'dropdown tracks labels that were already rendered');
  assert.match(schedule, /visibleRows\.push\(customRowsByLabel\.get\(key\) \|\| preset\)/, 'a custom preset with a built-in label replaces that built-in dropdown row');
  assert.match(schedule, /if \(!key \|\| usedLabels\.has\(key\)\) continue;[\s\S]{0,120}visibleRows\.push\(preset\)/, 'custom-only labels are appended once');
  assert.match(schedule, /SHIFT_PRESETS\.map\(p=><option key=\{p\.id \|\| p\.label\} value=\{p\.label\}>\{p\.label\}<\/option>\)/, 'dropdown option keys stay unique after dedupe');
  assert.doesNotMatch(schedule, /const SHIFT_PRESETS = \[\s*\.\.\.BUILT_IN_SHIFT_PRESETS,\s*\.\.\.\[\.\.\.customPresets\]/, 'dropdown no longer blindly concatenates built-ins and custom presets');
  assert.match(schedule, /\{customPresets\.map\(preset => \(/, 'Manage Custom Shifts still renders the real custom preset list, not the deduped dropdown list');
});
