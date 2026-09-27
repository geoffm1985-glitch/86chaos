'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('17.0.41 Manager Brief uses browser-native intelligence modules instead of CommonJS browser interop', () => {
  const operations = read('src/features/operations.jsx');
  for (const moduleName of ['restaurantReadiness','needsAttention','restaurantKnowledgeGraph','smartPrepIntelligence','operationalHistoryIntelligence']) {
    assert.match(operations, new RegExp(`from ['\"]\\.\\./core/${moduleName}\\.js['\"]`), `${moduleName} browser import uses .js`);
    assert.doesNotMatch(operations, new RegExp(`from ['\"]\\.\\./core/${moduleName}\\.cjs['\"]`), `${moduleName} browser import no longer uses .cjs`);
  }
  assert.match(operations, /import \{ buildRestaurantReadiness \}/);
  assert.match(operations, /import \{ canViewAttentionItem \}/);
  assert.match(operations, /import \{ buildRestaurantKnowledgeGraph \}/);
  assert.match(operations, /import \{ buildSmartPrepRecommendations \}/);
  assert.match(operations, /import \{ buildOperationalHistory \}/);
});

test('17.0.41 browser intelligence modules expose the exact Manager Brief functions', () => {
  const expectations = {
    'src/core/needsAttention.js': ['canViewAttentionItem','buildNeedsAttention'],
    'src/core/restaurantReadiness.js': ['buildRestaurantReadiness'],
    'src/core/restaurantKnowledgeGraph.js': ['buildRestaurantKnowledgeGraph'],
    'src/core/smartPrepIntelligence.js': ['buildSmartPrepRecommendations'],
    'src/core/operationalHistoryIntelligence.js': ['buildOperationalHistory'],
  };
  for (const [file, names] of Object.entries(expectations)) {
    const source = read(file);
    assert.doesNotMatch(source, /module\.exports\s*=/, `${file} is browser-native ESM`);
    for (const name of names) assert.match(source, new RegExp(`\\b${name}\\b`), `${file} contains ${name}`);
    assert.match(source, /export\s+\{/, `${file} has named exports`);
  }
  assert.match(read('src/core/restaurantReadiness.js'), /from ['\"]\.\/needsAttention\.js['\"]/);
});

test('17.0.41 Schedule Builder sticky day header reserves the live control-deck height on mobile too', () => {
  const schedule = read('src/features/schedule.jsx');
  const styles = read('src/styles.css');
  assert.match(schedule, /const deckHeight = Math\.ceil\(scheduleBuilderControlDeckRef\.current\?\.getBoundingClientRect/);
  assert.doesNotMatch(schedule, /viewportWidth\s*>=\s*1024[\s\S]{0,120}deckHeight/);
  assert.doesNotMatch(schedule, /viewportWidth\s*<=\s*720[\s\S]{0,80}setScheduleBuilderStickyTop\(0\)/);
  assert.match(schedule, /baseTop \+ deckHeight \+ \(deckHeight \? 4 : 2\)/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*schedule-builder-sticky-day-header[\s\S]*top:\s*var\(--schedule-builder-sticky-top/);
  assert.doesNotMatch(styles, /schedule-builder-sticky-day-header\s*\{[\s\S]{0,120}top:\s*0\s*!important/);
});

test('17.0.41 build-only push suppression prevents automatic targeted or full-gate execution', () => {
  const workflow = read('.github/workflows/testing-targeted-delta.yml');
  assert.match(workflow, /!contains\(github\.event\.head_commit\.message, '\[build-only\]'\)/);
  assert.match(workflow, /56-manager-brief-sticky-day-header\.spec\.cjs/);
});
