'use strict';
const { test } = require('../fixtures/emulator-navigation-test.cjs');
const { verifyPromotedIdentity, verifyPromotedSchedule, verifyProductionTokenRefused, verifyInventoryRejectsOmissions } = require('../fixtures/testing-promotion-scenarios.cjs');
test('client and API serve the same promoted testing candidate', verifyPromotedIdentity);
test('authenticated promoted Schedule Builder retains its workflow without startup crashes', verifyPromotedSchedule);
test('testing API cannot use a production-project bearer token', verifyProductionTokenRefused);
test('inventory refuses omitted declarations and mismatched discovery totals', verifyInventoryRejectsOmissions);
