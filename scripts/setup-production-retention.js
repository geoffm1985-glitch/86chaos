#!/usr/bin/env node
/*
  86 Chaos production retention setup helper.

  This script does NOT delete customer data and does NOT create Google Cloud
  buckets or Cloud Scheduler jobs. It writes the legal retention policy marker
  into Firestore so the production project has an auditable configuration record.

  Run after setting FIREBASE_SERVICE_ACCOUNT_KEY to the production service
  account JSON, or set GOOGLE_APPLICATION_CREDENTIALS to a production service
  account file path.
*/
const admin = require('firebase-admin');

const POLICY = Object.freeze({
  policySource: '86 Chaos Legal Document Packet - Security, Backup, and Data Retention Policy section 6.4',
  policyVersion: '2026-07-09',
  activeCoreData: 'while_account_active',
  transientDays: 30,
  rawAiDays: 30,
  deletedWorkspaceDays: 30,
  backupDays: 30,
  auditSecurityDays: 365,
  workforceArchiveAfterDays: 365,
  workforceDeleteAfterYears: 3,
});

function loadCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (raw) return admin.credential.cert(JSON.parse(raw));
  return admin.credential.applicationDefault();
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || undefined;
  admin.initializeApp({ credential: loadCredential(), projectId });
  const db = admin.firestore();
  const payload = {
    ...POLICY,
    app: '86 Chaos',
    appVersion: '15.0.65',
    updatedAt: new Date().toISOString(),
    updatedBy: process.env.RETENTION_SETUP_ACTOR || 'retention-setup-script',
    automations: {
      purgeTransientOperationalData: '30-day transient prep/86/locks/rate-limit cleanup',
      purgeExpiredAiUploads: '30-day raw AI uploads and raw AI prompt/request cleanup',
      archiveExpiredTimeClockData: 'Archive active time-clock/geofence records after 1 year',
      purgeExpiredTimeClockArchives: 'Delete archived time-clock/geofence files after 3 years from event date',
      purgeExpiredDatabaseBackups: '30-day rolling database backup cleanup',
      hardDeleteExpiredWorkspaces: '30-day deleted-workspace hard-delete grace period',
      purgeExpiredAuditSecurityLogs: '1-year audit/security log cleanup',
    },
    requiredFunctionEnv: {
      RETENTION_ARCHIVE_BUCKET: process.env.RETENTION_ARCHIVE_BUCKET || '',
      AI_UPLOADS_BUCKET: process.env.AI_UPLOADS_BUCKET || '',
    },
    notes: [
      'This script records the policy and setup state only. Scheduled deletion requires deploying Firebase Functions.',
      'Create the production archive bucket outside the app and set RETENTION_ARCHIVE_BUCKET before deploying functions.',
      'Run a fresh production backup before the first retention deployment.',
    ],
  };
  await db.collection('system').doc('dataRetention').set(payload, { merge: true });
  await db.collection('auditLogs').add({
    restaurantId: 'platform',
    action: 'DATA_RETENTION_CONFIG_INITIALIZED',
    target: 'system/dataRetention',
    details: 'Production legal retention configuration initialized/updated by setup script.',
    userId: payload.updatedBy,
    userName: payload.updatedBy,
    timestamp: payload.updatedAt,
    source: 'script',
  }).catch(() => null);
  console.log('✅ 86 Chaos data retention config saved to system/dataRetention');
  console.log('Policy:', JSON.stringify(POLICY, null, 2));
  console.log('\nNext steps:');
  console.log('1. Create production archive bucket.');
  console.log('2. Set functions env: RETENTION_ARCHIVE_BUCKET=<bucket-name>');
  console.log('3. Run: npm --prefix functions install && npm --prefix functions run build');
  console.log('4. Run: firebase deploy --only functions --project <production-project-id>');
  console.log('5. Check Firebase Functions + Cloud Scheduler for the retention jobs.');
}

main().catch((error) => {
  console.error('❌ Retention setup failed:', error.message || error);
  process.exit(1);
});
