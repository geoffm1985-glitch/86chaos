'use strict';
const { authorizeShift4 } = require('./_shift4-authority');
const { localDateRangeToUtc, publicError } = require('./_shift4-service');
const { recordsToCsv, recordsToJson } = require('./_shift4-normalization');
const { readCredentialMetadata, listAllRecords } = require('./_shift4-storage');
const { json, queryValue, restaurantIdFrom, statusFor } = require('./_shift4-route');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'GET only' });
  try {
    const restaurantId = restaurantIdFrom(req); const ctx = await authorizeShift4(req, restaurantId);
    const metadata = await readCredentialMetadata(ctx.db, restaurantId); const location = metadata?.selectedLocation;
    if (!location?.id || location.supportStatus !== 'supported' || location.isAvailable === false) throw Object.assign(new Error('A verified selected Shift4 Dine location is required.'), { code: 'unverified_pos', statusCode: 409 });
    const from = String(queryValue(req.query?.from) || ''); const to = String(queryValue(req.query?.to) || ''); const format = String(queryValue(req.query?.format) || 'json').toLowerCase();
    localDateRangeToUtc(from, to, location.timeZone);
    if (!['csv','json'].includes(format)) throw Object.assign(new Error('Export format must be csv or json.'), { code: 'invalid_range', statusCode: 400 });
    const result = await listAllRecords(ctx.db, restaurantId, { providerLocationId: String(location.id), from, to });
    if (!result.complete) throw Object.assign(new Error('The export exceeded a bounded storage scan and was not emitted.'), { code: 'export_incomplete', statusCode: 409, reason: result.reason });
    const sourceCompleteness = result.records.some(record => record.sourceCompleteness !== 'verified_complete') ? 'incomplete_or_unverified' : 'verified_complete';
    const filename = `86chaos-shift4-${from}-to-${to}.${format}`; res.statusCode = 200;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); res.setHeader('X-86Chaos-Stored-Range-Completeness', 'complete'); res.setHeader('X-86Chaos-Source-Completeness', sourceCompleteness); res.setHeader('X-86Chaos-Provider-Location', String(location.id));
    if (format === 'csv') { res.setHeader('Content-Type', 'text/csv; charset=utf-8'); return res.end(recordsToCsv(result.records)); }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify(recordsToJson({ restaurantId, providerLocationId: String(location.id), requestedFrom: from, requestedTo: to, completeness: 'complete_stored_range', sourceCompleteness, records: result.records }), null, 2));
  } catch (error) { const safe = publicError(error); return json(res, statusFor(error), { ok: false, ...safe }); }
};
