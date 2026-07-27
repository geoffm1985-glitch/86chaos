#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const { loadEnv, env, boolEnv } = require('./env-loader.cjs');
const { readFirebaseConfig } = require('./firebase-client.cjs');

loadEnv(process.cwd());

const OUT_DIR = path.join(process.cwd(), 'test-results');
fs.mkdirSync(OUT_DIR, { recursive: true });
const REPORT_PATH = path.join(OUT_DIR, '86chaos-full-audit-cleanup-report.json');
const RUN_ID = process.env.CHAOS_FULL_AUDIT_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');

const COLLECTIONS = [
  'restaurantAdminAlerts', 'eventReminders', 'personalReminders', 'scheduleCoverageTargets',
  'scheduleTemplates', 'availabilityRecords', 'shiftSwaps', 'timePunches', 'timeOffRequests',
  'shifts', 'events', 'financialExpenses', 'sales', 'maintenanceLogs', 'pmSchedules', 'tasks',
  'prepItems', 'menuDependencies', 'recipes', 'inventoryItems', 'vendors', 'users', 'workspaceMembers'
];

function writeReport(report) {
  fs.writeFileSync(REPORT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    runId: RUN_ID,
    cleanupMethod: 'browser-origin-rest',
    ...report,
  }, null, 2));
}

function appUrl(pathOrTab = '') {
  const base = env('APP_URL', 'CHAOS_BASE_URL', 'PLAYWRIGHT_BASE_URL', 'BASE_URL').replace(/\/+$/, '');
  if (!pathOrTab) return base;
  if (/^https?:\/\//i.test(pathOrTab)) return pathOrTab;
  if (String(pathOrTab).startsWith('/')) return `${base}${pathOrTab}`;
  return `${base}/?tab=${encodeURIComponent(pathOrTab)}`;
}

function getCredentials() {
  const email = env('SYSTEM_ADMIN_EMAIL', 'CHAOS_SYSTEM_ADMIN_EMAIL', 'OWNER_EMAIL');
  const password = env('SYSTEM_ADMIN_PASSWORD', 'CHAOS_SYSTEM_ADMIN_PASSWORD', 'OWNER_PASSWORD');
  if (!email || !password) throw new Error('Missing SYSTEM_ADMIN_EMAIL/SYSTEM_ADMIN_PASSWORD for QA cleanup.');
  return { email: String(email).trim(), password };
}

async function pageFetchJson(page, request) {
  return page.evaluate(async ({ url, method, headers, body }) => {
    const response = await fetch(url, {
      method: method || 'GET',
      headers: headers || {},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = { rawText: text }; }
    if (!response.ok) {
      const detail = typeof text === 'string' ? text.slice(0, 1400) : '';
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}: ${detail}`);
    }
    return data;
  }, request);
}

function firestoreRest(config, idToken) {
  const encodedProject = encodeURIComponent(config.projectId);
  const base = `https://firestore.googleapis.com/v1/projects/${encodedProject}/databases/(default)/documents`;
  const headers = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };
  return { base, headers };
}

async function queryQaOwned(page, rest, colName, restaurantId) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: colName }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'qaOwned' }, op: 'EQUAL', value: { booleanValue: true } } },
            { fieldFilter: { field: { fieldPath: 'restaurantId' }, op: 'EQUAL', value: { stringValue: restaurantId } } },
          ],
        },
      },
      limit: 500,
    },
  };
  const rows = await pageFetchJson(page, { url: `${rest.base}:runQuery`, method: 'POST', headers: rest.headers, body });
  return (rows || []).map(r => r.document).filter(Boolean);
}

async function deleteDocName(page, rest, docName) {
  if (!docName) return;
  const url = `https://firestore.googleapis.com/v1/${docName}`;
  await pageFetchJson(page, { url, method: 'DELETE', headers: rest.headers });
}

async function main() {
  const report = { ok: false, deleted: [], warnings: [] };
  let browser;
  try {
    if (!boolEnv('CHAOS_ALLOW_MUTATION')) throw new Error('CHAOS_ALLOW_MUTATION=true required for cleanup.');
    if (!env('APP_URL', 'CHAOS_BASE_URL', 'PLAYWRIGHT_BASE_URL', 'BASE_URL')) throw new Error('APP_URL / CHAOS_BASE_URL required for browser-origin cleanup.');

    const seedPath = path.join(OUT_DIR, '86chaos-full-audit-seed-report.json');
    const seed = fs.existsSync(seedPath) ? JSON.parse(fs.readFileSync(seedPath, 'utf8')) : null;
    const restaurantId = env('CHAOS_QA_RESTAURANT_ID') || seed?.restaurantId || seed?.profile?.restaurantId || '';
    if (!restaurantId) throw new Error('No restaurantId found for cleanup. Seed report missing or did not include restaurantId.');

    const config = readFirebaseConfig();
    const { email, password } = getCredentials();

    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await context.newPage();
    await page.goto(appUrl('today'), { waitUntil: 'domcontentloaded', timeout: 60000 });

    const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`;
    const signed = await pageFetchJson(page, {
      url: signInUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email, password, returnSecureToken: true },
    });
    if (!signed.idToken) throw new Error('Browser-origin Firebase Auth cleanup sign-in did not return idToken.');
    report.signedInAs = email;
    report.restaurantId = restaurantId;
    report.restaurantName = seed?.restaurantName || '86 Chaos Full Audit QA Restaurant';

    const rest = firestoreRest(config, signed.idToken);

    for (const colName of COLLECTIONS) {
      let count = 0;
      try {
        const docs = await queryQaOwned(page, rest, colName, restaurantId);
        for (const doc of docs) {
          await deleteDocName(page, rest, doc.name);
          count += 1;
        }
        report.deleted.push({ collection: colName, count });
      } catch (error) {
        report.deleted.push({ collection: colName, count, error: error.message });
        report.warnings.push(`Cleanup warning in ${colName}: ${error.message}`);
      }
    }

    if (seed?.createdRestaurant) {
      try {
        await deleteDocName(page, rest, `projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/restaurants/${encodeURIComponent(restaurantId)}`);
        report.deleted.push({ collection: 'restaurants', count: 1, id: restaurantId });
      } catch (error) {
        report.deleted.push({ collection: 'restaurants', count: 0, id: restaurantId, error: error.message });
        report.warnings.push(`Cleanup warning in restaurants: ${error.message}`);
      }
    }

    report.ok = true;
  } catch (error) {
    report.ok = false;
    report.error = error.stack || error.message;
    console.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    writeReport(report);
    console.log(`Cleanup report: ${REPORT_PATH}`);
  }
}

main();
