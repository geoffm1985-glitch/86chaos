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

function firstUsefulFailureFromOutput(child = {}) {
  if (child.error?.message) return child.error.message;
  const status = typeof child.status === 'number' ? child.status : null;
  if (status === 0) return '';
  const combined = `${child.stderr || ''}\n${child.stdout || ''}`;
  const looksLikeNodeTestOutput = /(^|\n)TAP version\s+\d+|(^|\n)# Subtest:|(^|\n)✖\s+failing tests:/i.test(combined);
  if (looksLikeNodeTestOutput) {
    const nodeFailure = extractNodeTestFailure(combined);
    if (nodeFailure) return nodeFailure;
  }
  const rulesFailure = extractRulesPrimaryFailure(combined);
  if (rulesFailure) return rulesFailure;
  const nodeFailure = extractNodeTestFailure(combined);
  if (nodeFailure) return nodeFailure;
  const lines = usefulFailureLines(combined);
  return lines.find(line => !isIntentionalRulesDiagnostic(line) && /exception|firebaseerror|assertionerror|syntaxerror|referenceerror|typeerror|error:|\berror\b|failed|\bfail\b|not found|cannot find|missing dependency|exited with code|denied|permission_denied/i.test(line)) || '';
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
};
