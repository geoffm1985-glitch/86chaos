'use strict';

// Independent QA reads may recover a reset connection. UI mutations remain
// explicit, and HTTP failures are returned unchanged for the caller to assert.
async function postScheduleQa(request, url, options) {
  const readOnly = url === '/api/schedule-workspace' && ['read', 'read-week'].includes(options?.data?.action);
  try {
    return await request.post(url, { ...options, maxRetries: readOnly ? 2 : 0 });
  } catch (error) {
    // Playwright transport errors include authenticated request headers. Never
    // propagate the original message, stack or cause into reports or consoles.
    const message = String(error?.message || '');
    const code = message.match(/\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)\b/)?.[0] || (/socket hang up/i.test(message) ? 'ECONNRESET' : 'transport_error');
    throw new Error(`Scheduling QA ${readOnly ? 'read' : 'mutation'} transport failed (${code}); ${readOnly ? 'bounded read recovery exhausted' : 'request was not automatically retried'}.`);
  }
}

module.exports = { postScheduleQa };
