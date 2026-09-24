'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.1.10 restores the deployed 17.0.29 Web Speech microphone lifecycle', () => {
  const common = read('src/components/common.jsx');
  assert.match(common, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(common, /pendingVoiceStartTimerRef\.current = setTimeout\(\(\) => \{/);
  assert.match(common, /startListening\(\{ autoStart: true \}\)/);
  assert.match(common, /\}, 80\);/);
  assert.match(common, /const rec = new SpeechRecognition\(\)/);
  assert.match(common, /rec\.lang = 'en-US'/);
  assert.match(common, /rec\.interimResults = true/);
  assert.match(common, /rec\.maxAlternatives = 1/);
  assert.match(common, /rec\.start\(\)/);
  assert.match(common, /processText\(text, \{ fromVoice: true, isFinal: true, voiceSessionId \}\)/);
});

test('17.1.10 removes the experimental recorder/provider path from active client voice capture', () => {
  const common = read('src/components/common.jsx');
  assert.doesNotMatch(common, /new window\.MediaRecorder/);
  assert.doesNotMatch(common, /startRecordedVoice/);
  assert.doesNotMatch(common, /transcribeRecordedVoice/);
  assert.doesNotMatch(common, /mode:'transcribe'/);
  assert.doesNotMatch(common, /getUserMedia\(/);
});

test('17.1.10 keeps the new Concept 1 mobile UI and routes its first Voice button into the restored controller', () => {
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  const css = read('src/concept17.css');
  const navStart = shell.indexOf('data-testid="concept17-mobile-bottom-nav"');
  const voiceButton = shell.indexOf('data-testid="concept17-mobile-voice-button"', navStart);
  const routeButtons = shell.indexOf('items.slice(0, 4).map', navStart);
  assert.ok(navStart >= 0 && voiceButton > navStart && routeButtons > voiceButton, 'Voice remains first in the new mobile toolbar');
  assert.match(app, /controller\?\.openPanel/);
  assert.match(app, /<VoiceCommandDock ref=\{voiceCommandDockRef\}/);
  assert.match(css, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.voice-command-dock > \.voice-command-trigger[\s\S]*display: none !important/);
});
