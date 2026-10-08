'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { CONNECT_POLICY } = require('../../scripts/yardmaster-readiness.cjs');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const directive = (policy, name) => String(policy || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name} `)) || '';

test.describe('runtime isolation regression', () => {
  test('Firebase Auth browser bootstrap is allowed without granting live Firebase connect-src', async () => {
    expect(`${directive(CONNECT_POLICY, 'script-src')} ${directive(CONNECT_POLICY, 'script-src-elem')}`).toContain('https://*.google.com');
    expect(directive(CONNECT_POLICY, 'frame-src')).toContain('https://*.firebaseapp.com');
    expect(directive(CONNECT_POLICY, 'connect-src')).not.toMatch(/googleapis\.com|firebaseio\.com|firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/);
  });

  test('shared QA language state is restored persistently and nested sticky math remains scrollport-relative', async () => {
    const spanish = read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');
    const sticky = read('tests/86chaos-release-gate/54-emergency-schedule-requestoff.spec.cjs');
    expect(spanish).toContain("saveLanguagePreference(page, 'en', { verifyReload: true })");
    expect(spanish).toContain('must survive a fresh authenticated reload');
    expect(sticky).toContain('expectedTop: Math.max(pinnedViewportTop, before.initialTop - scrollDelta)');
  });

  test('captured System Administrator scroll regions remain keyboard reachable', async () => {
    const source = read('src/features/management.jsx');
    for (const label of ['Full Vercel API route manifest', 'Administrator session timeline', 'Global forensics and ghost audit records']) {
      expect(source).toContain(`role="region" aria-label="${label}" tabIndex={0}`);
    }
  });
});
