'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.1.9 mobile toolbar opens the 86Voice panel without starting capture', () => {
  const app = read('src/App.js');
  const common = read('src/components/common.jsx');
  assert.match(app, /controller\?\.openPanel/);
  assert.doesNotMatch(app, /controller\?\.openAndListen/);
  assert.match(app, /chaos:voice-open-panel/);
  const openDockStart = common.indexOf('const openDock = () => {');
  const openDockEnd = common.indexOf('const openDockAndListen', openDockStart);
  const openDock = common.slice(openDockStart, openDockEnd);
  assert.match(openDock, /setOpen\(true\)/);
  assert.match(openDock, /setVoiceStatus\('idle'\)/);
  assert.doesNotMatch(openDock, /startListening/);
  assert.match(common, /Tap Start Listening when you are ready\./);
});

test('17.1.9 voice errors remain visible inside the open 86Voice panel', () => {
  const common = read('src/components/common.jsx');
  assert.match(common, /voicePanelError/);
  assert.match(common, /data-testid="voice-command-error"/);
  assert.match(common, /role="alert"/);
  assert.match(common, /setVoicePanelError\(error\?\.message/);
});

test('17.1.9 transcription uses a dedicated current audio model instead of inheriting VOICE_GEMINI_MODEL', () => {
  const route = read('api/voice-command.js');
  const fnStart = route.indexOf('function voiceTranscriptionModel()');
  const fnEnd = route.indexOf('const VOICE_AUDIO_MAX_BYTES', fnStart);
  const fn = route.slice(fnStart, fnEnd);
  assert.match(fn, /VOICE_TRANSCRIBE_GEMINI_MODEL/);
  assert.doesNotMatch(fn, /VOICE_GEMINI_MODEL/);
  assert.match(route, /migrateLegacyVoiceModelConfig/);
  assert.match(fn, /gemini-3\.5-flash-lite/);
  assert.match(route, /VOICE_TRANSCRIPTION_PROVIDER_REJECTED/);
  assert.match(route, /diagnosticCode/);
});
