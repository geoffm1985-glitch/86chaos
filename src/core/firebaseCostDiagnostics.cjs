'use strict';

const rows = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.values(value) : [];
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function buildFirebaseCostDiagnostics(diagnostics = {}, options = {}) {
  const listeners = rows(diagnostics.listeners);
  const documents = rows(diagnostics.documents);
  const active = [...listeners, ...documents].filter(row => number(row.subscriberCount) > 0 && !row.releasedAt);
  const abandoned = [...listeners, ...documents].filter(row => number(row.subscriberCount) === 0 && !row.releasedAt && row.releaseReason !== 'no-subscribers-background-grace-expired');
  const duplicateListeners = active.filter(row => number(row.listenerCreationCount) > 1 || new Set(row.consumerLabels || []).size < (row.consumerLabels || []).length);
  const highReadQueries = listeners.filter(row => number(row.documentsReceivedInitial) + number(row.documentsReceivedChanges) > Number(options.readWarningThreshold || 250));
  const repeatedFallbackReads = listeners.filter(row => number(row.fallbackReadCount || row.fallbackCount) > 1 || /fallback|rescue/i.test(String(row.debugLabel || '')) && number(row.reconnectCount) > 1);
  const totalDocumentsObserved = listeners.reduce((sum,row) => sum + number(row.documentsReceivedInitial) + number(row.documentsReceivedChanges),0) + documents.reduce((sum,row) => sum + number(row.documentsReceivedInitial) + number(row.documentsReceivedChanges),0);
  return {
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    firestore:{ activeListeners:number(diagnostics.activeListeners), activeDocuments:number(diagnostics.activeDocuments), listenerReuseCount:number(diagnostics.listenerReuseCount), listenerReleaseCount:number(diagnostics.listenerReleaseCount), documentsObserved:totalDocumentsObserved, writesInitiated:number(diagnostics.writesInitiated), writesCompleted:number(diagnostics.writesCompleted), skippedNoOpWrites:number(diagnostics.skippedNoOpWrites) },
    rtdb:{ reads:number(options.rtdbReads), writes:number(options.rtdbWrites), activePresenceSessions:number(options.activePresenceSessions), heartbeats:number(options.heartbeats), status:options.rtdbKnown === false ? 'unknown' : 'observed' },
    findings:{ duplicateListeners:duplicateListeners.map(row => ({ collection:row.collection || row.coll || 'document', debugLabel:row.debugLabel || '', subscriberCount:number(row.subscriberCount) })), abandonedListeners:abandoned.map(row => ({ collection:row.collection || row.coll || 'document', debugLabel:row.debugLabel || '', releaseReason:row.releaseReason || 'pending cleanup' })), highReadQueries:highReadQueries.map(row => ({ collection:row.collection || '', debugLabel:row.debugLabel || '', documents:number(row.documentsReceivedInitial)+number(row.documentsReceivedChanges) })), repeatedFallbackReads:repeatedFallbackReads.map(row => ({ collection:row.collection || '', debugLabel:row.debugLabel || '', reconnectCount:number(row.reconnectCount) })) },
    bounded:true,
    containsCustomerRecords:false,
    status:duplicateListeners.length || abandoned.length || highReadQueries.length || repeatedFallbackReads.length ? 'attention' : active.length ? 'healthy' : 'unknown'
  };
}

module.exports = { buildFirebaseCostDiagnostics };
