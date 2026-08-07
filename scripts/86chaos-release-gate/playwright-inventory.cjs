'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeJson } = require('./run-context.cjs');
function normalizeRel(value='') { return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^tests\//, ''); }
function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function listSpecFiles(root=process.cwd()) {
  const base = path.join(root, 'tests');
  const out = [];
  const walk = dir => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.spec\.cjs$/.test(entry.name)) out.push(full);
    }
  };
  walk(base);
  return out.sort();
}
function extractTestTitlesFromSpec(source='') {
  const titles = [];
  const re = /(?:^|[\n;{])\s*(?:[A-Za-z_$][\w$]*\.)?test(?:\.(?!describe\b)[A-Za-z]+)?\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let m;
  while ((m = re.exec(source))) titles.push(m[2].replace(/\\`/g, '`').replace(/\\'/g, "'").replace(/\\"/g, '"'));
  return titles;
}
const MAIN_PROJECTS = ['chromium', 'mobile-chromium'];
const PWA_PROJECTS = ['edge-pwa', 'firefox-pwa', 'webkit-pwa', 'mobile-webkit-pwa'];
function projectsForSpec(rel) {
  if (/86chaos-release-gate\/(26-pwa-icon-source-deployed-parity|27-pwa-browser-icon-matrix)\.spec\.cjs$/.test(rel)) return [...MAIN_PROJECTS, ...PWA_PROJECTS];
  return MAIN_PROJECTS;
}
function generatePlaywrightInventory({ root=process.cwd(), outputPath='', runId='', sourceVersion='' }={}) {
  const generatedAt = new Date().toISOString();
  const records = [];
  for (const file of listSpecFiles(root)) {
    const rel = normalizeRel(path.relative(path.join(root, 'tests'), file));
    const source = fs.readFileSync(file, 'utf8');
    const hash = sha256File(file);
    for (const exactTestTitle of extractTestTitlesFromSpec(source)) {
      for (const project of projectsForSpec(rel)) {
        const stableKey = `${rel}\u0000${exactTestTitle}\u0000${project}`;
        records.push({ specPath: rel, exactTestTitle, title: exactTestTitle, fullTitle: exactTestTitle, project, stableKey, sourceFileHash: hash, generatedAt, runId, sourceVersion });
      }
    }
  }
  const report = { ok: true, generatedAt, runId, sourceVersion, count: records.length, records };
  if (outputPath) writeJson(outputPath, report);
  return report;
}
if (require.main === module) {
  const outputPath = process.argv[2] || path.join(process.cwd(), 'playwright-test-inventory.json');
  const report = generatePlaywrightInventory({ outputPath });
  console.log(`Wrote Playwright inventory: ${report.count} identities -> ${outputPath}`);
}
module.exports = { normalizeRel, extractTestTitlesFromSpec, generatePlaywrightInventory, projectsForSpec, MAIN_PROJECTS, PWA_PROJECTS };
