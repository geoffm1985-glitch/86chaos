'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('17.0.76 release-browser reliability recognizes the stable Ghost Request Off employee-route selector', () => {
  const reliability = read('api/release-browser-reliability.test.cjs');
  const spec = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');

  assert.match(
    reliability,
    /getByTestId\('schedule-request-off-tab'\)/
  );

  assert.doesNotMatch(
    reliability,
    /getByRole\('button', \{ name: \/\^Schedule Request Off\$\/i \}\)/
  );

  assert.match(
    spec,
    /gotoTab\(page, 'published'/
  );

  assert.match(
    spec,
    /getByTestId\('schedule-request-off-tab'\)/
  );

  assert.doesNotMatch(
    spec,
    /gotoTab\(page, 'schedule', \{ settleMs: 1800, maxText: 70000 \}\)/
  );
});

test('17.0.76 Ghost Request Off certification still forbids Schedule Builder permission elevation', () => {
  const reliability = read('api/release-browser-reliability.test.cjs');

  assert.match(
    reliability,
    /Allen QA\[\\s\\S\]\{0,200\}Schedule Builder permission/
  );

  assert.match(
    reliability,
    /doesNotMatch/
  );
});
