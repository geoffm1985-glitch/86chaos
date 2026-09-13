// Present only observations made by the existing diagnostic routes. Missing
// evidence is distinct from both a successful check and a failed check.
export function firestoreHealthEvidence(check) {
  const result = check?.result;
  const observed = check?.status >= 200 && check.status < 300 && typeof result?.firestoreReadOk === 'boolean';
  const readOk = observed ? result.firestoreReadOk : null;
  const rawLatency = result?.firestoreLatencyMs;
  const latencyMs = observed && typeof rawLatency === 'number' && Number.isFinite(rawLatency) && rawLatency >= 0 ? rawLatency : null;
  return {
    firestoreReadOk: readOk,
    firestoreLatencyMs: latencyMs,
    firestoreStatus: readOk === null ? 'unavailable' : readOk === false ? 'failed' : latencyMs === null ? 'available' : latencyMs < 800 ? 'healthy' : latencyMs < 1800 ? 'slow' : 'degraded',
    firestoreError: readOk === null ? check?.error || 'The server Firestore check did not return a result.' : result.firestoreError || '',
    firestoreErrorCategory: readOk === null ? 'check_unavailable' : result.firestoreErrorCategory || '',
  };
}

export function restoreDrillNeedsAttention(record, now = Date.now()) {
  const timestamp = Date.parse(record?.lastDrillAt || record?.updatedAt || '');
  return String(record?.status || '').toLowerCase() !== 'passed' || !Number.isFinite(timestamp)
    || timestamp > now || now - timestamp > 35 * 86400000;
}

export function deploymentEvidenceChecks({ projectId, version, host, healthSnapshot, backupStatus, backupIsStale, backupListError, pushDevices = 0 } = {}) {
  const checks = healthSnapshot?.apiChecks || [];
  const storage = checks.find(check => check.label === 'Storage Usage / Backup List');
  const integrity = String(backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status || '').toLowerCase();
  const unknown = (label, detail) => ({ label, ok: null, detail });
  return [
    { label: 'Firebase project ID', ok: Boolean(projectId), detail: projectId || 'Missing browser Firebase project ID' },
    unknown('Firestore rules publication', 'Runtime reads cannot verify which rules are published. Use the rules deployment and release-gate evidence.'),
    { label: 'Backup storage listing', ok: backupListError ? false : storage ? storage.ok === true : null, detail: backupListError || (storage ? storage.ok ? 'The server listed backup storage.' : 'The server could not list backup storage.' : 'Run Health Dashboard to check backup storage.') },
    { label: 'API routes responding', ok: checks.length ? checks.every(check => check.ok === true) : null, detail: checks.length ? `${checks.filter(check => check.ok === true).length}/${checks.length} health routes OK` : 'Run Health Dashboard to test routes.' },
    unknown('Push delivery configuration', `${pushDevices} saved device token(s). Saved tokens do not prove notification delivery; use Push Control Center test evidence.`),
    { label: 'Backup integrity', ok: !integrity || ['unknown', 'not checked'].includes(integrity) ? null : integrity === 'verified' && backupIsStale === false, detail: integrity ? `${integrity}${backupIsStale ? ' • backup is stale or unavailable' : ''}` : 'Backup integrity has not been verified.' },
    unknown('Domain authorization', `${host || 'Unknown host'}. Runtime hostname alone does not verify Firebase domain authorization.`),
    unknown('API key referrer restrictions', 'Verify configured referrer restrictions in the existing security configuration; this dashboard cannot inspect them.'),
    { label: 'Running app version', ok: Boolean(version), detail: version || 'Version unavailable' },
    unknown('Source ZIP and release certification', 'Use the source hash and complete release-gate artifact for this version. Runtime checks do not inspect the source ZIP or certify a release.'),
  ];
}
