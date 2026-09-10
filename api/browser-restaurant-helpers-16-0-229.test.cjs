const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

test('retained Node entry points expose the exact shared restaurant implementations', () => {
  for (const name of ['restaurantPack', 'vendorProductMemory', 'menuApproval', 'foodSafety', 'posNormalization', 'labelPresets']) {
    const helper = require(`../src/core/${name}.cjs`);
    assert.strictEqual(helper, globalThis[`__86Chaos${name[0].toUpperCase()}${name.slice(1)}Shared`]);
    assert.ok(Object.values(helper).some(value => typeof value === 'function'), `${name} must export callable helpers.`);
  }
});

test('production bundler executes restaurant helpers as code across review, costing, Prep, POS and labels', async () => {
  const root = path.resolve(__dirname, '..');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-browser-helpers-'));
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const webpack = require('webpack');
  const config = require('react-scripts/config/webpack.config')('production');
  // Preserve the application's real loaders and resolver. Only the entry/output
  // and app-shell packaging plugins differ in this small isolated runtime probe.
  config.entry = path.join(root, 'test-tools/restaurant-browser-entry.js');
  config.output = { ...config.output, path: output, filename: 'probe.js', library: { type: 'commonjs2' } };
  config.plugins = config.plugins.filter(plugin => ['DefinePlugin', 'IgnorePlugin'].includes(plugin.constructor.name));
  config.optimization = { ...config.optimization, splitChunks: false, runtimeChunk: false };
  config.cache = false;
  config.devtool = false;
  const compiler = webpack(config);
  try {
    const stats = await new Promise((resolve, reject) => compiler.run((error, result) => error ? reject(error) : resolve(result)));
    assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
    const result = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(output, 'probe.js'), 'utf8'), { module: result, exports: result.exports, self: {}, console }, { timeout: 5000 });
    const evidence = JSON.parse(JSON.stringify(result.exports.verifyRestaurantBrowserRuntime()));
    assert.deepEqual(evidence, { packageAmount: 40, received: 1, matchedItem: 'wings', approved: true, menuCount: 1, menuCost: 1.5, missedChecks: 1, temperatureResult: 'pass', posRows: 1, labelWidth: '3.5in' });
    const assets = stats.toJson({ all: false, assets: true }).assets.map(asset => asset.name);
    assert.equal(assets.some(name => /(?:foodSafety|menuApproval|restaurantPack|vendorProductMemory|posNormalization|labelPresets).*\.cjs$/.test(name)), false, 'Executable restaurant helpers must not be emitted as downloadable assets.');
  } finally {
    await new Promise(resolve => compiler.close(resolve));
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
    fs.rmSync(output, { recursive: true, force: true });
  }
});
