const fs = require('fs');

const mustContain = (file, text, label) => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(text)) {
    throw new Error(`${label} missing from ${file}`);
  }
  console.log(`✓ ${label}`);
};

mustContain('src/core/appCore.js', "CURRENT_VERSION = '15.0.94'", 'current version 15.0.94');
mustContain('public/version.json', '15.0.94', 'public version 15.0.94');
mustContain('src/config/plans.js', 'BACK_OFFICE_SUITE', 'Back Office Suite feature gate retained');
mustContain('src/config/plans.js', 'QUICKBOOKS_INTEGRATION', 'QuickBooks Owner Pro feature gate retained');
mustContain('src/features/management.jsx', 'QuickBooks Phase 3', 'QuickBooks Phase 3 UI');
mustContain('src/features/management.jsx', 'Monthly Accountant Packet', 'monthly accountant packet UI');
mustContain('src/features/management.jsx', 'Owner Multi-Location Rollup', 'owner multi-location rollup UI');
mustContain('src/features/management.jsx', 'Account / Class / Location Mapping', 'class/location mapping UI');
mustContain('src/features/management.jsx', 'Check Sync Health', 'QuickBooks sync health action');
mustContain('src/features/management.jsx', '/api/quickbooks-sync-health', 'QuickBooks sync health API call');
mustContain('src/features/management.jsx', '/api/quickbooks-accountant-export', 'QuickBooks accountant export preflight API call');
mustContain('api/quickbooks-sync-health.js', 'liveWritesEnabled', 'server-side sync health guard report');
mustContain('api/quickbooks-accountant-export.js', 'does not email, post to QuickBooks, or change accounting records', 'accountant export safety guard');
mustContain('api/quickbooks-bill-draft.js', 'className', 'QuickBooks class mapping carried into bill draft');
mustContain('api/quickbooks-bill-draft.js', 'locationName', 'QuickBooks location mapping carried into bill draft');
mustContain('firestore.rules', 'quickbooks_accountant_packet', 'Back Office rules allow accountant packets');
mustContain('firestore.rules', 'quickbooks_sync_health', 'Back Office rules allow sync health records');
mustContain('firestore.rules', 'quickbooks_owner_rollup', 'Back Office rules allow owner rollup records');
mustContain('api/python-automation-run.js', 'systemAdminCanApply: false', 'Python/System Admin mutation guard retained');

console.log('15.0.94 validation passed.');
