'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','src/features/intelligence.jsx'),'utf8');
test('17.0.39 Speak Reminder owns one guarded recognition instance',()=>{assert.match(source,/reminderRecognitionRef/);assert.match(source,/if\(reminderRecognitionRef\.current\|\|listening\)/);assert.match(source,/Already Listening/);assert.match(source,/reminderRecognitionRef\.current===recognition/)});
test('17.0.39 Speak Reminder stops and cleans up microphone lifecycle',()=>{assert.match(source,/stopReminderRecognition/);assert.match(source,/active\._chaosIntentionalStop=true/);assert.match(source,/reminderVoiceMountedRef\.current=false/);assert.match(source,/active\.abort\(\)/)});
test('17.0.39 Speak Reminder has an accessible start and stop control',()=>{assert.match(source,/aria-label=\{listening \? 'Stop reminder voice entry' : 'Speak Reminder'\}/);assert.match(source,/onClick=\{listening\?stopReminderRecognition:startReminderVoiceEntry\}/)});
