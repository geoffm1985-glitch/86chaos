import foodSafety from '../src/core/foodSafety.js';
import menuApproval from '../src/core/menuApproval.js';
import restaurantPack from '../src/core/restaurantPack.js';
import vendorProductMemory from '../src/core/vendorProductMemory.js';
import posNormalization from '../src/core/posNormalization.js';
import labelPresets from '../src/core/labelPresets.js';
import { buildMenuCostBreakdowns } from '../src/core/menuCosting';

// Exercise the emitted production modules, not Node/Jest's CommonJS loader.
export function verifyRestaurantBrowserRuntime() {
  const row = { itemName: 'Chicken Wings', productCode: 'CK522', quantity: 1, uom: 'CS', packSize: '4/10 LB', unitPrice: 120 };
  const inventory = { id: 'wings', restaurantId: 'test', supplierId: 'vendor', name: 'Chicken Wings', pfgCode: 'CK522', price: 120, packSize: '4/10 LB' };
  const costs = buildMenuCostBreakdowns({ inventoryItems: [inventory], menuDependencies: [
    { id: 'approved', menuItemName: 'Wings', inventoryItemId: 'wings', estimatedQuantity: 8, estimatedUnit: 'oz', status: 'approved' },
    { id: 'unapproved', menuItemName: 'Not approved', inventoryItemId: 'wings', status: 'needs-review' }
  ] });
  return {
    packageAmount: restaurantPack.parseCasePack('4/10 LB').amount,
    received: restaurantPack.resolveInvoiceQuantity(row, inventory).stockQuantity,
    matchedItem: vendorProductMemory.suggestInvoiceMatch(row, [inventory], [], { restaurantId: 'test', vendorId: 'vendor' }).matchedItemId,
    approved: menuApproval.isApprovedDependency({ status: 'approved' }),
    menuCount: costs.length, menuCost: costs[0].totalCost,
    missedChecks: foodSafety.missedFoodSafetyChecks([{ id: 'cooler', requiredEveryHours: 2 }], [], Date.parse('2026-09-09')).length,
    temperatureResult: foodSafety.evaluateFoodSafety({ category: 'Cooler temperature' }, { temp: 38 }).result,
    posRows: posNormalization.parsePosCsv('date,netSales\n2026-09-09,100').rows.length,
    labelWidth: labelPresets.LABEL_PRESETS[labelPresets.normalizeLabelSettings({}).preset].width
  };
}
