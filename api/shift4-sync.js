'use strict';
const crypto = require('crypto');
const { authorizeShift4 } = require('./_shift4-authority');
const { Shift4Client } = require('./_shift4-client');
const { freshCredential, publicError, localDateRangeToUtc, TICKET_RETRIEVAL_CONTRACT } = require('./_shift4-service');
const { normalizeShift4Tickets, projectRecord } = require('./_shift4-normalization');
const { persistRecords, writeRun, updateCredentialMetadata } = require('./_shift4-storage');
const { json, restaurantIdFrom, statusFor } = require('./_shift4-route');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only' });
  const runId = crypto.randomUUID(); let ctx; let restaurantId = ''; let runStarted = false; let runFinalized = false;
  try {
    restaurantId = restaurantIdFrom(req); ctx = await authorizeShift4(req, restaurantId);
    const client = new Shift4Client(); const { stored, tokenBundle } = await freshCredential(ctx.db, restaurantId, { client });
    const location = stored.data.selectedLocation;
    if (!location || location.supportStatus !== 'supported' || location.isAvailable === false || location.timeZoneStatus === 'invalid') throw Object.assign(new Error('A verified Shift4 Dine location with a valid timezone is required.'), { code: location?.timeZoneStatus === 'invalid' ? 'invalid_location_timezone' : 'unverified_pos', statusCode: 403 });
    const range = localDateRangeToUtc(String(req.body?.from || ''), String(req.body?.to || ''), location.timeZone);
    const observedAtMs = Date.now(); const attemptedAt = new Date(observedAtMs).toISOString();
    await writeRun(ctx.db, restaurantId, runId, { providerLocationId: location.id, requestedFrom: range.requestedFrom, requestedTo: range.requestedTo, attemptedAt, status: 'running' }); runStarted = true;
    const [ticketOutcome, menuOutcome] = await Promise.allSettled([
      client.getAllTickets(tokenBundle.accessToken, location.id, { from: range.from, to: range.to }),
      client.getMenu(tokenBundle.accessToken, location.id)
    ]);
    if (ticketOutcome.status === 'rejected') throw ticketOutcome.reason;
    const ticketResult = ticketOutcome.value; const menu = menuOutcome.status === 'fulfilled' ? menuOutcome.value : {};
    const normalized = normalizeShift4Tickets({ restaurantId, providerLocationId: location.id, tickets: ticketResult.tickets, menu, importRunId: runId, timeZone: location.timeZone });
    const storedRecords = normalized.records.map(record => ({ ...record, sourceCompleteness: 'api_contract_unverified', sourceRetrievalRunId: runId }));
    const persistence = await persistRecords(ctx.db, restaurantId, location.id, storedRecords, { observedAtMs });
    const normalizationRejected = normalized.rejected.length;
    const retrievalComplete = ticketResult.retrievalComplete === true;
    const importComplete = retrievalComplete && !ticketResult.contradictoryCount && ticketResult.conflictingTicketRows === 0 && ticketResult.missingReferenceRows === 0 && normalizationRejected === 0 && menuOutcome.status === 'fulfilled' && persistence.persistenceComplete && persistence.conflicts === 0;
    const status = importComplete ? 'complete' : 'incomplete'; const completedAt = new Date().toISOString();
    const summary = {
      restaurantId, provider: 'shift4', providerProduct: 'shift4-dine', providerLocationId: location.id,
      requestedFrom: range.requestedFrom, requestedTo: range.requestedTo, requestedUtcFrom: range.from, requestedUtcTo: range.to,
      locationTimeZone: location.timeZone, attemptedAt, completedAt, status, partial: !importComplete,
      retrievalCompleteness: retrievalComplete ? 'verified_complete' : 'api_contract_unverified', retrievalContract: TICKET_RETRIEVAL_CONTRACT,
      pagesFetched: ticketResult.pagesFetched, rawSourceRowsReceived: ticketResult.rawSourceRowsReceived,
      uniqueTicketsRetained: ticketResult.uniqueTicketsRetained, duplicateTicketRows: ticketResult.duplicateTicketRows,
      conflictingTicketRows: ticketResult.conflictingTicketRows, missingReferenceRows: ticketResult.missingReferenceRows,
      providerReportedCount: ticketResult.reportedCount, contradictoryProviderCount: ticketResult.contradictoryCount,
      normalizedRecords: normalized.records.length, normalizationRejected, rejectionReasons: normalized.rejected.slice(0, 25),
      menuEnrichment: menuOutcome.status === 'fulfilled' ? 'available' : 'unavailable',
      inserted: persistence.inserted, updated: persistence.updated, unchanged: persistence.unchanged, superseded: persistence.superseded,
      persistenceConflicts: persistence.conflicts, persistenceComplete: persistence.persistenceComplete, failedPersistenceBatch: persistence.failedBatch,
      partialReason: !retrievalComplete ? 'api_contract_unverified' : (!persistence.persistenceComplete ? 'persistence_batch_failed' : (normalizationRejected ? 'normalization_rejected' : null)),
      operationCounts: { scopedDocumentReads: persistence.scopedDocumentReads, scopedDocumentWritesCommitted: persistence.scopedDocumentWritesCommitted + 2, scope: 'Shift4 run/normalized-record operations only', comprehensiveFirebaseBillingTotal: false }
    };
    await writeRun(ctx.db, restaurantId, runId, summary); runFinalized = true;
    let credentialMetadataUpdate = 'saved';
    try {
      await updateCredentialMetadata(ctx.db, restaurantId, { latestImportStatus: summary, ...(importComplete ? { lastSuccessfulImportAt: completedAt } : {}) }, { expectedGeneration: stored.data.connectionGeneration });
    } catch (_) { credentialMetadataUpdate = 'failed'; }
    const previewRecords = normalized.records.slice(0, 100).map(projectRecord);
    return json(res, importComplete ? 200 : 206, { ok: true, runId, summary: { ...summary, credentialMetadataUpdate }, preview: { isPreview: true, returned: previewRecords.length, totalNormalized: normalized.records.length, complete: previewRecords.length === normalized.records.length, records: previewRecords }, reviewApi: `/api/shift4-records?restaurantId=${encodeURIComponent(restaurantId)}&from=${range.requestedFrom}&to=${range.requestedTo}` });
  } catch (error) {
    const safe = publicError(error);
    if (ctx?.db && restaurantId && runStarted && !runFinalized) { try { await writeRun(ctx.db, restaurantId, runId, { status: 'failed', partial: true, completedAt: new Date().toISOString(), sanitizedError: safe }); } catch (_) {} }
    return json(res, statusFor(error), { ok: false, runId, ...safe });
  }
};
