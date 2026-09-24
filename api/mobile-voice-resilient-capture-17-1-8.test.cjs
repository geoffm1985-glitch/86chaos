'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.1.8 mobile voice uses MediaRecorder server transcription instead of depending only on Web Speech', () => {
  const common = read('src/components/common.jsx');
  assert.match(common, /const canRecordSpeech = .*window\.MediaRecorder/);
  assert.match(common, /const startRecordedVoice = async/);
  assert.match(common, /new window\.MediaRecorder/);
  assert.match(common, /mode:'transcribe'/);
  assert.match(common, /audioBase64/);
  assert.match(common, /await transcribeRecordedVoice/);
  assert.match(common, /shouldPreferRecordedVoice/);
  assert.match(common, /display-mode: standalone/);
  assert.match(common, /max-width: 767px/);
});

test('17.1.8 voice server route accepts a short authenticated audio clip and returns transcript text', () => {
  const route = read('api/voice-command.js');
  assert.match(route, /VOICE_AUDIO_MAX_BYTES = 1_500_000/);
  assert.match(route, /mode === 'transcribe'/);
  assert.match(route, /providerAudioMimeType = audioMimeType\.split\(';'\)\[0\]/);
  assert.match(route, /inlineData: \{ mimeType: providerAudioMimeType, data: audioBase64 \}/);
  assert.match(route, /Transcribe the spoken restaurant command exactly/);
  assert.match(route, /intent: 'transcript', transcript/);
  assert.match(route, /requireAppCheckIfEnforced/);
  assert.match(route, /verifyIdToken/);
  assert.match(route, /enforceRateLimit/);
});

test('17.1.8 toolbar has a visible controller panel and direct fallback launch path', () => {
  const app = read('src/App.js');
  const common = read('src/components/common.jsx');
  const css = read('src/concept17.css');
  assert.match(app, /voiceCommandDockRef\.current/);
  assert.match(app, /chaos:voice-open-panel/);
  assert.match(common, /data-testid="voice-command-panel"/);
  assert.match(common, /data-testid="voice-command-status"/);
  assert.match(common, /window\.addEventListener\('chaos:voice-open-panel'/);
  assert.match(css, /17\.1\.8 resilient mobile voice capture/);
  assert.match(css, /bottom: calc\(82px \+ env\(safe-area-inset-bottom, 0px\)\) !important/);
});
