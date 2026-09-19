const fs = require('fs');

const mustContain = (file, text, label) => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(text)) {
    throw new Error(`${label} missing from ${file}`);
  }
  console.log(`✓ ${label}`);
};

mustContain('src/core/appCore.js', "CURRENT_VERSION = '15.0.93'", 'current version 15.0.93');
mustContain('public/version.json', '15.0.93', 'public version 15.0.93');
mustContain('src/config/plans.js', 'BACK_OFFICE_SUITE', 'Back Office Suite feature gate retained');
mustContain('src/config/plans.js', 'QUICKBOOKS_INTEGRATION', 'QuickBooks Owner Pro feature gate retained');
mustContain('src/features/management.jsx', 'QuickBooks Phase 2', 'QuickBooks Phase 2 UI');
mustContain('src/features/management.jsx', 'Invoice Scan → Bill Drafts', 'invoice scan to bill draft UI');
mustContain('src/features/management.jsx', 'Vendor Matching', 'vendor matching UI');
mustContain('src/features/management.jsx', 'Vendor Credit Draft', 'vendor credit draft UI');
mustContain('src/features/management.jsx', 'Sync Repair Queue', 'QuickBooks sync repair queue UI');
mustContain('src/features/management.jsx', '/api/quickbooks-bill-draft', 'QuickBooks bill draft API call');
mustContain('src/features/management.jsx', '/api/quickbooks-webhook-status', 'QuickBooks webhook status API call');
mustContain('api/quickbooks-bill-draft.js', 'QUICKBOOKS_ALLOW_SERVER_WRITES', 'server-side live write guardrail');
mustContain('api/quickbooks-bill-draft.js', 'ownerApprovalRequired', 'owner approval required in bill draft');
mustContain('api/quickbooks-bill-draft.js', 'send_blocked', 'safe send block status');
mustContain('api/quickbooks-webhook.js', 'QuickBooks webhook received', 'QuickBooks webhook receiver scaffold');
mustContain('api/quickbooks-webhook-status.js', 'QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN', 'QuickBooks webhook setup status');
mustContain('firestore.rules', 'quickbooks_bill_draft', 'Back Office rules allow bill drafts');
mustContain('firestore.rules', 'quickbooks_vendor_match', 'Back Office rules allow vendor matches');
mustContain('firestore.rules', 'quickbooks_vendor_credit_draft', 'Back Office rules allow vendor credits');
mustContain('api/python-automation-run.js', 'systemAdminCanApply: false', 'Python/System Admin mutation guard retained');
mustContain('firestore.rules', 'match /backOfficeRecords/{docId}', 'Back Office Firestore rules retained');

console.log('15.0.93 validation passed.');
