'use strict';

const DEFAULT_API_BASE = 'https://conecto-api.shift4payments.com';
const DEFAULT_AUTH_BASE = 'https://lighthouse-api.harbortouch.com';
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const MAX_RETRY_WAIT_MS = 5000;

class Shift4Error extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'Shift4Error';
    this.code = code;
    this.status = Number(options.status || 0) || 0;
    this.retryAfterMs = Number(options.retryAfterMs || 0) || 0;
    this.partial = options.partial === true;
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const canonicalJson = value => {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  return value;
};
const rowFingerprint = value => require('crypto').createHash('sha256').update(JSON.stringify(canonicalJson(value))).digest('hex');
const pick = (source, fields) => Object.fromEntries(fields.filter(field => Object.prototype.hasOwnProperty.call(source || {}, field)).map(field => [field, source[field]]));
function operationalTicketShape(row = {}) {
  const ticket = pick(row, ['posRef','type','orderNumber','totalItems','totalSurcharges','totalTax','totalGrand','totalTips','totalDiscounts','totalGratuities','openedAt','openedByEmployee','openedByEmployeeRef','closedAt','closedByEmployee','closedByEmployeeRef','locationId','orderTypeRef']);
  ticket.ticketItems = (Array.isArray(row.ticketItems) ? row.ticketItems : []).map(item => pick(item, ['posRef','type','name','itemRef','revenueClassRef','isNonSalesRevenue','departmentName','departmentRef','quantity','unitPrice','itemAmount','modifierAmount','discountAmount','price','tax','addedAt']));
  return ticket;
}
const safeJson = async response => {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch (_) { throw new Shift4Error('malformed_response', 'Shift4 returned a response that 86 Chaos could not safely read.', { status: response.status }); }
};
const retryAfterMs = (value, nowMs = Date.now()) => {
  const clean = String(value || '').trim();
  if (!clean) return 0;
  if (/^\d+(\.\d+)?$/.test(clean)) return Math.max(0, Math.ceil(Number(clean) * 1000));
  const dateMs = Date.parse(clean);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - nowMs) : 0;
};
const sanitizedCode = status => status === 401 ? 'authorization_expired' : status === 403 ? 'permission_insufficient' : status === 429 ? 'rate_limited' : status >= 500 ? 'shift4_unavailable' : 'shift4_request_failed';

function officialUrl(value, fallback, label) {
  const url = new URL(String(value || fallback));
  if (url.protocol !== 'https:') throw new Shift4Error('configuration_incomplete', `${label} must use HTTPS.`);
  return url.toString().replace(/\/$/, '');
}

class Shift4Client {
  constructor(options = {}) {
    this.fetch = options.fetchImpl || global.fetch;
    if (typeof this.fetch !== 'function') throw new Shift4Error('configuration_incomplete', 'Server fetch support is unavailable.');
    this.apiBase = officialUrl(options.apiBase || process.env.SHIFT4_API_BASE_URL, DEFAULT_API_BASE, 'Shift4 API base URL');
    this.authBase = officialUrl(options.authBase || process.env.SHIFT4_OAUTH_BASE_URL, DEFAULT_AUTH_BASE, 'Shift4 OAuth base URL');
    this.timeoutMs = Math.min(20000, Math.max(1000, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS)));
    this.maxRetries = Math.min(MAX_RETRIES, Math.max(0, Number(options.maxRetries ?? MAX_RETRIES)));
    this.wait = options.waitImpl || wait;
  }

  authorizationUrl({ clientId, redirectUri, state }) {
    const url = new URL('/oauth2/authorize/', `${this.authBase}/`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async rawRequest({ base = this.apiBase, path, method = 'GET', token = '', body, retrySafe = false, timeoutMs = this.timeoutMs }) {
    const url = new URL(path, `${base}/`).toString();
    const attempts = retrySafe ? this.maxRetries + 1 : 1;
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        const headers = { Accept: 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        response = await this.fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      } catch (error) {
        const timedOut = error?.name === 'AbortError';
        lastError = error instanceof Shift4Error ? error : new Shift4Error(timedOut ? 'timeout' : 'network_error', timedOut ? 'Shift4 did not respond before the safe timeout.' : 'Shift4 could not be reached.', { status: 503 });
        if (!retrySafe || attempt + 1 >= attempts || error instanceof Shift4Error) throw lastError;
        await this.wait(Math.min(250 * (2 ** attempt), MAX_RETRY_WAIT_MS));
      } finally {
        clearTimeout(timer);
      }
      if (response.ok) return { data: await safeJson(response), status: response.status, headers: response.headers };
      const after = retryAfterMs(response.headers?.get?.('retry-after'));
      const code = sanitizedCode(response.status);
      lastError = new Shift4Error(code, code === 'rate_limited' ? 'Shift4 rate limited this request. Try again after the reported wait.' : code === 'authorization_expired' ? 'Shift4 authorization has expired.' : code === 'permission_insufficient' ? 'Shift4 did not grant the required read permission.' : code === 'shift4_unavailable' ? 'Shift4 is temporarily unavailable.' : 'Shift4 rejected the request.', { status: response.status, retryAfterMs: after });
      const transient = response.status === 429 || response.status >= 500;
      const boundedWait = after === 0 || after <= MAX_RETRY_WAIT_MS;
      if (!(retrySafe && attempt + 1 < attempts && transient && boundedWait)) throw lastError;
      await this.wait(after || Math.min(250 * (2 ** attempt), MAX_RETRY_WAIT_MS));
    }
    throw lastError || new Shift4Error('shift4_unavailable', 'Shift4 is temporarily unavailable.');
  }

  async exchangeAuthorizationCode({ code, redirectUri, clientId, clientSecret }) {
    const response = await this.rawRequest({ base: this.authBase, path: '/oauth2/token/', method: 'POST', body: { grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret } });
    return response.data;
  }

  async refreshToken({ refreshToken, clientId, clientSecret }) {
    const response = await this.rawRequest({ base: this.authBase, path: '/oauth2/token/', method: 'POST', body: { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret } });
    return response.data;
  }

  async getLocations(accessToken) {
    const response = await this.rawRequest({ path: '/marketplace/v2/lighthouse-token/locations', token: accessToken, retrySafe: true });
    if (!Array.isArray(response.data?.results)) throw new Shift4Error('malformed_response', 'Shift4 returned malformed location data.');
    return response.data;
  }

  async getInstalledLocations(accessToken) {
    const response = await this.rawRequest({ path: '/marketplace/v2/locations', token: accessToken, retrySafe: true });
    if (!Array.isArray(response.data?.results)) throw new Shift4Error('malformed_response', 'Shift4 returned malformed installed-location data.');
    return response.data;
  }

  async installLocation(accessToken, locationId) {
    await this.rawRequest({ path: '/marketplace/v2/lighthouse-token/installations', method: 'POST', token: accessToken, body: { locationId: Number(locationId) }, retrySafe: false });
  }

  async getMenu(accessToken, locationId) {
    const response = await this.rawRequest({ path: `/pos/v2/${encodeURIComponent(locationId)}/menu`, token: accessToken, retrySafe: true });
    if (!Array.isArray(response.data?.items) || !Array.isArray(response.data?.categories)) throw new Shift4Error('malformed_response', 'Shift4 returned malformed menu data.');
    return response.data;
  }

  async getTicketsPage(accessToken, locationId, { from, to }) {
    const query = new URLSearchParams({ 'filter[dateTimeFrom]': from, 'filter[dateTimeTo]': to });
    const response = await this.rawRequest({ path: `/pos/v2/${encodeURIComponent(locationId)}/tickets?${query}`, token: accessToken, retrySafe: true });
    if (!Array.isArray(response.data?.results)) throw new Shift4Error('malformed_response', 'Shift4 returned malformed ticket data.');
    return response.data;
  }

  async getAllTickets(accessToken, locationId, range, options = {}) {
    void options;
    const page = await this.getTicketsPage(accessToken, locationId, range);
    const analyzed = analyzeTicketRows(page.results, locationId);
    const reported = page.meta?.count;
    const reportedCount = typeof reported === 'number' && Number.isSafeInteger(reported) && reported >= 0 ? reported : null;
    return {
      tickets: analyzed.tickets, pagesFetched: 1, rawSourceRowsReceived: page.results.length,
      uniqueTicketsRetained: analyzed.tickets.length, duplicateTicketRows: analyzed.duplicates,
      conflictingTicketRows: analyzed.conflicts.length, missingReferenceRows: analyzed.missingReferences,
      retrievalComplete: false, partial: true, partialReason: 'api_contract_unverified',
      reportedCount, contradictoryCount: reportedCount != null && reportedCount < page.results.length,
      completionEvidence: 'The published ticket Retrieve contract does not document endpoint-specific pagination or a reliable completion signal.'
    };
  }
}

function analyzeTicketRows(rows = [], locationId = '') {
  const byRef = new Map(); const conflicts = []; let duplicates = 0; let missingReferences = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const ref = typeof row?.posRef === 'string' ? row.posRef.trim() : '';
    if (!ref) { missingReferences += 1; continue; }
    const key = JSON.stringify([String(locationId), ref]); const fingerprint = rowFingerprint(operationalTicketShape(row)); const existing = byRef.get(key);
    if (!existing) byRef.set(key, { row, fingerprint });
    else if (existing.fingerprint === fingerprint) duplicates += 1;
    else { conflicts.push({ locationId: String(locationId), posRef: ref, reason: 'conflicting_duplicate_ticket' }); byRef.set(key, { conflict: true }); }
  }
  return { tickets: [...byRef.values()].filter(value => !value.conflict).map(value => value.row), duplicates, conflicts, missingReferences };
}

module.exports = { Shift4Client, Shift4Error, retryAfterMs, analyzeTicketRows, operationalTicketShape, DEFAULT_API_BASE, DEFAULT_AUTH_BASE, MAX_RETRIES, MAX_RETRY_WAIT_MS };
