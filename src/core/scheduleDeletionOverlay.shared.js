(function(root) {
  'use strict';
  const stamp = value => {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000 + Number(value.nanoseconds || 0) / 1e6;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Date.parse(String(value)); return Number.isFinite(parsed) ? parsed : 0;
  };
  const deletionRecordTime = row => Math.max(0, ...['updatedAt','restoredAt','createdAt','publishedAt','importedAt'].map(field => stamp(row?.[field])));
  const deletionOverlayEvidence = row => ({ sourceShiftId: String(row?.id || row?.docId || ''), sourceRevision: Number.isFinite(Number(row?.revision)) ? Number(row.revision) : 0, sourceRecordTime: deletionRecordTime(row), renderOnly: true });
  function deletionOverlayMatches(row, marker) {
    if (!marker) return false;
    const sameId = String(row?.id || '') === String(marker.sourceShiftId || marker.shiftId || '');
    const revision = Number(row?.revision || 0);
    const sourceRevision = marker.sourceRevision;
    if (sameId && typeof sourceRevision === 'number' && Number.isFinite(sourceRevision)) {
      if (revision > sourceRevision) return false;
      if (revision < sourceRevision) return true;
    } else if (sameId && revision > 0) return false;
    const currentTime = deletionRecordTime(row), sourceTime = Number(marker.sourceRecordTime || 0);
    if (sourceTime && currentTime) return currentTime <= sourceTime;
    return sameId && typeof sourceRevision === 'number' && Number.isFinite(sourceRevision) && revision === sourceRevision;
  }
  function preferDeletionOverlay(previous, incoming) {
    if (!previous) return true;
    const id = incoming.sourceShiftId || incoming.shiftId;
    if (id && id === (previous.sourceShiftId || previous.shiftId)) {
      const a = typeof incoming.sourceRevision === 'number' ? incoming.sourceRevision : -1;
      const b = typeof previous.sourceRevision === 'number' ? previous.sourceRevision : -1;
      if (a !== b) return a > b;
    }
    const a = Number(incoming.sourceRecordTime || 0), b = Number(previous.sourceRecordTime || 0);
    return a !== b ? a > b : Number(incoming.expiresAt || 0) > Number(previous.expiresAt || 0);
  }
  const api = { deletionRecordTime, deletionOverlayEvidence, deletionOverlayMatches, preferDeletionOverlay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.__86ChaosScheduleDeletionOverlayShared = api;
})(globalThis);
