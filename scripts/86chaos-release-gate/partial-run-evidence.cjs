'use strict';

// Local test evidence only. It never changes restaurant data or certifies a
// release. The existing complete gate remains the sole certification authority.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { captureSourceIdentity } = require('./source-identity.cjs');
const { normalizeRel, stableIdentityKey } = require('./playwright-inventory.cjs');
const { requiredSkipCoverage } = require('./expected-skips.cjs');
const JOURNAL = 'playwright-progress.jsonl';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = message => { throw new Error(`Partial resume refused: ${message}`); };
const normalizeUrl = value => String(value || '').replace(/\/+$/, '');
const identityFields = row => ({ specPath: normalizeRel(row.specPath), fullSuitePath: row.fullSuitePath || '', leafTitle: row.leafTitle || row.exactTestTitle || row.title || '', project: row.project || row.projectName || '' });

function testIdentity(test, root) {
  const specPath = normalizeRel(path.relative(path.join(root, 'tests'), path.resolve(root, test.location.file)));
  const project = test.parent?.project?.()?.name || test.project?.()?.name || test.projectName || '';
  const parts = test.titlePath();
  // Playwright titlePath is root, project, file, then every describe and leaf.
  // Preserve repeated describe names and the full hierarchy, without display truncation.
  const fileIndex = parts.findIndex(part => /\.spec\.(?:cjs|mjs|js|jsx|ts|tsx)$/.test(String(part).replace(/\\/g, '/')));
  if (fileIndex < 0 || specPath.startsWith('../') || !project) fail('a discovered test has no exact portable identity.');
  return identityFields({ specPath, project, fullSuitePath: parts.slice(fileIndex + 1, -1).join(' > '), leafTitle: test.title });
}

function checkContext(source, preflight, currentSource, target) {
  for (const key of ['version', 'sourceHash', 'commit']) {
    if (!source?.[key] || source[key] !== currentSource?.[key]) fail(`source ${key} differs from the interrupted run; run the complete gate for the changed source.`);
  }
  if (!preflight?.ok || preflight.sourceVersion !== source.version || preflight.deployedVersion !== source.version) fail('the interrupted run has no matching successful source/Preview preflight.');
  if (target.currentSourceVersion !== source.version || target.currentDeployedVersion !== source.version) fail('the current source and Preview do not match the interrupted source.');
  if (preflight.firebaseProjectId !== 'chaos-test-d1601' || target.firebaseProjectId !== preflight.firebaseProjectId) fail('the test workspace environment does not match.');
  if (!preflight.appUrl || normalizeUrl(target.appUrl) !== normalizeUrl(preflight.appUrl) || /app\.86chaos\.com|cheers-34b8d/i.test(preflight.appUrl)) fail('the testing Preview URL does not match.');
}

function createProgressJournal({ root, runDir, tests, mode, currentSource }) {
  // Focused runs retain their existing evidence semantics; checkpoints start
  // with the actual full-run inventory, never a guessed subset.
  if (!runDir || !['full', 'release'].includes(mode)) return null;
  currentSource = currentSource || captureSourceIdentity(root);
  const source = readJson(path.join(runDir, 'source-identity-start.json'));
  const preflight = readJson(path.join(runDir, 'environment-preflight.json'));
  checkContext(source, preflight, currentSource, { currentSourceVersion: source.version, currentDeployedVersion: preflight.deployedVersion, firebaseProjectId: preflight.firebaseProjectId, appUrl: preflight.appUrl });
  const inventory = tests.map(test => testIdentity(test, root));
  const keys = new Set(inventory.map(stableIdentityKey));
  if (!inventory.length || inventory.length > 10000 || keys.size !== inventory.length) fail('the full-run inventory is empty or contains duplicate identities.');
  const journalPath = path.join(runDir, JOURNAL);
  let previous = ''; let sequence = 0;
  const append = event => {
    const entry = { sequence: sequence++, previous, event };
    const checksum = digest(JSON.stringify(entry));
    fs.appendFileSync(journalPath, JSON.stringify({ ...entry, checksum }) + '\n');
    previous = checksum;
  };
  // Exclusive creation protects an earlier authoritative or interrupted run.
  fs.writeFileSync(journalPath, '', { flag: 'wx' });
  append({ type: 'header', schemaVersion: 1, runId: preflight.runId || path.basename(runDir), mode: 'full', source: { version: source.version, sourceHash: source.sourceHash, commit: source.commit }, preflight: { ok: preflight.ok, sourceVersion: preflight.sourceVersion, deployedVersion: preflight.deployedVersion, firebaseProjectId: preflight.firebaseProjectId, appUrl: preflight.appUrl }, inventory, startedAt: new Date().toISOString() });
  return {
    record(type, test, result = {}) {
      const identity = testIdentity(test, root);
      if (!keys.has(stableIdentityKey(identity))) fail('a result is outside the captured full-run inventory.');
      append({ type, identity, status: type === 'end' ? result.status : 'running', retry: Number(result.retry || 0), at: new Date().toISOString() });
    },
    finish(status) { append({ type: 'finish', status, at: new Date().toISOString() }); },
  };
}

function readProgressJournal(runDir) {
  const file = path.join(runDir, JOURNAL);
  const size = fs.statSync(file).size;
  if (size > 8 * 1024 * 1024) fail('the progress artifact exceeds its size limit.');
  const bytes = fs.readFileSync(file);
  const lines = bytes.toString('utf8').split('\n');
  // An interrupted append may leave an incomplete last line. It cannot be
  // trusted as an end event; the preceding start event keeps that test pending.
  const incompleteTail = lines.pop() !== '';
  let previous = ''; let header = null; let finished = false;
  const attempts = new Map(); const active = new Set();
  for (let i = 0; i < lines.length; i++) {
    let row;
    try { row = JSON.parse(lines[i]); } catch (_) { fail('a completed journal line is malformed.'); }
    const { checksum, ...entry } = row;
    if (entry.sequence !== i || entry.previous !== previous || digest(JSON.stringify(entry)) !== checksum) fail('the progress artifact is truncated, reordered, or corrupt.');
    previous = checksum;
    const event = entry.event;
    if (i === 0) {
      if (event.type !== 'header' || event.schemaVersion !== 1 || event.mode !== 'full' || !Array.isArray(event.inventory)) fail('the progress header is unsupported.');
      header = event; continue;
    }
    if (finished) fail('the progress artifact contains events after its end marker.');
    if (event.type === 'finish') { finished = true; continue; }
    const key = stableIdentityKey(event.identity);
    if (!header.inventory.some(row => stableIdentityKey(row) === key)) fail('a journal result does not belong to its inventory.');
    if (event.type === 'start') { active.add(key); continue; }
    if (event.type !== 'end' || !['passed', 'failed', 'timedOut', 'skipped', 'interrupted'].includes(event.status)) fail('an event has an unknown result status.');
    if (!active.has(key)) fail('a completed test has no preceding start event.');
    active.delete(key);
    attempts.set(key, [...(attempts.get(key) || []), event.status]);
  }
  if (!header) fail('the progress header is missing.');
  return { header, attempts, active, incompleteTail, journalHash: digest(bytes) };
}

function buildPartialResumeManifest({ baselineRunDir, currentRunDir, root = process.cwd(), currentRecords, currentSource = captureSourceIdentity(root), target }) {
  if (!baselineRunDir || path.resolve(baselineRunDir) === path.resolve(currentRunDir || '')) fail('choose a different, existing interrupted run.');
  const evidence = readProgressJournal(baselineRunDir);
  const { header, attempts, active } = evidence;
  checkContext(header.source, header.preflight, currentSource, target);
  const priorSource = readJson(path.join(baselineRunDir, 'source-identity-start.json'));
  checkContext(priorSource, header.preflight, currentSource, target);
  const priorEndFile = path.join(baselineRunDir, 'source-identity-end.json');
  if (fs.existsSync(priorEndFile)) checkContext(readJson(priorEndFile), header.preflight, currentSource, target);
  const summaryFile = path.join(baselineRunDir, `86chaos-play-store-release-gate-summary-${header.source.version}-${header.runId}.json`);
  if (fs.existsSync(summaryFile) && readJson(summaryFile).fullReleaseCertified === true) fail('this run is already certified; there is no interrupted run to resume.');
  const inventory = header.inventory;
  const inventoryKeys = inventory.map(stableIdentityKey).sort();
  const currentKeys = currentRecords.map(stableIdentityKey).sort();
  if (new Set(inventoryKeys).size !== inventoryKeys.length || JSON.stringify(inventoryKeys) !== JSON.stringify(currentKeys)) fail('the exact full test inventory changed.');
  const selectedKeys = new Set();
  for (const row of inventory) {
    const key = stableIdentityKey(row); const statuses = attempts.get(key) || [];
    if (active.has(key) || !statuses.length || statuses.some(status => status !== 'passed')) selectedKeys.add(key);
  }
  // Rerun the existing skip companions in this invocation. Prior PASS rows are
  // never injected into the current report to manufacture coverage or totals.
  for (const row of inventory.filter(row => selectedKeys.has(stableIdentityKey(row)))) {
    const reference = { file: row.specPath, title: [row.fullSuitePath, row.leafTitle].filter(Boolean).join(' > '), projectName: row.project };
    for (const companion of requiredSkipCoverage(reference)) {
      const match = inventory.find(item => item.specPath === companion.file && [item.fullSuitePath, item.leafTitle].filter(Boolean).join(' > ') === companion.title && item.project === companion.projectName);
      if (!match) fail('required intentional-skip companion coverage is missing from the inventory.');
      selectedKeys.add(stableIdentityKey(match));
    }
  }
  const selected = inventory.filter(row => selectedKeys.has(stableIdentityKey(row))).map(row => {
    const key = stableIdentityKey(row); const statuses = attempts.get(key) || [];
    const priorStatus = active.has(key) ? 'notRun' : statuses.includes('timedOut') ? 'timedOut' : statuses.includes('failed') ? 'failed' : statuses.at(-1) || 'notRun';
    return { ...row, stableKey: key, title: row.leafTitle, exactTestTitle: row.leafTitle, projects: [row.project], priorStatus, baselineStatus: priorStatus, selectionReasons: [priorStatus === 'passed' ? 'required_skip_companion' : 'partial_resume_remaining'] };
  });
  if (!selected.length) fail('all captured tests passed; no resume selection remains. Use the complete gate report for certification.');
  return {
    ok: true, mode: 'partial-resume', lineageMode: 'partial-checkpoint', manifestSchemaVersion: 3,
    source: 'verified-current-full-run-checkpoint', selectionSource: 'verified-current-full-run-checkpoint',
    baselineFullRunDir: path.resolve(baselineRunDir), baselineFullRunId: header.runId,
    baselineSourceVersion: header.source.version, baselineDeployedVersion: header.preflight.deployedVersion,
    checkpointHash: evidence.journalHash, checkpointSourceHash: header.source.sourceHash,
    selected, totalSelected: selected.length, preservedCompletedPasses: inventory.length - selected.length,
    desktopSelected: selected.filter(row => row.project === 'chromium').length, mobileSelected: selected.filter(row => row.project === 'mobile-chromium').length,
    partialNotRunSelected: selected.filter(row => ['notRun', 'interrupted'].includes(row.priorStatus)).length,
    previousFailuresSelected: selected.filter(row => row.priorStatus === 'failed').length,
    previousTimeoutsSelected: selected.filter(row => row.priorStatus === 'timedOut').length,
    fullReleaseCertified: false, incompleteTailIgnored: evidence.incompleteTail,
    note: 'Completed tests are preserved as prior evidence only. Resume success is diagnostic; the complete release gate must certify the final source.',
  };
}

function selectPartialResumeManifest(options) {
  const { resultsRoot, currentRunDir, baselineRunDir } = options;
  if (baselineRunDir) return buildPartialResumeManifest(options);
  const candidates = fs.existsSync(resultsRoot) ? fs.readdirSync(resultsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => path.join(resultsRoot, entry.name))
    .filter(dir => path.resolve(dir) !== path.resolve(currentRunDir) && fs.existsSync(path.join(dir, JOURNAL))) : [];
  candidates.sort((a, b) => fs.statSync(path.join(b, JOURNAL)).mtimeMs - fs.statSync(path.join(a, JOURNAL)).mtimeMs);
  if (!candidates.length) fail('no current full-run checkpoint exists. Older versions did not capture incremental evidence. Start the complete gate; do not use the historical August selection.');
  // Do not silently fall back to an older run if the newest source is unsafe.
  return buildPartialResumeManifest({ ...options, baselineRunDir: candidates[0] });
}

function validatePartialResumeManifest(manifest, options) {
  try {
    const rebuilt = buildPartialResumeManifest({ ...options, baselineRunDir: manifest.baselineFullRunDir, target: options });
    if (rebuilt.checkpointHash !== manifest.checkpointHash || rebuilt.checkpointSourceHash !== manifest.checkpointSourceHash) fail('checkpoint identity changed after selection.');
    const keys = rows => rows.map(stableIdentityKey).sort();
    if (JSON.stringify(keys(rebuilt.selected)) !== JSON.stringify(keys(manifest.selected || []))) fail('the selection omits or adds identities compared with the verified checkpoint.');
    if (manifest.fullReleaseCertified !== false) fail('a partial run cannot certify a release.');
    return { ok: true, errors: [] };
  } catch (error) { return { ok: false, errors: [error.message] }; }
}

module.exports = { JOURNAL, testIdentity, createProgressJournal, readProgressJournal, buildPartialResumeManifest, selectPartialResumeManifest, validatePartialResumeManifest };
