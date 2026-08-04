'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const manifest = require('../tests/86chaos-release-gate/mutation-workflow-manifest.cjs');

const root = path.join(__dirname, '..');

test('mutation workflow manifest no longer treats regex/source words as functional coverage', () => {
  assert.ok(manifest.length >= 10);
  for (const workflow of manifest) {
    assert.ok(workflow.controlLabel instanceof RegExp, `${workflow.name} can still identify candidate controls`);
    assert.ok(Array.isArray(workflow.actionIds) && workflow.actionIds.length > 0, `${workflow.name} must require executed action IDs`);
    assert.equal('evidence' in workflow, false, `${workflow.name} must not use lexical evidence regex as pass criteria`);
    assert.equal('label' in workflow, false, `${workflow.name} must not use label regex as coverage proof`);
  }
});

test('interactive control census fails missing expected mutation evidence instead of passing lexical matches', () => {
  const census = fs.readFileSync(path.join(root, 'tests/86chaos-release-gate/15-interactive-control-census.spec.cjs'), 'utf8');
  assert.match(census, /mutation-workflow-missing-runtime-evidence/);
  assert.match(census, /source\.includes\(id\)/);
  assert.doesNotMatch(census, /workflow\.evidence\.test\(source\)/);
});

test('86Voice browser test fails when authorized voice control is absent', () => {
  const voice = fs.readFileSync(path.join(root, 'tests/86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs'), 'utf8');
  assert.match(voice, /SpeechRecognition/);
  assert.match(voice, /Authorized account must expose a stable accessible 86Voice control/);
  assert.match(voice, /toBeVisible\(\{ timeout: 10_000 \}\)/);
  assert.doesNotMatch(voice, /if \(metrics\.length\)/);
});
