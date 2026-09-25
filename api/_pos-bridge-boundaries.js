'use strict';

const RESERVED_BRIDGE_ROOTS = Object.freeze([
  'posBridgeInstallations',
  'posBridgeScopes',
  'posBridgeAuthReplays',
  'posBridgeControl'
]);
const RESERVED_PUBLICATION_ROOTS = Object.freeze([
  'schedulePublishOperations',
  'schedulePublishLeases',
  'inventoryMutationOperations'
]);
const RESERVED_SET = new Set(RESERVED_BRIDGE_ROOTS);
const SERVER_RESERVED_SET = new Set([...RESERVED_BRIDGE_ROOTS, ...RESERVED_PUBLICATION_ROOTS]);
const ORDINARY_BACKUP_EXCLUSIONS = Object.freeze([...RESERVED_BRIDGE_ROOTS, ...RESERVED_PUBLICATION_ROOTS]);

function rootOfPath(value = '') {
  return String(value || '').trim().replace(/^\/+/, '').split('/')[0];
}
function isReservedBridgeRoot(value = '') { return RESERVED_SET.has(rootOfPath(value)); }
function isReservedServerRoot(value = '') { return SERVER_RESERVED_SET.has(rootOfPath(value)); }
function assertNotReservedBridgeRoot(value = '') {
  if (isReservedServerRoot(value)) {
    const error = new Error('This server-managed collection cannot be changed through a generic write or ordinary restore.');
    error.code = 'reserved_server_collection'; error.statusCode = 403; throw error;
  }
}
function shouldExcludeFromOrdinaryBackup(value = '') { return isReservedServerRoot(value); }

module.exports = {
  RESERVED_BRIDGE_ROOTS,
  RESERVED_PUBLICATION_ROOTS,
  ORDINARY_BACKUP_EXCLUSIONS,
  rootOfPath,
  isReservedBridgeRoot,
  isReservedServerRoot,
  assertNotReservedBridgeRoot,
  shouldExcludeFromOrdinaryBackup
};
