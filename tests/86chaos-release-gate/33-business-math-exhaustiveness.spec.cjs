const { test, expect } = require('@playwright/test');
const { buildFakeRestaurantProfile } = require('../86chaos-full-audit/utils/fake-restaurant-profile.cjs');
const { durationForShift } = require('../86chaos-full-audit/utils/math-oracle.cjs');
const { attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { analyze } = require('../../test-tools/ultimate-source-inventory.cjs');

const closeTo = (actual, expected, epsilon = 1e-9) => Math.abs(Number(actual) - Number(expected)) <= epsilon;

test.describe('33 business math exhaustiveness', () => {
  test('every production arithmetic expression is source-ledgered with file and line evidence', async ({}, testInfo) => {
    const inv = analyze(process.cwd());
    const math = inv.mathExpressions || [];
    const missingLocation = math.filter(row => !row.file || !Number.isFinite(Number(row.line)) || Number(row.line) < 1);
    const byFile = math.reduce((out, row) => {
      out[row.file] = (out[row.file] || 0) + 1;
      return out;
    }, {});
    await attachJson(testInfo, '33-production-math-ledger.json', {
      totalExpressions: math.length,
      filesWithMath: Object.keys(byFile).length,
      byFile,
      missingLocation,
      expressions: math,
      note: 'This ledger makes every arithmetic expression reviewable. Domain truth is independently checked below for the release-gate restaurant fixture.',
    });
    expect(math.length, 'Production arithmetic-expression inventory unexpectedly shrank').toBeGreaterThanOrEqual(500);
    expect(Object.keys(byFile).length, 'Math should be spread across the real application, not a synthetic test-only file').toBeGreaterThanOrEqual(15);
    expect(missingLocation, 'Every production math expression must have auditable source location evidence').toEqual([]);
  });

  test('independent golden oracle cross-checks seeded inventory, recipe, labor, sales, tax, tips, discount, and expense math', async ({}, testInfo) => {
    const profile = buildFakeRestaurantProfile({ restaurantId: 'ultimate-math-r1', runId: 'ultimate-math', anchorDate: new Date('2026-08-21T12:00:00-05:00') });
    const c = profile.collections;

    const inventory = c.inventoryItems.map(item => ({
      name: item.name,
      par: Number(item.parLevel || 0),
      stock: Number(item.currentStock || 0),
      shortage: Math.max(0, Number(item.parLevel || 0) - Number(item.currentStock || 0)),
      extendedValue: Number(item.currentStock || 0) * Number(item.price || 0),
    }));
    const expectedShortages = {
      'QA Fry Oil': 6,
      'QA Salmon Portion': 24,
      'QA Romaine': 2,
      'QA Burger Bun': 0,
    };
    for (const row of inventory) expect(row.shortage, `${row.name} shortage-to-par`).toBe(expectedShortages[row.name]);
    const onHandValue = inventory.reduce((sum, row) => sum + row.extendedValue, 0);
    expect(onHandValue, 'Seeded on-hand inventory value = 2×38 + 0×4.25 + 3×22 + 12×3.5').toBe(184);

    const salmon = c.recipes.find(row => row.name === 'QA Salmon BLT');
    expect(salmon, 'Golden recipe fixture exists').toBeTruthy();
    const foodCostPct = salmon.cost / salmon.menuPrice * 100;
    const grossProfit = salmon.menuPrice - salmon.cost;
    const grossMarginPct = grossProfit / salmon.menuPrice * 100;
    expect(closeTo(foodCostPct, 36.11111111111111), 'Recipe food-cost percentage').toBe(true);
    expect(closeTo(grossProfit, 11.5), 'Recipe gross profit dollars').toBe(true);
    expect(closeTo(grossMarginPct, 63.888888888888886), 'Recipe gross-margin percentage').toBe(true);
    expect(closeTo(foodCostPct + grossMarginPct, 100), 'Food cost + gross margin must reconcile to 100%').toBe(true);

    const allen = c.users.find(row => row.idKey === 'allen');
    const allenPunch = c.timePunches.find(row => row.employeeName === 'Allen QA' && row.clockOutTime);
    const punchHours = (new Date(allenPunch.clockOutTime) - new Date(allenPunch.clockInTime)) / 3_600_000;
    const laborDollars = punchHours * Number(allen.wage || 0);
    expect(punchHours, 'Allen complete punch must equal five hours').toBe(5);
    expect(laborDollars, 'Five hours × $18 wage must equal $90 labor').toBe(90);

    const salesChecks = c.sales.map(row => ({
      date: row.date,
      gross: row.grossSales,
      netRatio: row.netSales / row.grossSales,
      taxRatio: row.tax / row.grossSales,
      tipRatio: row.tips / row.grossSales,
      laborRatio: row.laborCost / row.grossSales,
      reconciliation: row.netSales + row.tax + row.discounts,
    }));
    for (const row of salesChecks) {
      expect(closeTo(row.netRatio, 0.92), `${row.date} seeded net-sales ratio`).toBe(true);
      expect(closeTo(row.taxRatio, 0.055), `${row.date} seeded tax ratio`).toBe(true);
      expect(closeTo(row.tipRatio, 0.18), `${row.date} seeded tips ratio`).toBe(true);
      expect(closeTo(row.laborRatio, 0.23), `${row.date} seeded labor-cost ratio`).toBe(true);
    }
    const grossSales = c.sales.reduce((sum, row) => sum + Number(row.grossSales || 0), 0);
    const netSales = c.sales.reduce((sum, row) => sum + Number(row.netSales || 0), 0);
    const tax = c.sales.reduce((sum, row) => sum + Number(row.tax || 0), 0);
    const tips = c.sales.reduce((sum, row) => sum + Number(row.tips || 0), 0);
    const seededLabor = c.sales.reduce((sum, row) => sum + Number(row.laborCost || 0), 0);
    const expenses = c.financialExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    expect(closeTo(netSales, grossSales * 0.92), 'Aggregate net sales').toBe(true);
    expect(closeTo(tax, grossSales * 0.055), 'Aggregate tax').toBe(true);
    expect(closeTo(tips, grossSales * 0.18), 'Aggregate tips').toBe(true);
    expect(closeTo(seededLabor, grossSales * 0.23), 'Aggregate seeded labor cost').toBe(true);
    expect(closeTo(expenses, 1015.44), 'Seeded expenses 775.44 + 240.00').toBe(true);

    const canonicalShiftCases = [
      ['3p', '9p', 6], ['10a', '9p', 11], ['10p', '3a', 5], ['4p', '10a', 0], ['10p', '3p', 0],
    ].map(([start, end, expected]) => ({ start, end, expected, actual: durationForShift(start, end) }));
    for (const row of canonicalShiftCases) expect(row.actual.hours, `${row.start}-${row.end} schedule duration`).toBe(row.expected);

    await attachJson(testInfo, '33-golden-business-math.json', {
      inventory,
      onHandValue,
      recipe: { cost: salmon.cost, menuPrice: salmon.menuPrice, foodCostPct, grossProfit, grossMarginPct },
      labor: { punchHours, wage: allen.wage, laborDollars },
      sales: { grossSales, netSales, tax, tips, seededLabor, expenses, salesChecks },
      canonicalShiftCases,
    });
  });
});
