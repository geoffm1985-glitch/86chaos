const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function cleanText(value = '', max = 5000) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function htmlEscape(value = '') {
  return cleanText(value, 12000).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function providerConfigured() {
  return Boolean(process.env.BUG_REPORT_EMAIL_API_KEY && process.env.BUG_REPORT_EMAIL_FROM && process.env.BUG_REPORT_EMAIL_TO);
}

function buildCrashEmail({ report = {}, reporter = {}, reportId = '' } = {}) {
  const title = `86 Chaos crash report ${reportId || ''}`.trim();
  const lines = [
    ['Severity', report.severity || (report.category === 'Crash / Error' ? 'high' : 'standard')],
    ['Report ID', reportId || report.reportId || ''],
    ['Restaurant', `${report.restaurantName || 'Unknown'} (${report.restaurantId || 'Unknown'})`],
    ['User', `${report.user || reporter.name || 'Unknown'} ${report.userId || reporter.id ? `(${report.userId || reporter.id})` : ''}`],
    ['App Version', report.appVersion || report.clientVersion || ''],
    ['Deployment', report.deploymentId || report.vercelDeploymentId || ''],
    ['Error', `${report.errorName || ''}: ${report.rawMessage || report.message || ''}`.trim()],
    ['Chunk URL', report.chunkUrl || report.failedChunkUrl || ''],
    ['Route/Tab', report.route || report.activeTab || ''],
    ['Timestamp', report.time || report.createdAt || new Date().toISOString()],
    ['Browser', report.userAgent || ''],
    ['Viewport', report.screenSize || report.viewport || '']
  ];
  const text = `${title}\n\n${lines.map(([k, v]) => `${k}: ${cleanText(v, 800)}`).join('\n')}\n\nOpen System Administrator → Support / Bug Ledger to review the saved report.`;
  const html = `<h2>${htmlEscape(title)}</h2><table>${lines.map(([k, v]) => `<tr><th align="left" style="padding:4px 10px 4px 0;vertical-align:top;">${htmlEscape(k)}</th><td style="padding:4px 0;">${htmlEscape(v)}</td></tr>`).join('')}</table><p>Open <strong>System Administrator → Support / Bug Ledger</strong> to review the saved report.</p>`;
  return { subject: title, text, html };
}

async function sendBugReportEmail({ report = {}, reporter = {}, reportId = '' } = {}) {
  const attemptedAt = new Date().toISOString();
  if (!providerConfigured()) {
    return {
      attempted: false,
      providerAccepted: false,
      provider: 'resend',
      failureCategory: 'not_configured',
      failureMessage: 'BUG_REPORT_EMAIL_API_KEY, BUG_REPORT_EMAIL_FROM, or BUG_REPORT_EMAIL_TO is not configured.',
      attemptedAt
    };
  }
  if (typeof fetch !== 'function') {
    return {
      attempted: true,
      providerAccepted: false,
      provider: 'resend',
      failureCategory: 'runtime_missing_fetch',
      failureMessage: 'This server runtime does not expose fetch.',
      attemptedAt
    };
  }
  const email = buildCrashEmail({ report, reporter, reportId });
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.BUG_REPORT_EMAIL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.BUG_REPORT_EMAIL_FROM,
        to: String(process.env.BUG_REPORT_EMAIL_TO).split(',').map(v => v.trim()).filter(Boolean),
        subject: email.subject,
        text: email.text,
        html: email.html
      })
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) {}
    if (!response.ok) {
      return {
        attempted: true,
        providerAccepted: false,
        provider: 'resend',
        failureCategory: `provider_${response.status}`,
        failureMessage: cleanText(data?.message || data?.error || text || response.statusText, 500),
        attemptedAt
      };
    }
    return {
      attempted: true,
      providerAccepted: true,
      provider: 'resend',
      providerMessageId: cleanText(data?.id || data?.messageId || '', 200),
      attemptedAt
    };
  } catch (error) {
    return {
      attempted: true,
      providerAccepted: false,
      provider: 'resend',
      failureCategory: 'provider_request_failed',
      failureMessage: cleanText(error?.message || error, 500),
      attemptedAt
    };
  }
}

module.exports = { sendBugReportEmail, buildCrashEmail, providerConfigured };
