'use strict';
function isApprovedDependency(row = {}) {
  if (row.approved === false || row.active === false || row.deleted === true) return false;
  const statuses = [row.status, row.reviewStatus, row.approvalStatus, row.sourceStatus].filter(value => value != null && String(value).trim());
  if (statuses.some(value => !['approved', 'active', 'reviewed', 'published'].includes(String(value).trim().toLowerCase()))) return false;
  if (row.requiresApproval === true && !statuses.some(value => String(value).toLowerCase() === 'approved')) return false;
  // Existing manually saved dependencies predate status fields. Keep their compatibility.
  return true;
}
function menuScanReviewReason(scan = {}, now = Date.now()) {
  if (!(Number(scan.dependencyCount) > 0)) return 'No approved ingredient links. Open this scan to review its matches.';
  const reviewedAt = Date.parse(scan.updatedAt || scan.approvedAt || scan.createdAt || '');
  if (!Number.isFinite(reviewedAt)) return 'The last review date is missing. Confirm the menu and portions are current.';
  if (now - reviewedAt > 90 * 86400000) return 'This menu has not been reviewed in over 90 days. Check prices, portions, and ingredient links.';
  return '';
}
const menuApprovalShared = { isApprovedDependency, menuScanReviewReason };

// One implementation for the browser and Node, using the existing shared-helper pattern.
(function publishMenuApproval(root) {
  if (!root) return;
  Object.defineProperty(root, '__86ChaosMenuApprovalShared', {
    value: menuApprovalShared,
    configurable: true,
    writable: true,
  });
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
