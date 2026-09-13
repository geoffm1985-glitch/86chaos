import { firestoreHealthEvidence, restoreDrillNeedsAttention, deploymentEvidenceChecks } from './adminHealthEvidence';

test.each([undefined, { status: 0, error: 'Timeout' }, { status: 503, result: {} }, { status: 200, result: {} }])('missing Firestore evidence stays unavailable: %p', check => {
  expect(firestoreHealthEvidence(check)).toMatchObject({ firestoreReadOk: null, firestoreLatencyMs: null, firestoreStatus: 'unavailable' });
});

test('an explicit failed Firestore read cannot be healthy even on HTTP 200', () => {
  expect(firestoreHealthEvidence({ status: 200, ms: 5, result: { firestoreReadOk: false, firestoreLatencyMs: 25 } })).toMatchObject({ firestoreReadOk: false, firestoreStatus: 'failed', firestoreLatencyMs: 25 });
});

test('successful Firestore reads use server measurement, never HTTP request duration', () => {
  expect(firestoreHealthEvidence({ status: 200, ms: 8, result: { firestoreReadOk: true, firestoreLatencyMs: 950 } }).firestoreStatus).toBe('slow');
  expect(firestoreHealthEvidence({ status: 200, ms: 8, result: { firestoreReadOk: true } })).toMatchObject({ firestoreReadOk: true, firestoreLatencyMs: null, firestoreStatus: 'available' });
});

test.each(['planned', 'failed', 'needs_followup', 'unknown', undefined])('a %p restore report cannot show passed health', status => {
  expect(restoreDrillNeedsAttention({ status, lastDrillAt: '2026-09-10T00:00:00Z' }, Date.parse('2026-09-10T01:00:00Z'))).toBe(true);
});

test('only a recent, non-future passed restore report clears attention', () => {
  const report = { status: 'passed', lastDrillAt: '2026-09-10T00:00:00Z' };
  expect(restoreDrillNeedsAttention(report, Date.parse('2026-09-10T01:00:00Z'))).toBe(false);
  expect(restoreDrillNeedsAttention(report, Date.parse('2026-11-10T01:00:00Z'))).toBe(true);
  expect(restoreDrillNeedsAttention(report, Date.parse('2026-09-09T01:00:00Z'))).toBe(true);
});

test('unrun deployment checks cannot claim readiness or rules/security verification', () => {
  const checks = deploymentEvidenceChecks({ projectId: 'testing', version: '16.0.231', host: 'preview.example', pushDevices: 3 });
  expect(checks.every(check => check.ok === true)).toBe(false);
  expect(checks.filter(check => check.ok === true).map(check => check.label)).toEqual(['Firebase project ID', 'Running app version']);
  expect(checks.find(check => check.label === 'API routes responding').ok).toBe(null);
  expect(checks.find(check => check.label === 'Backup integrity').ok).toBe(null);
});

test('successful API and integrity observations remain useful without fabricating release certification', () => {
  const checks = deploymentEvidenceChecks({ healthSnapshot: { apiChecks: [{ label: 'Storage Usage / Backup List', ok: true }] }, backupStatus: { lastIntegrityStatus: 'verified' }, backupIsStale: false });
  expect(checks.find(check => check.label === 'API routes responding').ok).toBe(true);
  expect(checks.find(check => check.label === 'Backup integrity').ok).toBe(true);
  expect(checks.find(check => check.label === 'Source ZIP and release certification').ok).toBe(null);
});
