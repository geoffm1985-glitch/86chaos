'use strict';

const RESERVED_BRIDGE_ROOTS = Object.freeze([
  'posBridgeInstallations',
  'posBridgeScopes',
  'posBridgeAuthReplays',
  'posBridgeControl'
]);
const RESERVED_SET = new Set(RESERVED_BRIDGE_ROOTS);
const ORDINARY_BACKUP_EXCLUSIONS = Object.freeze([...RESERVED_BRIDGE_ROOTS]);

function rootOfPath(value = '') {
  return String(value || '').trim().replace(/^\/+/, '').split('/')[0];
}
function isReservedBridgeRoot(value = '') { return RESERVED_SET.has(rootOfPath(value)); }
function assertNotReservedBridgeRoot(value = '') {
  if (isReservedBridgeRoot(value)) {
    const error = new Error('This server-managed collection cannot be changed through a generic write or ordinary restore.');
    error.code = 'reserved_server_collection'; error.statusCode = 403; throw error;
  }
}
function shouldExcludeFromOrdinaryBackup(value = '') { return isReservedBridgeRoot(value); }

module.exports = {
  RESERVED_BRIDGE_ROOTS,
  ORDINARY_BACKUP_EXCLUSIONS,
  rootOfPath,
  isReservedBridgeRoot,
  assertNotReservedBridgeRoot,
  shouldExcludeFromOrdinaryBackup
};
