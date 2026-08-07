'use strict';

function normalizeLine(line) {
  return String(line || '').replace(/\u001b\[[0-9;]*m/g, '').trim();
}

function usefulFailureLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)
    .filter(line => !/^npm notice\b/i.test(line))
    .filter(line => !/\bno longer fails\b/i.test(line))
    .filter(line => !/^✓\s/.test(line))
    .filter(line => !/^PASS\b/.test(line))
    .filter(line => !/^passed\b/i.test(line));
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

function firstUsefulFailureFromOutput(child = {}) {
  if (child.error?.message) return child.error.message;
  const combined = `${child.stderr || ''}\n${child.stdout || ''}`;
  const rulesFailure = extractRulesPrimaryFailure(combined);
  if (rulesFailure) return rulesFailure;
  const lines = usefulFailureLines(combined);
  return lines.find(line => !isIntentionalRulesDiagnostic(line) && /exception|firebaseerror|assertionerror|syntaxerror|referenceerror|typeerror|error:|\berror\b|failed|\bfail\b|not found|cannot find|missing dependency|exited with code|denied|permission_denied/i.test(line)) || '';
}

module.exports = {
  normalizeLine,
  usefulFailureLines,
  isIntentionalRulesDiagnostic,
  extractRulesPrimaryFailure,
  firstUsefulFailureFromOutput,
};
