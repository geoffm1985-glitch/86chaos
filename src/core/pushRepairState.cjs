'use strict';

function cleanNonce(value = '') {
  return String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 140);
}

function consumePushRepairUrl(inputUrl) {
  const url = new URL(String(inputUrl || 'https://app.86chaos.com/'));
  const params = url.searchParams;
  const hadRepairParam = params.has('pushRepair') || params.has('pushRepairNonce') || params.has('repairNonce');
  if (!hadRepairParam) {
    return {
      hadRepairParam: false,
      state: { requested: false, consumed: false, nonce: '' },
      cleanedUrl: `${url.pathname}${url.search}${url.hash}`
    };
  }
  const rawNonce = String(params.get('pushRepairNonce') || params.get('repairNonce') || params.get('pushRepair') || '').trim();
  const nonce = rawNonce && rawNonce !== '1' ? cleanNonce(rawNonce) : '';
  ['pushRepair', 'pushRepairNonce', 'repairNonce'].forEach(key => params.delete(key));
  const cleanSearch = params.toString();
  return {
    hadRepairParam: true,
    state: {
      requested: true,
      consumed: true,
      nonce,
      capturedNonce: nonce
    },
    cleanedUrl: `${url.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${url.hash || ''}`
  };
}

function terminalPushRepairLinkState(previous = {}, reason = 'terminal') {
  return {
    ...(previous || {}),
    requested: false,
    consumed: true,
    terminalReason: reason
  };
}

function stablePushRepairDismissalIdentity({ authUid = '', workspaceId = '', deviceId = '', nonce = '' } = {}) {
  return [
    String(authUid || 'user').trim(),
    String(workspaceId || 'workspace').trim(),
    String(deviceId || 'device').trim(),
    String(nonce || 'legacy-active').trim()
  ].join(':');
}

function shouldAutoAttemptRepair({ dismissed = false, attempted = false, requested = false, activeFlags = false, nonce = '' } = {}) {
  if (dismissed || attempted) return false;
  return Boolean(requested || activeFlags || nonce);
}

module.exports = {
  cleanNonce,
  consumePushRepairUrl,
  shouldAutoAttemptRepair,
  stablePushRepairDismissalIdentity,
  terminalPushRepairLinkState
};
