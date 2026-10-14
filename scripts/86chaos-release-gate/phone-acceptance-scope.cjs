'use strict';
function resolvePhoneAcceptanceScope({ requested = false, target = '', projectId = '', appUrl = '' } = {}) {
  if (!requested) return { connectedPhoneExcluded: false, excludedArtifactGroups: [], failures: [] };
  let local = false;
  try { const url = new URL(appUrl); local = url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname); } catch (_) {}
  if (target !== 'emulator' || projectId !== 'demo-86chaos' || !local) return { connectedPhoneExcluded: false, excludedArtifactGroups: [], failures: ['Connected-phone exclusion is permitted only for the explicitly requested local demo validation.'] };
  return { connectedPhoneExcluded: true, excludedArtifactGroups: ['real-device','native-mobile-foundation'], failures: [], label: 'Full local validation; connected-phone acceptance excluded by user request. Physical-device release certification is not granted.' };
}
module.exports = { resolvePhoneAcceptanceScope };
