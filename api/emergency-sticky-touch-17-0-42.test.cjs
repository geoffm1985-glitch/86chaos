'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

test('17.0.42 day header hands vertical touch drags to the schedule content scroller',()=>{
  const schedule=read('src/features/schedule.jsx');
  assert.match(schedule,/scheduleBuilderHeaderTouchRef/);
  assert.match(schedule,/addEventListener\('touchmove', onTouchMove, \{ passive: false \}\)/);
  assert.match(schedule,/Math\.abs\(dy\) > Math\.abs\(dx\) \? 'vertical' : 'horizontal'/);
  assert.match(schedule,/touchState\.axis === 'vertical'/);
  assert.match(schedule,/event\.preventDefault\(\)/);
  assert.match(schedule,/scrollHost\.scrollTop \+= deltaY/);
  assert.match(schedule,/app-content-shell/);
});

test('17.0.42 day header preserves native horizontal swiping while blocking nested vertical scroll capture',()=>{
  const styles=read('src/styles.css');
  assert.match(styles,/schedule-builder-header-scroll[\s\S]{0,320}overflow-x:\s*auto\s*!important/);
  assert.match(styles,/schedule-builder-header-scroll[\s\S]{0,320}overflow-y:\s*hidden\s*!important/);
  assert.match(styles,/schedule-builder-header-scroll[\s\S]{0,320}touch-action:\s*pan-x/);
  assert.match(styles,/schedule-builder-sticky-day-header[\s\S]{0,180}translateZ\(0\)/);
});

test('17.0.42 stays build-only until further instruction',()=>{
  const workflow=read('.github/workflows/testing-targeted-delta.yml');
  assert.match(workflow,/!contains\(github\.event\.head_commit\.message, '\[build-only\]'\)/);
  assert.match(workflow,/57-sticky-header-touch-handoff\.spec\.cjs/);
});
