'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('HR & Training roster demand uses the real hr-training route', () => {
  const app = read('src/App.js');
  assert.match(app, /'hr'\s*:\s*'hr-training'/, 'legacy ?tab=hr should normalize to hr-training');
  assert.match(app, /\['team', 'labor', 'financials', 'messages', 'hr-training', 'prep'\]\.includes\(activeTabState\)/, 'roster listener should load on hr-training');
  assert.doesNotMatch(app, /\['team', 'labor', 'financials', 'messages', 'hr', 'prep'\]\.includes\(activeTabState\)/, 'obsolete hr route must not drive active roster loading');
  assert.match(app, /activeTabState === 'hr-training'/, 'renderer should use hr-training');
});

test('current browser route fixtures use ops and hr-training, not stale kitchen/hr routes', () => {
  const e2e = read('tests/e2e/authenticated-release.spec.cjs');
  const cross = read('tests/86chaos-full-audit/12-cross-module-full-restaurant-day.spec.cjs');
  const helpers = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
  assert.doesNotMatch(e2e, /tabs:\s*\[[^\]]*'hr'[^\]]*\]/s);
  assert.doesNotMatch(e2e, /tabs:\s*\[[^\]]*'kitchen'[^\]]*\]/s);
  assert.doesNotMatch(cross, /\['today', 'kitchen'/);
  assert.match(cross, /\['today', 'ops', 'schedule'/);
  assert.match(helpers, /tab: 'hr-training'/);
  assert.match(helpers, /tab: 'ops'/);
});

test('Back Office Document Vault stores real file metadata and Storage object actions', () => {
  const management = read('src/features/management.jsx');
  assert.match(management, /deleteObject/);
  assert.match(management, /uploadBytes\(ref\(storage, details\.storagePath\), file/);
  assert.match(management, /getBlob\(ref\(storage, record\.storagePath\)\)/, 'Document Vault must use authenticated SDK blob reads instead of persistent download URLs');
  assert.doesNotMatch(management, /getDownloadURL\(ref\(storage, record\.storagePath\)\)/, 'Document Vault must not persist or expose long-lived tokenized download URLs');
  assert.match(management, /back-office\/document-vault/);
  assert.match(management, /originalFileName/);
  assert.match(management, /sanitizedFileName/);
  assert.match(management, /fileMimeType/);
  assert.match(management, /fileSize/);
  assert.match(management, /uploadedBy/);
  assert.match(management, /No uploaded file attached/);
  assert.match(management, /DOCUMENT_VAULT_BLOCKED_EXT/);
  assert.match(management, /Document is too large/);
});

test('auth bootstrap keeps a single id field and preserves uid/profileDocId', () => {
  const auth = read('src/features/auth.jsx');
  const match = auth.match(/userData\s*=\s*\{([\s\S]*?)\n\s*\};/);
  assert.ok(match, 'bootstrap userData object should be present');
  const objectText = match[1];
  assert.equal((objectText.match(/\bid:\s*firebaseUser\.uid/g) || []).length, 1);
  assert.match(objectText, /uid:\s*firebaseUser\.uid/);
  assert.match(objectText, /profileDocId:/);
});


test('Document Vault Storage rules contain the exact workspace-scoped path and strict metadata allowlist', () => {
  const rules = read('storage.rules');
  assert.match(rules, /match \/restaurants\/\{restaurantId\}\/back-office\/document-vault\/\{recordId\}\/\{fileName\}/);
  assert.match(rules, /purpose == 'document-vault'/);
  assert.match(rules, /metadata\.restaurantId == restaurantId/);
  assert.match(rules, /metadata\.recordId == recordId/);
  assert.match(rules, /metadata\.uploadedBy == request\.auth\.uid/);
  assert.match(rules, /source == '86chaos-document-vault'/);
  assert.match(rules, /request\.resource\.size > 0/);
  assert.match(rules, /request\.resource\.size <= 12 \* 1024 \* 1024/);
  assert.match(rules, /application\/pdf/);
  assert.match(rules, /image\/webp/);
  assert.match(rules, /wordprocessingml\.document/);
  assert.match(rules, /spreadsheetml\.sheet/);
  assert.match(rules, /text\/csv/);
  assert.match(rules, /allowedVaultContentType\(fileName\)/);
  assert.doesNotMatch(rules, /blockedVaultFileName/, 'Document Vault uses a compact MIME-plus-extension allowlist instead of the old oversized blocked-extension chain');
  const vaultBlock = rules.match(/match \/restaurants\/\{restaurantId\}\/back-office\/document-vault\/\{recordId\}\/\{fileName\} \{([\s\S]*?)\n    \}/);
  assert.ok(vaultBlock, 'Document Vault Storage rule block should be present');
  assert.doesNotMatch(vaultBlock[1], /allow read:\s*if signedIn\(\)\s*;/, 'Document Vault read must not devolve to any signed-in user');
  assert.doesNotMatch(vaultBlock[1], /allow create, update:\s*if signedIn\(\)\s*;/, 'Document Vault writes must not devolve to any signed-in user');
});

test('Document Vault lifecycle compensates failed metadata writes and validates stored paths', () => {
  const management = read('src/features/management.jsx');
  assert.match(management, /uploaded_object_removed_after_metadata_failure/);
  assert.match(management, /uploaded_object_orphaned_after_metadata_failure/);
  assert.match(management, /oldFileCleanupStatus/);
  assert.match(management, /isValidVaultStoragePath/);
  assert.match(management, /startsWith\(`\$\{DOCUMENT_VAULT_STORAGE_PREFIX\(rid\)\}\$\{recordId\}\//);
  assert.match(management, /deleteVaultObjectSafely\(details\.storagePath\)/);
  assert.match(management, /deleteVaultObjectSafely\(oldPath\)/);
});
