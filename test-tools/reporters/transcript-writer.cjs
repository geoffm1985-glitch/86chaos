'use strict';

const fs = require('fs');
const path = require('path');

function transcriptPath() {
  const runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || process.cwd();
  return path.join(runDir, 'ultimate-live-test-transcript.txt');
}

function appendTranscript(line = '') {
  try {
    const file = transcriptPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${String(line).replace(/\u001b\[[0-9;]*m/g, '')}\n`, 'utf8');
  } catch (_) {}
}

function writeLine(line = '') {
  process.stdout.write(`${line}\n`);
  appendTranscript(line);
}

module.exports = { appendTranscript, writeLine, transcriptPath };
