'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.1.7 makes 86Voice a real first bottom-nav button instead of an overlay placeholder', () => {
  const shell = read('src/components/concept17.jsx');
  const app = read('src/App.js');
  const navStart = shell.indexOf('data-testid="concept17-mobile-bottom-nav"');
  const voiceButton = shell.indexOf('data-testid="concept17-mobile-voice-button"', navStart);
  const routeButtons = shell.indexOf('items.slice(0, 4).map', navStart);
  assert.ok(navStart >= 0 && voiceButton > navStart && routeButtons > voiceButton, 'Voice is the first real toolbar button');
  assert.match(shell, /data-shell-action="voice"/);
  assert.doesNotMatch(shell, /concept17-mobile-nav-voice-slot/);
  assert.match(app, /const voiceCommandDockRef = useRef\(null\)/);
  assert.match(app, /<VoiceCommandDock ref=\{voiceCommandDockRef\}/);
  assert.match(app, /voiceCommandDockRef\.current/);
  assert.match(app, /controller\?\.openPanel/);
});

test('17.1.7 exposes a synchronous imperative voice entry point and a real microphone permission path', () => {
  const common = read('src/components/common.jsx');
  assert.match(common, /React\.forwardRef\(/);
  assert.match(common, /useImperativeHandle\(ref, \(\) => \(\{/);
  assert.match(common, /openAndListen: openDockAndListen/);
  assert.match(common, /openPanel: openDock/);
  assert.match(common, /navigator\.mediaDevices/);
  assert.match(common, /getUserMedia\(\{/);
  assert.match(common, /track\.stop\(\)/);
  assert.match(common, /const startListening = async/);
  assert.match(common, /navigator\.mediaDevices/);
  assert.match(common, /getUserMedia/);
  assert.match(common, /startRecordedVoice|startNativeRecognition/);
});

test('17.1.7 removes the legacy mobile overlay from the tap path while keeping the voice panel interactive', () => {
  const css = read('src/concept17.css');
  assert.match(css, /17\.1\.7 mobile 86Voice interaction repair/);
  assert.match(css, /\.voice-command-dock > \.voice-command-trigger[\s\S]*display: none !important;[\s\S]*pointer-events: none !important;/);
  assert.match(css, /\.voice-command-dock > \.cockpit-panel[\s\S]*pointer-events: auto !important;/);
  assert.match(css, /\.concept17-mobile-voice-button[\s\S]*touch-action: manipulation;[\s\S]*pointer-events: auto !important;/);
});
