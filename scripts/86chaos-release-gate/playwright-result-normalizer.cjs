'use strict';

const path = require('path');
const { stableIdentityKey, normalizeRel } = require('./playwright-inventory.cjs');

function normalizeTitle(value = '') {
  return String(value || '').replace(/\s+›\s+/g, ' > ').replace(/\s+/g, ' ').trim();
}
function normalizeSpec(value = '') {
  return normalizeRel(String(value || '').replace(/\\/g, '/'));
}
function stripFileTitlePrefix(spec = '', parts = []) {
  const normalizedSpec = normalizeSpec(spec);
  const prefixes = new Set([
    normalizedSpec,
    normalizedSpec ? `tests/${normalizedSpec}` : '',
    normalizedSpec ? path.basename(normalizedSpec) : '',
  ].filter(Boolean).map(v => normalizeTitle(v).replace(/\\/g, '/')));
  const copy = [...parts].map(v => normalizeTitle(v).replace(/\\/g, '/')).filter(Boolean);
  while (copy.length && prefixes.has(copy[0])) copy.shift();
  return copy;
}
function finalStatusFor(test = {}, attempts = []) {
  const final = attempts[attempts.length - 1];
  if (final?.status) return final.status;
  if (test.status) return test.status;
  if (test.expectedStatus === 'skipped') return 'skipped';
  return 'unknown';
}
function normalizeAttempt(result = {}, index = 0) {
  return {
    attempt: index + 1,
    retry: Number.isInteger(result.retry) ? result.retry : index,
    status: String(result.status || 'unknown'),
    duration: Number(result.duration || 0),
    error: result.error?.message || result.error?.value || '',
    errors: Array.isArray(result.errors) ? result.errors.map(e => e?.message || e?.value || String(e || '')).filter(Boolean) : [],
  };
}
function normalizePlaywrightResults(report = {}) {
  const tests = [];
  const duplicateExecutions = [];
  const seen = new Map();
  let attemptsTotal = 0;

  function walk(suites = [], parents = []) {
    for (const suite of suites || []) {
      const nextParents = suite.title ? [...parents, suite.title] : parents;
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          const specPath = normalizeSpec(spec.file || test.file || '');
          const leafTitle = normalizeTitle(spec.title || test.title || '');
          const suiteParts = stripFileTitlePrefix(specPath, nextParents);
          const fullSuitePath = suiteParts.join(' > ');
          const attempts = (test.results || []).map(normalizeAttempt);
          attemptsTotal += attempts.length;
          const status = finalStatusFor(test, attempts);
          const finalAttempt = attempts[attempts.length - 1] || { duration: 0, error: '' };
          const projectName = String(test.projectName || test.project || '');
          const identity = { specPath, fullSuitePath, leafTitle, exactTestTitle: leafTitle, project: projectName };
          const stableKey = stableIdentityKey(identity);
          const row = {
            ...identity,
            stableKey,
            projectName,
            file: specPath,
            title: [...suiteParts, leafTitle].filter(Boolean).join(' > '),
            status,
            duration: attempts.reduce((sum, attempt) => sum + Number(attempt.duration || 0), 0),
            finalAttemptDuration: Number(finalAttempt.duration || 0),
            error: finalAttempt.error || attempts.slice().reverse().find(a => a.error)?.error || '',
            annotations: (test.annotations || finalAttempt.annotations || []).filter?.(annotation => annotation.type === 'skip').map(annotation => ({ type: 'skip', description: annotation.description || '' })) || [],
            attempts,
            attemptCount: attempts.length,
            retryCount: Math.max(0, attempts.length - 1),
            flaky: attempts.length > 1 && status === 'passed' && attempts.slice(0, -1).some(attempt => !['passed', 'skipped'].includes(attempt.status)),
          };
          if (seen.has(stableKey)) duplicateExecutions.push({ stableKey, first: seen.get(stableKey), duplicate: row });
          else seen.set(stableKey, row);
          tests.push(row);
        }
      }
      walk(suite.suites || [], nextParents);
    }
  }
  walk(report.suites || []);
  return {
    tests,
    attemptsTotal,
    retryCount: tests.reduce((sum, row) => sum + row.retryCount, 0),
    flakyTests: tests.filter(row => row.flaky),
    duplicateExecutions,
    duplicateExecutionCount: duplicateExecutions.length,
  };
}

module.exports = {
  normalizeTitle,
  normalizeSpec,
  stripFileTitlePrefix,
  normalizePlaywrightResults,
};
