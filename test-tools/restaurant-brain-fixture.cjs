'use strict';
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const Module = require('module');
const { fakeFirestore } = require('./fakeFirestore.cjs');
const { INVOICE_SCHEMA, scanWithPrimaryProvider } = require('../api/_ai-provider');
const { resolveAiPolicy, createProviderCallBudget } = require('../api/_ai-policy');
const { approveInvoice } = require('../api/_invoice-approval');
const { vendorMemory } = require('../api/_vendor-memory');
const { approveMenu } = require('../api/_menu-approval');
const { recipeCosting } = require('../api/_recipe-costing');
const { suggestInvoiceMatch } = require('../src/core/vendorProductMemory.cjs');
const { normalizeInvoicePayload } = require('../api/scan-invoice').__test;
function loadCore(name) {
  const filename = path.resolve(__dirname, '../src/core', name);
  const compiled = require('@babel/core').transformSync(fs.readFileSync(filename, 'utf8'), { filename, babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  const module = new Module(filename, moduleForFixture); module.filename = filename; module.paths = Module._nodeModulePaths(path.dirname(filename));
  const actualRequire = module.require.bind(module); module.require = id => id === './appCore' ? { MASTER_ADMIN_EMAIL: '' } : actualRequire(id);
  module._compile(compiled, filename); return module.exports;
}
const moduleForFixture = module;
function structuredInvoice() {
  const invoice = Object.fromEntries(Object.keys(INVOICE_SCHEMA.properties).map(key => [key, null]));
  Object.assign(invoice, { vendorName: 'Kitchen Supply North', invoiceNumber: 'INV-UGLY-227', invoiceDate: '2026-09-08', confidence: 'review', extractionNotes: [], extractionWarnings: [], lineItems: [] });
  const row = (itemName, overrides = {}) => ({ ...Object.fromEntries(Object.keys(INVOICE_SCHEMA.properties.lineItems.items.properties).map(key => [key, null])),
    rowIndex: invoice.lineItems.length + 1, rowType: 'product', itemName, description: itemName, quantity: 1, uom: 'CS', isCatchWeight: false, substitution: false, rawText: itemName, confidence: 'high', ...overrides });
  invoice.lineItems = [
    row('CHICKEN WINGS', { productCode: 'CK522', packSize: '4/10 LB', unitPrice: 120, totalPrice: 120, rawText: '1 CS 4/10 LB CHICKEN WINGS' }),
    row('FRIES', { productCode: 'FR2', quantity: 2, shippedQty: 2, orderedQty: 3, backOrderedQty: 1, packSize: '2/5 LB', unitPrice: 20, totalPrice: 40, rawText: '2 CS 2/5 LB FRIES' }),
    row('RANCH', { productCode: 'RA3', packSize: '12/8 OZ', unitPrice: 24, totalPrice: 24, rawText: '1 CS 12/8 OZ RANCH' }),
    row('NITRILE GLOVES', { productCode: 'GL4', packSize: '24 CT', rowType: 'non_food_supply', unitPrice: 18, totalPrice: 18 }),
    row('CK522 CHIX WNG', { productCode: 'CK522', quantity: 0.5, packSize: '4/10 LB', unitPrice: 120, totalPrice: 60 }),
    row('BEEF BRISKET CW', { productCode: 'BR5', packSize: '2 PC CATCH WEIGHT', isCatchWeight: true, catchWeight: null, priceUnit: 'LB', unitPrice: 5.25, totalPrice: 173.25 }),
    ...['FREIGHT 12.50', 'SALES TAX 6.10', 'SUBTOTAL 495.25', 'INVOICE TOTAL 513.85', 'CUSTOMER NUMBER 7821', 'SHIP TO 12 MAIN STREET', 'VENDOR ADDRESS 45 INDUSTRIAL ROAD', 'PAYMENT TERMS NET 14', 'ROUTE 8 PAGE 1 OF 1', 'THANK YOU FOR YOUR BUSINESS'].map(name => row(name, { rowType: 'header', quantity: null, uom: null }))
  ].map((value, i) => ({ ...value, rowIndex: i + 1 }));
  return invoice;
}
async function runBrutalScenario() {
  const { buildMenuCostBreakdowns, getBatchRecipeCost } = loadCore('menuCosting.js');
  const { getZeroStockMenuImpacts } = loadCore('menuIntelligence.js');
  const { buildAiOrderAssistant } = loadCore('aiOrderAssistant.js');
  const ctx = { restaurantId: 'restaurantA', uid: 'managerA', user: { name: 'Manager', isAdmin: true } };
  const inventory = [
    { id: 'wings', name: 'Chicken Wings', pfgCode: 'CK522', packSize: '4/10 LB', price: 80 },
    { id: 'fries', name: 'Frozen French Fries', pfgCode: 'FR2', packSize: '2/5 LB', price: 10 },
    { id: 'ranch', name: 'Ranch', pfgCode: 'RA3', packSize: '12/8 OZ', price: 12 },
    { id: 'gloves', name: 'Nitrile Gloves', pfgCode: 'GL4', packSize: '24 CT', price: 10, inventorySourceType: 'non_food_supply', category: 'Supplies' },
    { id: 'brisket', name: 'Beef Brisket', pfgCode: 'BR5', packSize: '2 PC CATCH WEIGHT', price: 100 }
  ].map(item => ({ ...item, restaurantId: ctx.restaurantId, supplierId: 'vendorA', inventoryUnit: 'case', currentStock: 0, parLevel: 3 }));
  const dependencies = [{ id: 'wingLink', restaurantId: ctx.restaurantId, menuItemName: 'Wings Plate', menuItemPrice: 15, inventoryItemId: 'wings', ingredientName: 'Chicken Wings', estimatedQuantity: 8, estimatedUnit: 'oz', portionConfidence: 'approved', status: 'approved' },
    { id: 'unapproved', restaurantId: ctx.restaurantId, menuItemName: 'Never approved', inventoryItemId: 'wings', estimatedQuantity: 100, estimatedUnit: 'oz', status: 'needs-review' }];
  const seed = Object.fromEntries(inventory.map(item => [`inventoryItems/${item.id}`, item]));
  dependencies.forEach(dep => { seed[`menuDependencies/${dep.id}`] = dep; }); seed['vendors/vendorA'] = { restaurantId: ctx.restaurantId, name: 'Kitchen Supply North' };
  seed['recipes/ranchBatch'] = { restaurantId: ctx.restaurantId, title: 'House ranch batch' };
  const db = fakeFirestore(seed); const before = JSON.stringify([...db.records]);
  const contract = resolveAiPolicy({ feature: 'invoice', route: '/api/scan-invoice', env: {} }); const budget = createProviderCallBudget('invoice');
  let providerCalls = 0;
  const result = await scanWithPrimaryProvider({ contract, budget, env: { OPENAI_API_KEY: 'mock-key' }, schema: INVOICE_SCHEMA, prompt: 'Read the fixture', buffer: Buffer.from('mock invoice'), mimeType: 'application/pdf',
    fetchImpl: async (url, options) => { providerCalls++; const body = JSON.parse(options.body); assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(body.text.format.strict, true); assert.equal(body.model, contract.model);
      return { ok: true, json: async () => ({ status: 'completed', usage: { input_tokens: 900, output_tokens: 700 }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(structuredInvoice()) }] }] }) }; }
  });
  const normalized = normalizeInvoicePayload(result.parsed);
  assert.equal(normalized.lineItems.length, 6, 'All food and purchased supplies reach Stock Matcher; every noise row is excluded');
  assert.equal(normalized.lineItems.filter(row => /gloves/i.test(row.itemName)).length, 1);
  const rows = normalized.lineItems.map(row => { const match = suggestInvoiceMatch(row, inventory, [], { restaurantId: ctx.restaurantId, vendorId: 'vendorA' }); return { ...row, matchedItemId: match.matchedItemId, matchNeedsReview: match.needsReview, matchExplanation: match.explanation }; });
  assert.equal(rows.find(row => row.rawText === 'CK522 CHIX WNG').matchedItemId, 'wings');
  assert.match(rows.find(row => row.rawText === 'CK522 CHIX WNG').matchExplanation, /exact vendor SKU CK522/);
  const uncertain = rows.filter(row => row.matchNeedsReview); assert.equal(uncertain.length, 1); assert.match(uncertain[0].matchExplanation, /Catch weight/i);
  const costBefore = buildMenuCostBreakdowns({ menuDependencies: dependencies, inventoryItems: inventory })[0].totalCost;
  const invoice = { ...normalized, vendorId: 'vendorA', lineItems: rows, skippedRows: [], sourceSha256: 'mock-source-sha' };
  await assert.rejects(approveInvoice({ db, ctx, invoice, approved: false }), /Human approval/);
  await assert.rejects(approveInvoice({ db, ctx, invoice, approved: true }), /Review/);
  assert.equal(JSON.stringify([...db.records]), before, 'Rejected or pending review changes neither stock nor costs');
  assert.equal(buildMenuCostBreakdowns({ menuDependencies: dependencies, inventoryItems: inventory })[0].totalCost, costBefore);
  uncertain[0].quantityConfirmed = true; uncertain[0].reviewedStockQuantity = 1; uncertain[0].reviewedStockUnitCost = 173.25; uncertain[0].reviewNote = 'Verified actual 33 lb delivered at $5.25/lb; one received case.';
  const approved = await approveInvoice({ db, ctx, invoice, approved: true }); assert.equal(approved.duplicate, false);
  const afterItems = inventory.map(item => ({ id: item.id, ...db.records.get(`inventoryItems/${item.id}`) }));
  assert.equal(afterItems.find(row => row.id === 'wings').currentStock, 1.5); assert.equal(afterItems.find(row => row.id === 'wings').price, 120);
  assert.equal(afterItems.find(row => row.id === 'fries').currentStock, 2); assert.equal(afterItems.find(row => row.id === 'gloves').inventorySourceType, 'non_food_supply');
  assert.equal([...db.records.keys()].filter(key => key.startsWith('inventoryItems/')).length, 5);
  const costAfter = buildMenuCostBreakdowns({ menuDependencies: dependencies, inventoryItems: afterItems })[0].totalCost; assert.equal(costBefore, 1); assert.equal(costAfter, 1.5);
  const writeCount = db.writes.length; assert.equal((await approveInvoice({ db, ctx, invoice, approved: true })).duplicate, true); assert.equal(db.writes.length, writeCount);
  const memories = await vendorMemory({ db, ctx, body: { action: 'vendor-memory-resolve', vendorId: 'vendorA', rows } });
  const shorthand = suggestInvoiceMatch(rows.find(row => row.rawText === 'CK522 CHIX WNG'), afterItems, memories.mappings, { restaurantId: ctx.restaurantId, vendorId: 'vendorA' }); assert.match(shorthand.explanation, /previously approved vendor mapping/);
  await recipeCosting({ db, ctx, body: { action: 'recipe-costing-approve', recipeId: 'ranchBatch', approved: true, yieldQuantity: 48, yieldUnit: 'oz', yieldPercent: 100, rows: [{ inventoryItemId: 'ranch', batchQuantity: 48, batchUnit: 'oz' }] } });
  const recipe = { id: 'ranchBatch', ...db.records.get('recipes/ranchBatch') };
  const batchDeps = [...db.records].filter(([key]) => key.startsWith('menuDependencies/')).map(([key, dep]) => ({ id: key.split('/').at(-1), ...dep }));
  assert.equal(getBatchRecipeCost({ recipe, menuDependencies: batchDeps, inventoryItems: afterItems }).totalCost, 12);
  const scan = { storagePath: 'restaurantA/menu.pdf', scanRequestId: 'mock-menu', menuItems: [{ name: 'Ranch dip', price: 2, ingredients: [{ name: 'House ranch batch', batchRecipeId: 'ranchBatch', estimatedQuantity: 2, estimatedUnit: 'oz', portionConfidence: 'approved', reviewStatus: 'approved' }] }] };
  await assert.rejects(approveMenu({ db, ctx, scan, approved: false }), /approval/); await approveMenu({ db, ctx, scan, approved: true });
  const allDeps = [...db.records].filter(([key]) => key.startsWith('menuDependencies/')).map(([key, dep]) => ({ id: key.split('/').at(-1), ...dep }));
  const costRows = buildMenuCostBreakdowns({ menuDependencies: allDeps, inventoryItems: afterItems, recipes: [recipe] });
  assert.equal(costRows.find(row => row.menuItemName === 'Ranch dip').totalCost, 0.5); assert.equal(costRows.find(row => row.menuItemName === 'Ranch dip').foodCostPct, 25);
  const impacts = getZeroStockMenuImpacts(afterItems.map(item => ({ ...item, currentStock: 0 })), allDeps);
  assert(impacts.some(row => row.impacts.some(hit => hit.name === 'Wings Plate'))); assert(impacts.some(row => row.impacts.some(hit => hit.name === 'Ranch dip'))); assert(!JSON.stringify(impacts).includes('Never approved'));
  const stateBeforeOrder = JSON.stringify([...db.records]);
  const orders = buildAiOrderAssistant({ inventoryItems: afterItems, vendors: [{ id: 'vendorA', name: 'Kitchen Supply North' }], menuDependencies: allDeps, invoices: [{ ...invoice, status: 'approved' }], currentDate: '2026-09-09' });
  assert(orders.recommendations.some(row => row.suggestedQty > 0), 'AI Order recommends quantities'); assert.equal(JSON.stringify([...db.records]), stateBeforeOrder); assert(![...db.records.keys()].some(key => key.startsWith('orders/'))); assert(afterItems.every(item => item.parLevel === 3));
  return { providerCalls, classifiedProducts: rows.length, excludedNoise: result.parsed.lineItems.length - rows.length, needsReview: uncertain.length, costBefore, costAfter, batchCost: 12, portionCost: 0.5, menuFoodCostPercent: 25, advisoryOnly: true, paidCalls: 0 };
}
module.exports = { runBrutalScenario, structuredInvoice, loadCore };
