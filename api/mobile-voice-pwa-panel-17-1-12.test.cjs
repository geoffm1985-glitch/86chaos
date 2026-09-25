'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('17.1.12 portals the mobile 86Voice panel out of the zero-sized legacy dock', () => {
  const common = read('src/components/common.jsx');
  const css = read('src/concept17.css');
  const shell = read('src/components/concept17.jsx');
  const app = read('src/App.js');

  assert.match(common, /import \{ createPortal, flushSync \} from 'react-dom';/);
  assert.match(common, /className="voice-command-panel-surface cockpit-panel/);
  assert.match(common, /document\.querySelector\('\.concept17-shell'\) \|\| document\.body/);
  assert.match(common, /createPortal\(voicePanel, mobileVoicePortalTarget\)/);
  assert.match(common, /window\.matchMedia\?\.\('\(max-width: 720px\)'\)\?\.matches/);
  assert.match(common, /try \{ flushSync\(revealPanel\); \} catch \(_\) \{ revealPanel\(\); \}/);

  assert.match(css, /17\.1\.12 Android installed-PWA 86Voice panel repair/);
  assert.match(css, /\.voice-command-panel-surface\s*\{/);
  assert.match(css, /position: fixed !important;/);
  assert.match(css, /bottom: calc\(82px \+ env\(safe-area-inset-bottom, 0px\)\) !important;/);
  assert.match(css, /z-index: 120 !important;/);

  assert.match(shell, /onPointerDown=\{activateVoiceFromPointer\}/);
  assert.match(app, /controller\?\.openAndListen/);
});

test('17.1.12 leaves the proven desktop Voice path intact', () => {
  const common = read('src/components/common.jsx');
  const start = common.indexOf('const openDock = () => {');
  const end = common.indexOf('const openDockAndListen', start);
  assert.ok(start >= 0 && end > start);
  const openDock = common.slice(start, end);

  assert.match(openDock, /pendingVoiceStartTimerRef\.current = setTimeout/);
  assert.match(openDock, /startListening\(\{ autoStart: true \}\)/);
  assert.match(openDock, /}, 80\);/);
  assert.match(common, /const rec = new SpeechRecognition\(\)/);
  assert.match(common, /rec\.start\(\)/);
});
