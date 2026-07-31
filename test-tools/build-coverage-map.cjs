#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = process.cwd();
const runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || path.join(root, 'test-results');
let parser;
let traverse;
try {
  parser = require(require.resolve('@babel/parser', { paths: [root] }));
  traverse = require(require.resolve('@babel/traverse', { paths: [root] })).default;
} catch (error) {
  console.error(`Coverage map requires locked @babel/parser and @babel/traverse: ${error.message}`);
  process.exit(1);
}

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (!predicate || predicate(full)) out.push(full);
  }
  return out;
}
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function lineOf(node) { return node?.loc?.start?.line || 0; }
function functionName(pathRef, fallback = 'anonymous') {
  const node = pathRef.node;
  if (node.id?.name) return node.id.name;
  const parent = pathRef.parentPath?.node;
  if (parent?.type === 'VariableDeclarator' && parent.id?.name) return parent.id.name;
  if (parent?.type === 'ObjectProperty' && (parent.key?.name || parent.key?.value)) return String(parent.key.name || parent.key.value);
  if (parent?.type === 'AssignmentExpression') return parent.left?.name || parent.left?.property?.name || fallback;
  if (node.key?.name || node.key?.value) return String(node.key.name || node.key.value);
  return fallback;
}

const sourceFiles = [...walk(path.join(root, 'src'), file => /\.(?:js|jsx)$/.test(file) && !/\.(?:test|spec)\./.test(file)), ...walk(path.join(root, 'api'), file => /\.(?:js|cjs)$/.test(file) && !/\.test\./.test(file))];
const testFiles = [...walk(path.join(root, 'tests'), file => /\.(?:spec|test)\.(?:cjs|mjs|js|jsx)$/.test(file)), ...walk(path.join(root, 'src'), file => /\.(?:test|spec)\.(?:js|jsx)$/.test(file)), ...walk(path.join(root, 'api'), file => /\.test\.cjs$/.test(file))];
const testRows = [];
for (const file of testFiles) {
  const text = read(file);
  for (const match of text.matchAll(/\b(?:test|it)\s*\(\s*(["'`])([\s\S]*?)\1/g)) {
    const title = match[2].replace(/\s+/g, ' ').trim();
    if (title && !title.includes('${')) testRows.push({ file: rel(file), title, haystack: `${rel(file)} ${title}`.toLowerCase() });
  }
}

const inventory = [];
for (const file of sourceFiles) {
  const text = read(file);
  let ast;
  try {
    ast = parser.parse(text, { sourceType: 'unambiguous', plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'topLevelAwait'] });
  } catch (error) {
    inventory.push({ type: 'parse-error', file: rel(file), name: 'parse-error', line: 0, error: error.message, tests: [] });
    continue;
  }
  const add = (type, name, node, keywords = []) => {
    const normalized = String(name || 'anonymous');
    const fileBase = path.basename(file).replace(/\.[^.]+$/, '');
    const terms = [normalized, fileBase, ...keywords].filter(Boolean).map(term => String(term).toLowerCase());
    const tests = testRows.filter(row => terms.some(term => term.length >= 4 && row.haystack.includes(term))).slice(0, 20).map(({ file: testFile, title }) => ({ file: testFile, title }));
    inventory.push({ type, file: rel(file), name: normalized, line: lineOf(node), tests });
  };
  traverse(ast, {
    FunctionDeclaration(p) { add('function', functionName(p), p.node); },
    FunctionExpression(p) { add('function', functionName(p), p.node); },
    ArrowFunctionExpression(p) { add('function', functionName(p), p.node); },
    ClassMethod(p) { add('method', functionName(p), p.node); },
    ObjectMethod(p) { add('method', functionName(p), p.node); },
    JSXOpeningElement(p) {
      const name = p.node.name?.name || p.node.name?.property?.name || '';
      if (name === 'button' || name === 'Button') {
        const attrs = p.node.attributes || [];
        const labelAttr = attrs.find(attr => ['aria-label', 'title', 'data-testid'].includes(attr.name?.name));
        const label = labelAttr?.value?.value || `button@${lineOf(p.node)}`;
        add('control', label, p.node, ['control', 'button']);
      }
      if (['input', 'select', 'textarea'].includes(name)) add('form-control', `${name}@${lineOf(p.node)}`, p.node, ['form', name]);
    },
    CallExpression(p) {
      const name = p.node.callee?.name || p.node.callee?.property?.name || '';
      const first = p.node.arguments?.[0];
      const value = first?.value;
      if (['collection', 'doc'].includes(name) && typeof value === 'string') add('firestore-path', value, p.node, ['firestore', value]);
      if (['fetch', 'secureFetch'].includes(name)) add('network-call', `${name}@${lineOf(p.node)}`, p.node, ['api', 'network']);
    },
  });
}

const uncovered = inventory.filter(item => !['parse-error'].includes(item.type) && item.tests.length === 0);
const payload = {
  generatedAt: new Date().toISOString(),
  appVersion: (() => { try { return JSON.parse(read(path.join(root, 'package.json'))).version; } catch { return ''; } })(),
  totals: {
    sourceFiles: sourceFiles.length,
    testFiles: testFiles.length,
    tests: testRows.length,
    inventoryItems: inventory.length,
    mappedItems: inventory.length - uncovered.length,
    unmappedItems: uncovered.length,
  },
  inventory,
  uncovered,
};
fs.mkdirSync(runDir, { recursive: true });
const jsonPath = path.join(runDir, 'TEST_COVERAGE_MAP.json');
const mdPath = path.join(runDir, 'TEST_COVERAGE_MAP.md');
fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
const md = [
  `# 86 Chaos ${payload.appVersion} executable coverage map`, '',
  `- Source files: ${payload.totals.sourceFiles}`,
  `- Test files: ${payload.totals.testFiles}`,
  `- Static named tests: ${payload.totals.tests}`,
  `- Inventory items: ${payload.totals.inventoryItems}`,
  `- Items with a matching executable test reference: ${payload.totals.mappedItems}`,
  `- Items requiring review or runtime coverage evidence: ${payload.totals.unmappedItems}`, '',
  'This map is an auditable index, not a claim that name matching alone proves behavioral coverage. Runtime V8 coverage, UI mutation tests, API tests, rules tests, and result artifacts remain the source of truth.', '',
];
for (const item of inventory) {
  md.push(`## ${item.type}: ${item.name}`);
  md.push(`- Source: ${item.file}:${item.line}`);
  if (item.tests.length) item.tests.forEach(test => md.push(`- Test: ${test.file} — ${test.title}`));
  else md.push('- Test: no direct title match; requires runtime coverage evidence or a new targeted test');
  md.push('');
}
fs.writeFileSync(mdPath, md.join('\n'));
console.log(JSON.stringify({ ok: true, jsonPath, mdPath, totals: payload.totals }, null, 2));
