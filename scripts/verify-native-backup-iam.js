#!/usr/bin/env node
'use strict';
function clean(value = '') { return String(value == null ? '' : value).trim(); }
function parseJson(raw = '') { try { return JSON.parse(String(raw || '').trim()); } catch (_) { return null; } }
function credentialStatus(projectId) {
  try {
    const helper = require('../api/_firebase-project-admin');
    if (helper && typeof helper.projectCredentialStatus === 'function') return helper.projectCredentialStatus(projectId);
  } catch (_) {}
  const envCandidates = projectId === 'cheers-34b8d'
    ? ['FIREBASE_PRODUCTION_SERVICE_ACCOUNT_KEY', 'PROD_FIREBASE_SERVICE_ACCOUNT_KEY', 'FIREBASE_SERVICE_ACCOUNT_KEY']
    : ['FIREBASE_TEST_SERVICE_ACCOUNT_KEY', 'TEST_FIREBASE_SERVICE_ACCOUNT_KEY', 'FIREBASE_SERVICE_ACCOUNT_KEY'];
  for (const name of envCandidates) {
    const parsed = parseJson(process.env[name]);
    const email = clean(parsed?.client_email || parsed?.clientEmail);
    if (email) return { configured: true, projectId, source: name, serviceAccountEmail: email };
  }
  const directEmail = projectId === 'cheers-34b8d'
    ? clean(process.env.FIREBASE_PRODUCTION_CLIENT_EMAIL || process.env.PROD_FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL)
    : clean(process.env.FIREBASE_TEST_CLIENT_EMAIL || process.env.TEST_FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL);
  return { configured: Boolean(directEmail), projectId, source: directEmail ? 'CLIENT_EMAIL_ENV' : '', serviceAccountEmail: directEmail };
}

const projectId = process.argv.includes('--project')
  ? process.argv[process.argv.indexOf('--project') + 1]
  : (process.env.FIREBASE_PRODUCTION_PROJECT_ID || process.env.PROD_FIREBASE_PROJECT_ID || 'cheers-34b8d');
const databaseId = process.env.FIRESTORE_NATIVE_BACKUP_DATABASE_ID || '(default)';
const status = credentialStatus(projectId);
const email = status.serviceAccountEmail || '<ACTUAL_RUNTIME_SERVICE_ACCOUNT_EMAIL>';
console.log('86 Chaos native Firestore backup IAM check');
console.log(`Project: ${projectId}`);
console.log(`Database: ${databaseId}`);
console.log(`Credential source: ${status.source || status.recommendedEnv || status.error || 'unknown'}`);
console.log(`Runtime service account: ${email}`);
console.log('Required permissions: datastore.backupSchedules.list, datastore.backups.list');
console.log('Recommended least-privilege roles: roles/datastore.backupSchedulesViewer, roles/datastore.backupsViewer');
console.log('');
if (!status.serviceAccountEmail) {
  console.log('The service-account email was not available in this local environment. Deploy 16.0.169 and use the Watchdog IAM diagnostic response, or run this script where production Firebase credentials are available.');
  console.log('');
}
console.log('Copyable IAM commands:');
console.log(`gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${email}" --role="roles/datastore.backupSchedulesViewer"`);
console.log(`gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${email}" --role="roles/datastore.backupsViewer"`);
console.log('');
console.log('Verify:');
console.log(`gcloud projects get-iam-policy ${projectId} --flatten="bindings[].members" --filter="bindings.members:${email}" --format="table(bindings.role)"`);
