'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createActionableFailureCapture,
  firstUsefulFailureFromOutput,
} = require('../scripts/86chaos-release-gate/failure-extractor.cjs');
const { runStreamedCommand } = require('../scripts/86chaos-release-gate/streamed-command-runner.cjs');

const root = path.resolve(__dirname, '..');
const quote = value => process.platform === 'win32'
  ? `"${String(value).replace(/"/g, '""')}"`
  : `'${String(value).replace(/'/g, `'"'"'`)}'`;

test('17.0.20 expected permission-denied diagnostics cannot saturate away a later real assertion', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-failure-capture-'));
  const script = path.join(temp, 'child.cjs');
  try {
    fs.writeFileSync(script, `
      for (let i = 0; i < 1000; i += 1) {
        process.stdout.write('@firebase/firestore: test ' + i + ' PERMISSION_DENIED ' + 'x'.repeat(100) + '\\n');
      }
      process.stdout.write('not ok 1 - REAL EARLY ASSERTION\\nAssertion\\n');
      process.stdout.write('Error [ERR_ASS');
      setTimeout(() => {
        process.stdout.write('ERTION]: expected metadata\\n');
        process.stdout.write('z'.repeat(700000));
        process.exitCode = 1;
      }, 5);
    `);
    const child = await runStreamedCommand({
      command: `${quote(process.execPath)} ${quote(script)}`,
      cwd: root,
      timeoutMs: 10000,
      heartbeatMs: 1000,
      tailLimit: 512 * 1024,
      failureEvidenceLimit: 64 * 1024,
      onStdout: () => {},
      onStderr: () => {},
    });
    assert.notEqual(child.status, 0);
    assert.equal(child.stdout.length, 512 * 1024);
    assert.doesNotMatch(child.stdout, /REAL EARLY ASSERTION/);
    assert.match(child.failureEvidence, /REAL EARLY ASSERTION/);
    assert.match(child.failureEvidence, /ERR_ASSERTION/);
    assert.ok(child.failureEvidence.length <= 64 * 1024);
    const useful = firstUsefulFailureFromOutput(child);
    assert.match(useful, /REAL EARLY ASSERTION/);
    assert.match(useful, /expected metadata/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('17.0.20 actionable capture bounds newline-free retained state and keeps chunk-boundary recognition', () => {
  const capture = createActionableFailureCapture({ maxChars: 4096 });
  const chunk = 'u'.repeat(1024 * 1024);
  for (let i = 0; i < 32; i += 1) capture.feed(chunk);
  const state = capture.retainedState;
  assert.ok(state.pendingChars <= 2048, JSON.stringify(state));
  assert.ok(state.dedupeKeys <= 64, JSON.stringify(state));
  assert.ok(state.totalRetainedChars <= 32768, JSON.stringify(state));
  assert.ok(capture.value.length <= 4096);

  capture.feed('\nnot ok 1 - boundary assertion\nError [ERR_ASS');
  capture.feed('ERTION]: split token survived\n');
  const evidence = capture.finish();
  assert.match(evidence, /boundary assertion/);
  assert.match(evidence, /ERR_ASSERTION/);
  assert.ok(evidence.length <= 4096);
});

test('17.0.20 actionable capture bounds evidence, context, and deduplication under many unique error lines', () => {
  const capture = createActionableFailureCapture({ maxChars: 4096 });
  for (let i = 0; i < 12000; i += 1) {
    capture.feed(`Error: unique-${i} ${'q'.repeat(950)}\n`);
  }
  const state = capture.retainedState;
  assert.ok(state.evidenceChars <= 4096, JSON.stringify(state));
  assert.ok(state.pendingChars <= 2048, JSON.stringify(state));
  assert.ok(state.dedupeKeys <= 64, JSON.stringify(state));
  assert.ok(state.totalRetainedChars <= 32768, JSON.stringify(state));
  assert.ok(capture.value.length <= 4096);
  assert.match(capture.value, /Error: unique-/);
});

test('17.0.20 nonzero Firebase permission denial remains actionable when no stronger failure exists', () => {
  const line = "@firebase/firestore: Firestore: RPC failed PERMISSION_DENIED unexpected access";
  const failure = firstUsefulFailureFromOutput({ status: 1, stdout: line, stderr: '' });
  assert.match(failure, /Firebase permission denial/i);
  assert.match(failure, /PERMISSION_DENIED/);
});

test('17.0.20 successful commands retain empty firstUsefulFailure even with expected-denial diagnostics', () => {
  const output = [
    '@firebase/firestore: expected negative check PERMISSION_DENIED',
    'PASS expected denial was enforced',
  ].join('\n');
  assert.equal(firstUsefulFailureFromOutput({ status: 0, stdout: output, stderr: '' }), '');
});
