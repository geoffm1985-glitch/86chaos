const { test } = require('node:test');
const { runBrutalScenario } = require('../test-tools/restaurant-brain-fixture.cjs');
test('brutal messy invoice through human approval, costs, batch yield, approved 86 impact, and advisory ordering', runBrutalScenario);
