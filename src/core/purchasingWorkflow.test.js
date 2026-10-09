import { buildMenuCostBreakdowns, getBatchRecipeCost } from './menuCosting';
import { buildRestaurantKnowledgeGraph } from './restaurantKnowledgeGraph';
import { buildAiOrderAssistant } from './aiOrderAssistant';
const { approveInvoice } = require('../../api/_invoice-approval');
const { recipeCosting } = require('../../api/_recipe-costing');
const { fakeFirestore } = require('../../test-tools/fakeFirestore.cjs');

const ctx={restaurantId:'r1',uid:'owner',user:{name:'Owner'}};
const seed = () => ({
  'inventoryItems/flour':{restaurantId:'r1',name:'Flour',price:1,latestCost:1,inventoryUnit:'lb',packSize:'1/10 LB',currentStock:1,parLevel:5,category:'Dry'},
  'recipes/batch':{restaurantId:'r1',title:'Dough',costingDependencyIds:[]},
  'menuDependencies/pizza':{restaurantId:'r1',menuItemName:'Pizza',menuItemId:'pizza',batchRecipeId:'batch',recipeId:'batch',recipeIds:['batch'],ingredientName:'Dough',estimatedQuantity:8,estimatedUnit:'oz',menuItemPrice:10,status:'approved'}
});
const invoice=()=>({invoiceNumber:'flow-85',invoiceDate:'2026-10-08',vendorName:'Vendor',lineItems:[{itemName:'Flour',matchedItemId:'flour',shippedQty:0.5,orderedQty:2,backOrderedQty:1.5,uom:'CS',packSize:'1/10 LB',totalPrice:10}]});
const records = db => ({inventoryItems:[...db.records].filter(([key])=>key.startsWith('inventoryItems/')).map(([key,row])=>({id:key.split('/').at(-1),...row})),recipes:[...db.records].filter(([key])=>key.startsWith('recipes/')).map(([key,row])=>({id:key.split('/').at(-1),...row})),menuDependencies:[...db.records].filter(([key])=>key.startsWith('menuDependencies/')).map(([key,row])=>({id:key.split('/').at(-1),...row}))});
const approveBatch = db => recipeCosting({db,ctx,body:{action:'recipe-costing-approve',approved:true,recipeId:'batch',expectedApprovedAt:'',yieldQuantity:5,yieldUnit:'lb',yieldPercent:80,rows:[{inventoryItemId:'flour',batchQuantity:2,batchUnit:'lb'}]}});

test('reviewed partial receiving flows through stock, current cost, batch yield, menu impact, graph, and order suggestion',async()=>{
  const db=fakeFirestore(seed());await approveBatch(db);const before=records(db);
  expect(getBatchRecipeCost({recipe:before.recipes[0],...before}).unitCost).toBe(0.5);
  const menuBefore=buildMenuCostBreakdowns(before)[0];
  const result=await approveInvoice({db,ctx,invoice:invoice(),approved:true});expect(result.duplicate).toBe(false);
  const item=db.records.get('inventoryItems/flour');expect(item.currentStock).toBe(6);expect(item.latestCost).toBe(2);
  const after=records(db);const batch=getBatchRecipeCost({recipe:after.recipes[0],...after});expect(batch.ready).toBe(true);expect(batch.totalCost).toBe(4);expect(batch.unitCost).toBe(1);
  const menu=buildMenuCostBreakdowns(after)[0];expect(menu.totalCost).toBeGreaterThan(menuBefore.totalCost);expect(menu.totalCost).toBe(0.5);expect(menu.foodCostPct).toBe(5);
  const saved={id:result.id,...db.records.get(`invoices/${result.id}`)};expect(saved.lineItems[0].approvedStockQuantity).toBe(5);expect(saved.lineItems[0].approvedStockUnitCost).toBe(2);
  const graph=buildRestaurantKnowledgeGraph({workspaceId:'r1',...after,invoices:[saved],menuItems:[{id:'pizza',restaurantId:'r1',name:'Pizza',recipeIds:['batch']}],vendors:[{id:result.vendorId,restaurantId:'r1',name:'Vendor'}]});expect(graph.edges.length).toBeGreaterThan(0);
  const order=buildAiOrderAssistant({...after,vendors:[],invoices:[saved],currentDate:'2026-10-08'});expect(Array.isArray(order.recommendations)).toBe(true);
  const writes=db.writes.length;const duplicate=await approveInvoice({db,ctx,invoice:invoice(),approved:true});expect(duplicate.duplicate).toBe(true);expect(db.writes.length).toBe(writes);expect(db.records.get('inventoryItems/flour').currentStock).toBe(6);
});
test('unreviewed and ambiguous catch-weight approvals preserve every stock/cost record',async()=>{
  for(const args of [{approved:false,invoice:invoice()},{approved:true,invoice:{...invoice(),lineItems:[{...invoice().lineItems[0],isCatchWeight:true}]}},{approved:true,invoice:{...invoice(),lineItems:[{...invoice().lineItems[0],matchNeedsReview:true}]}}]) {
    const db=fakeFirestore(seed());await expect(approveInvoice({db,ctx,...args})).rejects.toThrow();expect(db.writes).toEqual([]);expect(db.records.get('inventoryItems/flour').currentStock).toBe(1);
  }
});
test('reviewed actual catch-weight receipt uses explicitly approved stock quantity and cost',async()=>{const db=fakeFirestore(seed());await approveInvoice({db,ctx,approved:true,invoice:{...invoice(),lineItems:[{...invoice().lineItems[0],isCatchWeight:true,quantityConfirmed:true,reviewNote:'Verified delivered weight',reviewedStockQuantity:4.25,reviewedStockUnitCost:2}]}});expect(db.records.get('inventoryItems/flour').currentStock).toBe(5.25);});
test('one bad row rolls back the whole invoice and another workspace cannot approve its stock',async()=>{const db=fakeFirestore(seed());await expect(approveInvoice({db,ctx,approved:true,invoice:{...invoice(),lineItems:[...invoice().lineItems,{...invoice().lineItems[0],matchedItemId:'missing'}]}})).rejects.toThrow();expect(db.writes).toEqual([]);await expect(approveInvoice({db,ctx:{...ctx,restaurantId:'r2'},approved:true,invoice:invoice()})).rejects.toThrow(/workspace/i);expect(db.writes).toEqual([]);});
test('failed transaction retry restores the intended result exactly once',async()=>{const db=fakeFirestore(seed());const transact=db.runTransaction;db.runTransaction=async()=>{throw new Error('Connection interrupted');};await expect(approveInvoice({db,ctx,approved:true,invoice:invoice()})).rejects.toThrow(/interrupted/);expect(db.writes).toEqual([]);db.runTransaction=transact;await approveInvoice({db,ctx,approved:true,invoice:invoice()});await approveInvoice({db,ctx,approved:true,invoice:invoice()});expect(db.records.get('inventoryItems/flour').currentStock).toBe(6);});
test('recipe approvals are idempotent and reject stale costing or non-food ingredients',async()=>{const db=fakeFirestore(seed());await approveBatch(db);const writes=db.writes.length;expect((await approveBatch(db)).duplicate).toBe(true);expect(db.writes.length).toBe(writes);await expect(recipeCosting({db,ctx,body:{action:'recipe-costing-approve',approved:true,recipeId:'batch',expectedApprovedAt:'',yieldQuantity:6,yieldUnit:'lb',yieldPercent:80,rows:[{inventoryItemId:'flour',batchQuantity:2,batchUnit:'lb'}]}})).rejects.toThrow(/changed/);db.records.set('inventoryItems/flour',{...db.records.get('inventoryItems/flour'),inventorySourceType:'non_food_supply'});await expect(approveBatch(db)).rejects.toThrow(/non-food/);expect(db.writes.length).toBe(writes);});
