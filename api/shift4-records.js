'use strict';
const { authorizeShift4 } = require('./_shift4-authority');
const { localDateRangeToUtc, publicError } = require('./_shift4-service');
const { projectRecord } = require('./_shift4-normalization');
const { readCredentialMetadata, listRecordsPage } = require('./_shift4-storage');
const { json, queryValue, restaurantIdFrom, statusFor } = require('./_shift4-route');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'GET only' });
  try {
    const restaurantId = restaurantIdFrom(req); const ctx = await authorizeShift4(req, restaurantId);
    const metadata = await readCredentialMetadata(ctx.db, restaurantId); const location = metadata?.selectedLocation;
    if (!location?.id || location.supportStatus !== 'supported' || location.isAvailable === false) throw Object.assign(new Error('A verified selected Shift4 Dine location is required.'), { code: 'unverified_pos', statusCode: 409 });
    const from = String(queryValue(req.query?.from) || ''); const to = String(queryValue(req.query?.to) || ''); localDateRangeToUtc(from, to, location.timeZone);
    const page = await listRecordsPage(ctx.db, restaurantId, { providerLocationId: location.id, from, to, pageSize: queryValue(req.query?.limit), cursor: queryValue(req.query?.cursor) || '' });
    const sourceCompleteness = page.records.some(record => record.sourceCompleteness !== 'verified_complete') ? 'incomplete_or_unverified' : 'verified_complete';
    return json(res, 200, { ok: true, provider: 'shift4', providerProduct: 'shift4-dine', providerLocationId: String(location.id), from, to, page: { returned: page.returned, pageSize: page.pageSize, hasMore: page.hasMore, nextCursor: page.nextCursor, storedRangeCompleteness: page.completeness, sourceCompleteness, scopedDocumentReads: page.scopedDocumentReads }, records: page.records.map(projectRecord) });
  } catch (error) { const safe = publicError(error); return json(res, statusFor(error), { ok: false, ...safe }); }
};
