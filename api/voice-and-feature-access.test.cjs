'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('86Voice source has a guarded microphone lifecycle and accessible controls', () => {
  const common = fs.readFileSync(path.join(__dirname, '..', 'src/components/common.jsx'), 'utf8');
  assert.match(common, /activeRecognitionRef/);
  assert.match(common, /pendingVoiceStartTimerRef/);
  assert.match(common, /stopActiveRecognition/);
  assert.match(common, /aria-label=\{open \? 'Hide 86Voice assistant' : 'Open 86Voice'\}/);
  assert.match(common, /aria-label=\{listening \? 'Stop listening' : 'Start listening'\}/);
  assert.match(common, /const VoiceCommandDock = VoiceCommandDockBase;/);
  assert.doesNotMatch(common, /React\.memo\(VoiceCommandDockBase, voiceDockPropsAreEqual\)/);
});

test('Speak Reminder source has a guarded microphone lifecycle', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/features/intelligence.jsx'), 'utf8');
  assert.match(source, /reminderRecognitionRef/);
  assert.match(source, /stopReminderRecognition/);
  assert.match(source, /Already Listening/);
  assert.match(source, /aria-label=\{listening \? 'Stop reminder voice entry' : 'Speak Reminder'\}/);
});

test('feature access no longer grants master admin from role text or client editable hints', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/lib/featureAccess.js'), 'utf8');
  assert.match(source, /isVerifiedPlatformAdminUser/);
  assert.doesNotMatch(source, /masterAdmin === true/);
  assert.doesNotMatch(source, /accountRole\) === 'master_admin'/);
  assert.doesNotMatch(source, /role\) === 'system administrator'/);
});
