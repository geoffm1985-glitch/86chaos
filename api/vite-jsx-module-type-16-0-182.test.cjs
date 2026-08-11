'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  normalizeModuleId,
  isReactSourceJs,
  createReactJsxModuleTypePlugin
} = require('../scripts/vite-react-jsx-module-type.cjs');

const root = path.resolve(__dirname, '..');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function containsJsx(source) {
  return /<[A-Za-z][A-Za-z0-9_.:-]*(?:\s|\/?>)/.test(source);
}

test('Vite pre-plugin classifies React source .js files as JSX without widening API or dependency scope', () => {
  const plugin = createReactJsxModuleTypePlugin();
  assert.equal(plugin.name, '86chaos-react-js-as-jsx');
  assert.equal(plugin.enforce, 'pre');

  const samples = [
    ['C:\\repo\\86chaos\\src\\index.js', true],
    ['/vercel/path0/src/index.js', true],
    ['/vercel/path0/src/components/DrawerMenu.js?direct', true],
    ['/vercel/path0/src/features/auth.jsx', false],
    ['/vercel/path0/src/core/scheduleMonthPrint.cjs', false],
    ['/vercel/path0/api/alerts.js', false],
    ['/vercel/path0/node_modules/react/index.js', false]
  ];
  for (const [id, expected] of samples) {
    assert.equal(isReactSourceJs(id), expected, `${id} classification`);
  }
  assert.equal(normalizeModuleId('C:\\repo\\src\\index.js?x=1'), 'C:/repo/src/index.js');

  const transformed = plugin.transform('const view = <StrictMode />;', '/vercel/path0/src/index.js');
  assert.equal(transformed.moduleType, 'jsx');
  assert.equal(transformed.code, 'const view = <StrictMode />;');
  assert.equal(transformed.map, null);
  assert.equal(plugin.transform('export default 1;', '/vercel/path0/api/alerts.js'), null);
});

test('every JSX-bearing src .js file is covered by the Vite JSX module-type compatibility rule', () => {
  const plugin = createReactJsxModuleTypePlugin();
  const srcRoot = path.join(root, 'src');
  const jsxJsFiles = walk(srcRoot)
    .filter(file => file.endsWith('.js'))
    .filter(file => containsJsx(fs.readFileSync(file, 'utf8')));

  assert.equal(jsxJsFiles.length, 21, 'known-good CRA baseline and current source both contain 21 JSX-bearing .js files');
  for (const file of jsxJsFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const result = plugin.transform(source, file);
    assert.ok(result, `${path.relative(root, file)} is classified`);
    assert.equal(result.moduleType, 'jsx', `${path.relative(root, file)} gets JSX module type`);
    assert.equal(result.code, source, `${path.relative(root, file)} source is not rewritten`);
  }
});

test('Vite config places the module-type compatibility plugin before React', () => {
  const configSource = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
  assert.ok(configSource.includes("require('./scripts/vite-react-jsx-module-type.cjs')"));
  assert.ok(configSource.includes('plugins: [createReactJsxModuleTypePlugin(), react()]'));
  assert.ok(configSource.indexOf('createReactJsxModuleTypePlugin()') < configSource.indexOf('react()]'));
});
