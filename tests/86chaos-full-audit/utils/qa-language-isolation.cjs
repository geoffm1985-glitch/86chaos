'use strict';

async function restoreQaLanguage({ account, seed, runId, config, signed, origin, fetchImpl = global.fetch }) {
  const expectedRole = seed?.roleAccounts?.find(row => row.uid === signed?.uid);
  if (!seed?.ok || seed.runId !== runId || !runId) throw new Error('Language cleanup requires the verified current QA seed.');
  if (!['chaos-test-d1601', 'demo-86chaos'].includes(config?.projectId) || seed.firebaseProjectId !== config.projectId || signed?.firebaseProjectId !== config.projectId) throw new Error('Language cleanup refused a foreign Firebase project.');
  if (!account?.email?.endsWith('@example.test') || !expectedRole || expectedRole.email !== account.email || signed.email !== account.email) throw new Error('Language cleanup refused an unverified QA account.');
  const url = new URL(`/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/users/${encodeURIComponent(signed.uid)}`, origin);
  const headers = { Authorization: `Bearer ${signed.idToken}`, 'Content-Type': 'application/json' };
  const send = async (target, init = {}) => {
    const response = await fetchImpl(target, { ...init, headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`QA language cleanup request failed (${response.status}).`);
    return response.json();
  };
  const before = await send(url);
  if (before.fields?.qaRoleAccount?.booleanValue !== true || before.fields?.qaLastRunId?.stringValue !== runId || before.fields?.email?.stringValue !== account.email) throw new Error('Language cleanup refused a stale or unowned user profile.');
  url.searchParams.set('updateMask.fieldPaths', 'preferences.language');
  await send(url, { method: 'PATCH', body: JSON.stringify({ fields: { preferences: { mapValue: { fields: { language: { stringValue: 'en' } } } } } }) });
  url.search = '';
  const after = await send(url);
  if (after.fields?.preferences?.mapValue?.fields?.language?.stringValue !== 'en') throw new Error('QA language cleanup could not verify the saved English preference.');
}

async function restoreCurrentQaLanguage(account) {
  const { readSeedReport, RUN_ID } = require('./audit-helpers.cjs');
  const { readFirebaseConfig, signInAccount } = require('../../../scripts/86chaos-release-gate/verify-role-accounts.cjs');
  const { firestoreRestOrigin } = require('../../../scripts/86chaos-firebase-target.cjs');
  const config = readFirebaseConfig();
  const signed = await signInAccount(account, config, (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }));
  await restoreQaLanguage({ account, seed: readSeedReport(), runId: RUN_ID, config, signed, origin: firestoreRestOrigin(process.env) });
}

module.exports = { restoreQaLanguage, restoreCurrentQaLanguage };
