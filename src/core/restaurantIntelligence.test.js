import { buildMenuCostBreakdowns, getBatchRecipeCost, getInventoryUnitCost } from './menuCosting';
import menuApprovalHelpers from './menuApproval.cjs';
import { searchCustomerHelp, validateCustomerHelpCorpus } from './customerHelpKnowledge';

const { isApprovedDependency } = menuApprovalHelpers;
test('weight and volume are distinct and supplies cannot enter food costing', () => {
  expect(getInventoryUnitCost({ id:'r', price:24, packSize:'12/8 OZ' }, 'fl oz').needsReview).toBe(true);
  expect(getInventoryUnitCost({ id:'g', price:18, packSize:'24 CT', inventorySourceType:'non_food_supply' }, 'each').needsReview).toBe(true);
  expect(getInventoryUnitCost({ id:'w', price:120, packSize:'4/10 LB' }, 'oz').unitCost).toBe(0.1875);
});
test('unapproved dependencies and missing selected items never supply a menu cost', () => {
  expect(isApprovedDependency({ status:'approved', approved:false })).toBe(false);
  expect(isApprovedDependency({ status:'approved', reviewStatus:'needs-review' })).toBe(false);
  expect(isApprovedDependency({ inventoryItemId:'legacy' })).toBe(true);
  const rows=buildMenuCostBreakdowns({ menuDependencies:[{menuItemName:'Wings',inventoryItemId:'missing',inventoryItemName:'Chicken Wings',status:'approved',estimatedQuantity:6,estimatedUnit:'oz'},{menuItemName:'Hidden',status:'needs-review'}],inventoryItems:[{id:'different',name:'Chicken Wings',price:100,packSize:'4/10 LB'}] });
  expect(rows).toHaveLength(1); expect(rows[0].status).toBe('missing-costs'); expect(rows[0].totalCost).toBe(0);
});
test('customer Help corpus remains valid with intelligence and safety articles', () => { expect(validateCustomerHelpCorpus().errors).toEqual([]); });
test('a bounded dependency read cannot report a partially loaded batch as fully costed', () => {
  const recipe = { id:'batch', costingApprovedAt:'approved', costingDependencyIds:['one','two'], batchYieldQuantity:10, batchYieldUnit:'oz', batchYieldPercent:100 };
  const loaded = { id:'one', recipeId:'batch', source:'approved_batch_recipe', status:'approved', inventoryItemId:'w', batchQuantity:4, batchUnit:'oz' };
  expect(getBatchRecipeCost({ recipe, menuDependencies:[loaded], inventoryItems:[{id:'w',price:120,packSize:'4/10 LB'}] }).ready).toBe(false);
});
for (const query of ['why did scanner pick this','wrong case size',"invoice didn't match",'food cost wrong',"why isn't menu cost updating",'scanner missed product','how does AI work','why does this need review']) {
  test(`Help finds job-to-do phrase: ${query}`, () => { expect(searchCustomerHelp(query).length).toBeGreaterThan(0); });
}
