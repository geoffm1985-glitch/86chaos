const fs = require('fs');
const path = require('path');

const root = process.cwd();
const { ensureRunDir } = require('./run-context.cjs');
const { runDir: outDir, runId } = ensureRunDir();

const result = {
  ok: true,
  generatedAt: new Date().toISOString(),
  runId,
  node: process.version,
  root,
  errors: [],
  warnings: [],
  totals: {},
  files: [],
  unreachableSourceFiles: [],
  largestFiles: [],
  endpointFiles: [],
};

function walk(dir, predicate, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === 'coverage' || entry.name === 'test-results') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, predicate, acc);
    else if (!predicate || predicate(p)) acc.push(p);
  }
  return acc;
}

function rel(p) { return path.relative(root, p).replace(/\\/g, '/'); }
function read(p) { return fs.readFileSync(p, 'utf8'); }

const major = Number(process.versions.node.split('.')[0]);
if (major < 24) result.errors.push(`Node 24.x is required by this release gate. Current runtime: ${process.version}`);

for (const required of ['package.json', 'package-lock.json', 'src/App.js', 'src/index.js', 'firestore.rules', 'storage.rules', 'vercel.json']) {
  if (!fs.existsSync(path.join(root, required))) result.errors.push(`Missing required app file: ${required}`);
}

let parser;
let traverse;
let importGraphAvailable = true;
try {
  parser = require('@babel/parser');
  traverse = require('@babel/traverse').default;
} catch (error) {
  importGraphAvailable = false;
  result.errors.push(`Babel parser/traverse unavailable: ${error.message}. Run npm ci --include=dev --no-audit --no-fund before source inventory.`);
  result.warnings.push('Import graph and unreachable-source analysis were skipped because the Babel parser dependencies were unavailable. No source files were marked unreachable from this incomplete analysis.');
}

const sourceFiles = walk(path.join(root, 'src'), p => /\.(js|jsx|ts|tsx)$/.test(p) && !/\.(test|spec)\./.test(p));
const apiFiles = walk(path.join(root, 'api'), p => /\.(js|cjs|mjs|py)$/.test(p));
const functionFiles = walk(path.join(root, 'functions'), p => /\.(js|ts)$/.test(p) && !/\/lib\//.test(p.replace(/\\/g, '/')));
const testFiles = walk(root, p => /\.(test|spec)\.(js|jsx|ts|tsx|cjs|mjs)$/.test(p));

const importsByFile = new Map();
let totalLines = 0;
let totalFunctions = 0;
let totalHandlers = 0;
let totalFirebaseCalls = 0;
let totalFetchCalls = 0;
let totalButtons = 0;
let totalInputs = 0;

for (const file of [...sourceFiles, ...apiFiles, ...functionFiles]) {
  const text = read(file);
  const lines = text.split(/\r?\n/).length;
  totalLines += lines;
  const entry = { file: rel(file), lines, functions: 0, handlers: 0, firebaseCalls: 0, fetchCalls: 0, buttons: 0, inputs: 0, parseError: '' };
  if (parser && /\.(js|jsx|ts|tsx|cjs|mjs)$/.test(file)) {
    try {
      const ast = parser.parse(text, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'topLevelAwait'],
        errorRecovery: false,
      });
      const imports = [];
      traverse(ast, {
        ImportDeclaration(p) { imports.push(p.node.source.value); },
        CallExpression(p) {
          const callee = p.node.callee;
          const name = callee && callee.type === 'Identifier' ? callee.name : '';
          if (['addDoc', 'setDoc', 'updateDoc', 'deleteDoc', 'onSnapshot', 'getDocs', 'getDoc', 'writeBatch', 'runTransaction'].includes(name)) entry.firebaseCalls += 1;
          if (name === 'fetch' || name === 'secureFetch') entry.fetchCalls += 1;
        },
        FunctionDeclaration() { entry.functions += 1; },
        FunctionExpression() { entry.functions += 1; },
        ArrowFunctionExpression() { entry.functions += 1; },
        ClassMethod() { entry.functions += 1; },
        ObjectMethod() { entry.functions += 1; },
        JSXAttribute(p) {
          const name = p.node.name && p.node.name.name;
          if (/^on[A-Z]/.test(String(name || ''))) entry.handlers += 1;
        },
        JSXOpeningElement(p) {
          const name = p.node.name && (p.node.name.name || p.node.name.property?.name);
          if (name === 'button' || name === 'Button') entry.buttons += 1;
          if (['input', 'select', 'textarea'].includes(name)) entry.inputs += 1;
        },
      });
      importsByFile.set(rel(file), imports);
    } catch (error) {
      entry.parseError = error.message;
      result.errors.push(`Parse failure in ${entry.file}: ${error.message}`);
    }
  }
  totalFunctions += entry.functions;
  totalHandlers += entry.handlers;
  totalFirebaseCalls += entry.firebaseCalls;
  totalFetchCalls += entry.fetchCalls;
  totalButtons += entry.buttons;
  totalInputs += entry.inputs;
  result.files.push(entry);
}

function resolveLocalImport(fromRel, specifier) {
  if (!specifier || !specifier.startsWith('.')) return null;
  const fromAbs = path.join(root, fromRel);
  const base = path.resolve(path.dirname(fromAbs), specifier);
  const candidates = [
    base,
    `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`,
    path.join(base, 'index.js'), path.join(base, 'index.jsx'), path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
  ];
  const found = candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile());
  return found ? rel(found) : null;
}

const reachable = new Set();
if (importGraphAvailable) {
  const queue = ['src/index.js', 'src/App.js'].filter(f => fs.existsSync(path.join(root, f)));
  while (queue.length) {
    const file = queue.shift();
    if (reachable.has(file)) continue;
    reachable.add(file);
    for (const specifier of importsByFile.get(file) || []) {
      const resolved = resolveLocalImport(file, specifier);
      if (resolved && !reachable.has(resolved)) queue.push(resolved);
    }
  }
  result.unreachableSourceFiles = sourceFiles.map(rel).filter(f => !reachable.has(f)).sort();
} else {
  result.importGraphSkipped = true;
  result.unreachableSourceFiles = [];
}
result.largestFiles = [...result.files].sort((a, b) => b.lines - a.lines).slice(0, 30);
result.endpointFiles = apiFiles.map(rel).sort();
result.totals = {
  sourceFiles: sourceFiles.length,
  apiFiles: apiFiles.length,
  functionFiles: functionFiles.length,
  testFiles: testFiles.length,
  lines: totalLines,
  functions: totalFunctions,
  eventHandlers: totalHandlers,
  firebaseCallSites: totalFirebaseCalls,
  fetchCallSites: totalFetchCalls,
  buttonElements: totalButtons,
  formElements: totalInputs,
  reachableSourceFiles: reachable.size,
  unreachableSourceFiles: result.unreachableSourceFiles.length,
};

if (testFiles.length < 10) result.errors.push(`Only ${testFiles.length} test files were found. The release gate requires a broad automated suite.`);
if (totalHandlers > 0 && testFiles.length < Math.ceil(totalHandlers / 25)) {
  result.warnings.push(`There are ${totalHandlers} UI event handlers but only ${testFiles.length} test files. A green smoke test cannot imply handler-level coverage.`);
}
if (result.unreachableSourceFiles.length) {
  result.warnings.push(`${result.unreachableSourceFiles.length} source files are not reachable from src/index.js/App.js. Review for dead or duplicate implementations.`);
}

result.ok = result.errors.length === 0;
const out = path.join(outDir, 'source-inventory.json');
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ok: result.ok, output: out, totals: result.totals, errors: result.errors, warnings: result.warnings }, null, 2));
if (!result.ok) process.exitCode = 1;
