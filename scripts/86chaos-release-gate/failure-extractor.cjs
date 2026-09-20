'use strict';

function normalizeLine(line) {
  return String(line || '').replace(/\u001b\[[0-9;]*m/g, '').trim();
}

function isSuccessfulLine(line) {
  const text = normalizeLine(line);
  return /^([✔✓]\s+)/.test(text)
    || /^PASS\b/i.test(text)
    || /^ok\b(?!\s*not\b)/i.test(text)
    || /^passed\b/i.test(text);
}

function isFailureLine(line) {
  const text = normalizeLine(line);
  return /^✖\s+/.test(text)
    || /^not ok\b/i.test(text)
    || /^FAIL\b/i.test(text);
}

function usefulFailureLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)
    .filter(line => !/^npm notice\b/i.test(line))
    .filter(line => !/\bno longer fails\b/i.test(line))
    .filter(line => !isSuccessfulLine(line));
}

function isIntentionalRulesDiagnostic(line) {
  const text = normalizeLine(line);
  return /@firebase\/firestore:.*PERMISSION_DENIED/i.test(text)
    || /^error\. Code:\s*7\s*Message:\s*7\s*PERMISSION_DENIED:?$/i.test(text)
    || /^evaluation error at L\d+:\d+ for/i.test(text)
    || /^false for '(create|read|list|get|update|delete)' @ L\d+/i.test(text)
    || /^'(create|read|list|get|update|delete)' @ L\d+/i.test(text);
}

function extractRulesPrimaryFailure(output = '') {
  const lines = usefulFailureLines(output);
  let currentCase = '';
  let lastCaseBeforeFailure = '';
  for (const line of lines) {
    const caseMatch = line.match(/^→\s*(.+)$/);
    if (caseMatch) {
      currentCase = caseMatch[1].trim();
      continue;
    }
    if (/^\[FirebaseError:/i.test(line) || /^FirebaseError:/i.test(line)) {
      lastCaseBeforeFailure = currentCase || lastCaseBeforeFailure;
      return `${lastCaseBeforeFailure ? `${lastCaseBeforeFailure}: ` : ''}${line}`;
    }
    if (/AssertionError|ERR_ASSERTION|assertSucceeds|assertFails|Expected.*succeed|Expected.*fail/i.test(line)) {
      lastCaseBeforeFailure = currentCase || lastCaseBeforeFailure;
      return `${lastCaseBeforeFailure ? `${lastCaseBeforeFailure}: ` : ''}${line}`;
    }
  }
  const nonDiagnostic = lines.find(line => !isIntentionalRulesDiagnostic(line) && /exception|firebaseerror|assertionerror|syntaxerror|referenceerror|typeerror|error:|\berror\b|failed|\bfail\b|not found|cannot find|missing dependency|exited with code/i.test(line));
  return nonDiagnostic || '';
}

function extractNodeTestFailure(output = '') {
  const rawLines = String(output || '').split(/\r?\n/).map(normalizeLine);
  const lines = rawLines.filter(Boolean);
  let inFailingSection = false;
  let failingFile = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isSuccessfulLine(line)) continue;
    if (/^✖\s+failing tests:/i.test(line) || /^#\s*fail\b/i.test(line)) {
      inFailingSection = true;
      continue;
    }
    if (!inFailingSection) continue;
    const fileMatch = line.match(/^test at\s+(.+?):\d+:\d+$/i);
    if (fileMatch) {
      failingFile = fileMatch[1].trim();
      continue;
    }
    const failureMarker = line.match(/^✖\s+(.+)$/) || line.match(/^not ok\b[^-]*-\s*(.+)$/i);
    if (failureMarker) {
      const title = failureMarker[1].trim();
      let assertion = '';
      for (let j = i + 1; j < Math.min(lines.length, i + 8); j += 1) {
        const next = lines[j];
        if (isSuccessfulLine(next)) continue;
        if (/AssertionError|ERR_ASSERTION|SyntaxError|ReferenceError|TypeError|Error:/i.test(next)) {
          assertion = next.replace(/^#\s*/, '').trim();
          break;
        }
      }
      return [failingFile, title, assertion].filter(Boolean).join(': ');
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isSuccessfulLine(line)) continue;
    const failureMarker = line.match(/^✖\s+(.+)$/) || line.match(/^not ok\b[^-]*-\s*(.+)$/i) || line.match(/^FAIL\s+(.+)$/i);
    if (failureMarker && !/^✖\s+failing tests:/i.test(line)) {
      let assertion = '';
      for (let j = i + 1; j < Math.min(lines.length, i + 8); j += 1) {
        const next = lines[j];
        if (isSuccessfulLine(next)) continue;
        if (/AssertionError|ERR_ASSERTION|SyntaxError|ReferenceError|TypeError|Error:/i.test(next)) {
          assertion = next.replace(/^#\s*/, '').trim();
          break;
        }
      }
      return [failureMarker[1].trim(), assertion].filter(Boolean).join(': ');
    }
  }

  const assertion = lines.find(line => !isSuccessfulLine(line) && /AssertionError|ERR_ASSERTION/i.test(line));
  if (assertion) return assertion;
  const fatal = lines.find(line => !isSuccessfulLine(line) && /SyntaxError|ReferenceError|TypeError|ERR_MODULE_NOT_FOUND|Cannot find module|UnhandledPromiseRejection|FATAL ERROR|Error:/i.test(line));
  return fatal || '';
}


function createActionableFailureCapture({ maxChars = 65536, contextBefore = 8, contextAfter = 10 } = {}) {
  const limit = Math.max(4096, Number(maxChars) || 65536);
  const beforeLimit = Math.max(2, Number(contextBefore) || 8);
  const afterLimit = Math.max(2, Number(contextAfter) || 10);
  const lineLimit = Math.min(8192, Math.max(1024, Math.floor(limit / 2)));
  const pendingLimit = Math.min(2048, Math.max(512, Math.floor(lineLimit / 2)));
  const boundaryOverlap = Math.min(512, pendingLimit);
  const diagnosticLimit = Math.min(4096, Math.max(1024, Math.floor(limit / 4)));
  const dedupeLimit = 64;
  const dedupeKeyLimit = 160;

  let pending = '';
  let remainingAfter = 0;
  let evidenceChars = 0;
  let diagnosticChars = 0;
  const evidence = [];
  const diagnostics = [];
  const recent = [];
  const dedupeKeys = [];
  const dedupe = new Set();

  const copyString = text => Buffer.from(String(text || ''), 'utf8').toString('utf8');

  const boundedSliceAround = (text, index = 0) => {
    const raw = String(text || '');
    if (raw.length <= lineLimit) return copyString(raw);
    const center = Math.max(0, Math.min(raw.length, Number(index) || 0));
    const half = Math.floor(lineLimit / 2);
    let start = Math.max(0, center - half);
    if (start + lineLimit > raw.length) start = Math.max(0, raw.length - lineLimit);
    const slice = raw.slice(start, start + lineLimit);
    return copyString(`${start > 0 ? '…' : ''}${slice}${start + lineLimit < raw.length ? '…' : ''}`);
  };

  const remember = line => {
    const key = normalizeLine(line).slice(0, dedupeKeyLimit);
    if (!key) return false;
    if (dedupe.has(key)) return false;
    dedupe.add(key);
    dedupeKeys.push(key);
    while (dedupeKeys.length > dedupeLimit) {
      const oldest = dedupeKeys.shift();
      dedupe.delete(oldest);
    }
    return true;
  };

  const normalizedBounded = (line, index = 0) => normalizeLine(boundedSliceAround(line, index));
  const appendEvidence = (line, priority = 1) => {
    const normalized = normalizedBounded(line);
    if (!normalized || isSuccessfulLine(normalized) || /^npm notice\b/i.test(normalized)) return;
    if (!remember(`e:${normalized}`)) return;
    evidence.push({ line: normalized, priority: Number(priority) || 1 });
    evidenceChars += normalized.length + 1;
    while (evidenceChars > limit && evidence.length) {
      let minPriority = evidence[0].priority;
      for (const row of evidence) minPriority = Math.min(minPriority, row.priority);
      const index = evidence.findIndex(row => row.priority === minPriority);
      const [removed] = evidence.splice(index < 0 ? 0 : index, 1);
      evidenceChars -= removed.line.length + 1;
    }
  };

  const appendDiagnostic = line => {
    const normalized = normalizedBounded(line);
    if (!normalized || isSuccessfulLine(normalized) || /^npm notice\b/i.test(normalized)) return;
    if (!remember(`d:${normalized}`)) return;
    diagnostics.push(normalized);
    diagnosticChars += normalized.length + 1;
    while (diagnosticChars > diagnosticLimit && diagnostics.length) {
      const removed = diagnostics.shift();
      diagnosticChars -= removed.length + 1;
    }
  };

  const priorityFor = line => {
    const normalized = normalizeLine(line);
    if (!normalized) return -1;
    if (isIntentionalRulesDiagnostic(normalized)) return 0;
    if (/^✖\s+/.test(normalized)
      || /^not ok\b/i.test(normalized)
      || /^FAIL\b/i.test(normalized)
      || /^test at\s+/i.test(normalized)
      || /AssertionError|ERR_ASSERTION|SyntaxError|ReferenceError|TypeError|ERR_MODULE_NOT_FOUND|Cannot find module|UnhandledPromiseRejection|FATAL ERROR/i.test(normalized)) return 3;
    if (/^\[?FirebaseError\b|\bFirebaseError\b|\bError(?:\s*\[[^\]]+\])?:/i.test(normalized)) return 2;
    if (/PERMISSION_DENIED|permission-denied/i.test(normalized)) return 1;
    return -1;
  };

  const pushRecent = line => {
    const normalized = normalizedBounded(line);
    if (!normalized) return;
    recent.push(normalized);
    while (recent.length > beforeLimit) recent.shift();
  };

  const processNormalizedLine = normalized => {
    if (!normalized) return;
    const priority = priorityFor(normalized);
    if (priority === 0) {
      appendDiagnostic(normalized);
      pushRecent(normalized);
      return;
    }
    if (priority > 0) {
      for (const prior of recent) {
        if (isIntentionalRulesDiagnostic(prior)) appendDiagnostic(prior);
        else appendEvidence(prior, 1);
      }
      appendEvidence(normalized, priority);
      remainingAfter = afterLimit;
    } else if (remainingAfter > 0) {
      if (isIntentionalRulesDiagnostic(normalized)) appendDiagnostic(normalized);
      else appendEvidence(normalized, 1);
      remainingAfter -= 1;
    }
    pushRecent(normalized);
  };

  const triggerPattern = /✖\s+|not ok\b|\bFAIL\b|test at\s+|AssertionError|ERR_ASSERTION|SyntaxError|ReferenceError|TypeError|ERR_MODULE_NOT_FOUND|Cannot find module|UnhandledPromiseRejection|FATAL ERROR|FirebaseError|PERMISSION_DENIED|permission-denied|\bError(?:\s*\[[^\]]+\])?:/ig;

  const processRawLine = line => {
    const raw = String(line || '').replace(/\r$/, '');
    if (!raw) return;
    if (raw.length <= lineLimit) {
      processNormalizedLine(normalizeLine(raw));
      return;
    }

    let matched = false;
    let matchCount = 0;
    triggerPattern.lastIndex = 0;
    for (let match = triggerPattern.exec(raw); match && matchCount < 12; match = triggerPattern.exec(raw)) {
      matched = true;
      matchCount += 1;
      processNormalizedLine(normalizeLine(boundedSliceAround(raw, match.index)));
      if (match[0].length === 0) triggerPattern.lastIndex += 1;
    }
    triggerPattern.lastIndex = 0;

    if (!matched) {
      const boundedTail = normalizeLine(raw.slice(-lineLimit));
      if (remainingAfter > 0) processNormalizedLine(boundedTail);
      else pushRecent(boundedTail);
    }
  };

  const feed = chunk => {
    const incoming = String(chunk || '');
    if (!incoming) return;
    const data = pending ? `${pending}${incoming}` : incoming;
    let start = 0;
    let newline = data.indexOf('\n', start);
    while (newline !== -1) {
      processRawLine(data.slice(start, newline));
      start = newline + 1;
      newline = data.indexOf('\n', start);
    }
    const remainder = data.slice(start);
    if (remainder.length <= pendingLimit) {
      pending = remainder;
      return;
    }

    const safeLength = Math.max(0, remainder.length - boundaryOverlap);
    if (safeLength > 0) processRawLine(remainder.slice(0, safeLength));
    pending = copyString(remainder.slice(-boundaryOverlap));
  };

  const buildEvidence = () => {
    if (evidence.length) return evidence.map(row => row.line).join('\n').slice(0, limit);
    return diagnostics.join('\n').slice(0, limit);
  };

  const retainedState = () => {
    const recentChars = recent.reduce((sum, line) => sum + line.length, 0);
    const dedupeChars = dedupeKeys.reduce((sum, key) => sum + key.length, 0);
    return {
      maxChars: limit,
      pendingChars: pending.length,
      evidenceChars,
      diagnosticChars,
      recentChars,
      dedupeChars,
      dedupeKeys: dedupeKeys.length,
      evidenceEntries: evidence.length,
      diagnosticEntries: diagnostics.length,
      totalRetainedChars: pending.length + evidenceChars + diagnosticChars + recentChars + dedupeChars,
    };
  };

  const finish = () => {
    if (pending) processRawLine(pending);
    pending = '';
    return buildEvidence();
  };

  return {
    feed,
    finish,
    get value() { return buildEvidence(); },
    get retainedState() { return retainedState(); },
  };
}

function firstUsefulFailureFromOutput(child = {}) {
  if (child.error?.message) return child.error.message;
  const status = typeof child.status === 'number' ? child.status : null;
  if (status === 0) return '';
  const diagnostic = String(child.failureEvidence || child.actionableFailure || '');
  const combined = `${diagnostic}${diagnostic ? '\n' : ''}${child.stderr || ''}\n${child.stdout || ''}`;
  const looksLikeNodeTestOutput = /(^|\n)TAP version\s+\d+|(^|\n)# Subtest:|(^|\n)✖\s+failing tests:|(^|\n)not ok\b|(^|\n)test at\s+/i.test(combined);
  if (looksLikeNodeTestOutput) {
    const nodeFailure = extractNodeTestFailure(combined);
    if (nodeFailure) return nodeFailure;
  }
  const rulesFailure = extractRulesPrimaryFailure(combined);
  if (rulesFailure) return rulesFailure;
  const nodeFailure = extractNodeTestFailure(combined);
  if (nodeFailure) return nodeFailure;
  const lines = usefulFailureLines(combined);
  const actionable = lines.find(line => !isIntentionalRulesDiagnostic(line) && /exception|firebaseerror|assertionerror|syntaxerror|referenceerror|typeerror|error:|\berror\b|failed|\bfail\b|not found|cannot find|missing dependency|exited with code|denied|permission_denied/i.test(line));
  if (actionable) return actionable;
  const denial = lines.find(line => isIntentionalRulesDiagnostic(line) && /PERMISSION_DENIED|permission-denied/i.test(line));
  return denial ? `Firebase permission denial in failing command: ${denial}` : '';
}

module.exports = {
  normalizeLine,
  isSuccessfulLine,
  isFailureLine,
  usefulFailureLines,
  isIntentionalRulesDiagnostic,
  extractRulesPrimaryFailure,
  extractNodeTestFailure,
  firstUsefulFailureFromOutput,
  createActionableFailureCapture,
};
