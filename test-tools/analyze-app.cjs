#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || path.join(root, 'test-results', '86chaos-ultimate-store-tests', process.env.CHAOS_RELEASE_GATE_RUN_ID || `analysis-${Date.now()}`);
fs.mkdirSync(runDir, { recursive: true });

function walk(relative, predicate = () => true) {
  const base = path.join(root, relative);
  const out = [];
  if (!fs.existsSync(base)) return out;
  const visit = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (predicate(full)) out.push(full);
    }
  };
  visit(base);
  return out;
}
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function unique(values) { return [...new Set(values)].sort(); }
function pngDimensions(file) {
  try {
    const buffer = fs.readFileSync(file);
    if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } catch (_) { return null; }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const sourceFiles = walk('src', file => /\.(?:js|jsx)$/.test(file));
const apiFiles = walk('api', file => file.endsWith('.js'));
const playwrightFiles = walk('tests', file => file.endsWith('.spec.cjs'));
const nodeTestFiles = walk('tests', file => file.endsWith('.test.cjs'));
const clientTestFiles = walk('src', file => /\.test\.(?:js|jsx)$/.test(file));
const serverTestFiles = walk('api', file => file.endsWith('.test.cjs'));

const appText = read(path.join(root, 'src', 'App.js'));
const routes = unique([...appText.matchAll(/activeTabState\s*===\s*['"]([^'"]+)['"]/g)].map(match => match[1]));
const apiHandlers = apiFiles.filter(file => !path.basename(file).startsWith('_')).map(rel);
const collections = new Set();
for (const file of [...sourceFiles, ...apiFiles]) {
  const text = read(file);
  for (const match of text.matchAll(/(?:collection\s*\(|\.collection\s*\()\s*['"]([^'"]+)['"]/g)) collections.add(match[1]);
}
const testTitles = [];
for (const file of [...playwrightFiles, ...nodeTestFiles, ...clientTestFiles, ...serverTestFiles]) {
  const text = read(file);
  for (const match of text.matchAll(/\b(?:test|it)\s*\(\s*(["'`])([\s\S]*?)\1/g)) {
    const title = match[2].replace(/\s+/g, ' ').trim();
    if (title && !title.includes('${')) testTitles.push({ file: rel(file), title });
  }
}
const lineCounts = {};
for (const [name, files] of Object.entries({ source: sourceFiles, api: apiFiles, playwright: playwrightFiles, nodeTests: nodeTestFiles, clientTests: clientTestFiles, serverTests: serverTestFiles })) {
  lineCounts[name] = files.reduce((sum, file) => sum + read(file).split(/\r?\n/).length, 0);
}
const manifestPath = path.join(root, 'public', 'manifest.json');
let manifest = null;
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (_) {}
const manifestIcons = (manifest?.icons || []).map(icon => {
  const file = path.join(root, 'public', icon.src || '');
  return { ...icon, exists: Boolean(icon.src && fs.existsSync(file)), actualDimensions: icon.src && fs.existsSync(file) ? pngDimensions(file) : null };
});
const html = fs.existsSync(path.join(root, 'public', 'index.html')) ? read(path.join(root, 'public', 'index.html')) : '';
const nativeCandidates = [
  'android/app/src/main/AndroidManifest.xml',
  'ios/App/App/Info.plist',
  'capacitor.config.js',
  'capacitor.config.ts',
  'capacitor.config.json',
  'twa-manifest.json',
  'assetlinks.json',
];
const nativeArtifacts = nativeCandidates.filter(relative => fs.existsSync(path.join(root, relative)));
const storeReadinessInventory = {
  manifestPresent: Boolean(manifest),
  manifestIcons,
  appleTouchIconPresent: /apple-touch-icon/i.test(html),
  serviceWorkerPresent: fs.existsSync(path.join(root, 'public', 'firebase-messaging-sw.js')),
  nativeArtifacts,
  nativePackagingDetected: nativeArtifacts.length > 0,
  privacyTextReferences: [...sourceFiles, ...walk('public', file => /\.(?:html|js|json)$/.test(file))].filter(file => /privacy policy|privacy/i.test(read(file))).map(rel),
  accountDeletionReferences: [...sourceFiles, ...apiFiles].filter(file => /account deletion|delete account|account-deletion/i.test(read(file))).map(rel),
};

const analysis = {
  generatedAt: new Date().toISOString(),
  version: packageJson.version,
  nodeEngine: packageJson.engines?.node || '',
  counts: {
    sourceFiles: sourceFiles.length,
    apiFiles: apiFiles.length,
    publicApiHandlers: apiHandlers.length,
    playwrightSpecs: playwrightFiles.length,
    nodeTestFiles: nodeTestFiles.length,
    clientTestFiles: clientTestFiles.length,
    serverTestFiles: serverTestFiles.length,
    discoveredNamedTests: testTitles.length,
    routes: routes.length,
    firestoreCollections: collections.size,
  },
  lineCounts,
  storeReadinessInventory,
  routes,
  publicApiHandlers: apiHandlers,
  firestoreCollections: [...collections].sort(),
  tests: testTitles,
};
const jsonPath = path.join(runDir, 'ultimate-app-analysis.json');
fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
const md = [
  `# 86 Chaos ${analysis.version} test analysis`,
  '',
  `- Source files: ${analysis.counts.sourceFiles}`,
  `- API files: ${analysis.counts.apiFiles} (${analysis.counts.publicApiHandlers} public handlers)`,
  `- Routes discovered: ${analysis.counts.routes}`,
  `- Firestore collection names discovered: ${analysis.counts.firestoreCollections}`,
  `- Playwright specs: ${analysis.counts.playwrightSpecs}`,
  `- Node/Jest/server test files: ${analysis.counts.nodeTestFiles + analysis.counts.clientTestFiles + analysis.counts.serverTestFiles}`,
  `- Named tests discovered: ${analysis.counts.discoveredNamedTests}`,
  '',
  '## Store packaging inventory',
  `- Manifest present: ${analysis.storeReadinessInventory.manifestPresent}`,
  `- Service worker present: ${analysis.storeReadinessInventory.serviceWorkerPresent}`,
  `- Apple touch icon present: ${analysis.storeReadinessInventory.appleTouchIconPresent}`,
  `- Native packaging detected: ${analysis.storeReadinessInventory.nativePackagingDetected}`,
  `- Native artifacts: ${analysis.storeReadinessInventory.nativeArtifacts.join(', ') || 'none in this source ZIP'}`,
  ...analysis.storeReadinessInventory.manifestIcons.map(icon => `- Manifest icon ${icon.src}: declared ${icon.sizes || 'none'}; actual ${icon.actualDimensions ? `${icon.actualDimensions.width}x${icon.actualDimensions.height}` : 'missing/unreadable'}; purpose ${icon.purpose || 'none'}`),
  '',
  '## Routes',
  ...analysis.routes.map(route => `- ${route}`),
  '',
  '## Public API handlers',
  ...analysis.publicApiHandlers.map(file => `- ${file}`),
  '',
  '## Firestore collections referenced',
  ...analysis.firestoreCollections.map(name => `- ${name}`),
  '',
  '## Test catalog',
  ...analysis.tests.map(row => `- ${row.file}: ${row.title}`),
  '',
];
const mdPath = path.join(runDir, 'ultimate-app-analysis.md');
fs.writeFileSync(mdPath, md.join('\n'));
console.log(`Analyzed 86 Chaos ${analysis.version}`);
console.log(`Routes: ${analysis.counts.routes} | Public APIs: ${analysis.counts.publicApiHandlers} | Named tests: ${analysis.counts.discoveredNamedTests}`);
console.log(`Analysis JSON: ${jsonPath}`);
console.log(`Analysis report: ${mdPath}`);
