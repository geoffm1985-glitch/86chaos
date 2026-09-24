'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.1.11 mobile Voice activates on physical pointer-down and suppresses browser URL/link callouts', () => {
  const shell = read('src/components/concept17.jsx');
  const css = read('src/concept17.css');
  assert.match(shell, /const activateVoiceFromPointer = \(event\) =>/);
  assert.match(shell, /event\.pointerType === 'mouse'/);
  assert.match(shell, /event\.preventDefault\(\)/);
  assert.match(shell, /voicePointerActivatedAt/);
  assert.match(shell, /onPointerDown=\{activateVoiceFromPointer\}/);
  assert.match(shell, /onContextMenu=\{suppressVoiceBrowserCallout\}/);
  assert.match(shell, /onDragStart=\{suppressVoiceBrowserCallout\}/);
  assert.match(css, /17\.1\.11 mobile 86Voice physical-touch repair/);
  assert.match(css, /-webkit-touch-callout:\s*none !important/);
  assert.match(css, /-webkit-user-select:\s*none !important/);
});

test('17.1.11 toolbar uses the same open-and-listen controller path as the working dock trigger', () => {
  const app = read('src/App.js');
  const common = read('src/components/common.jsx');
  assert.match(app, /controller\?\.openAndListen/);
  assert.match(app, /controller\.openAndListen\(\)/);
  assert.match(app, /chaos:voice-open-and-listen/);
  assert.match(common, /openAndListen: openDockAndListen/);
  assert.match(common, /const openDockAndListen = openDock/);
  assert.match(common, /pendingVoiceStartTimerRef\.current = setTimeout/);
  assert.match(common, /const rec = new SpeechRecognition\(\)/);
  assert.match(common, /rec\.start\(\)/);
});
