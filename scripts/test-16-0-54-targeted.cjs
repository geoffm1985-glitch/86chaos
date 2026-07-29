const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
let failures = 0;
const assert = (condition, message) => {
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${message}`);
  } else {
    console.log(`OK ${message}`);
  }
};

const schedule = read('src/features/schedule.jsx');
const intelligence = read('src/features/intelligence.jsx');
const menuCosting = read('src/core/menuCosting.js');
const scanMenu = read('api/scan-menu.js');
const protectedRoot = read('api/_protected-root-admin.js');
const chaosAdmin = read('api/_chaos-admin.js');
const whoami = read('api/whoami.js');
const adminAccess = read('api/admin-access.js');
const deleteUser = read('api/delete-user.js');
const deleteUsersBulk = read('api/delete-users-bulk.js');
const staffMember = read('api/staff-member.js');
const management = read('src/features/management.jsx');
const appCore = read('src/core/appCore.js');
const version = JSON.parse(read('public/version.json'));
const pkg = JSON.parse(read('package.json'));

assert(pkg.version === '16.0.54' && version.version === '16.0.54', 'version metadata was bumped to 16.0.54 for this runtime fix');
assert(appCore.includes("CURRENT_VERSION = '16.0.54'"), 'app core visible/runtime version is 16.0.54');

assert(schedule.includes('localBuilderShiftEchoes') && schedule.includes('savedShiftEchoes'), 'Schedule Builder keeps a local echo of saved shift assignments');
assert(schedule.includes('setLocalBuilderShiftEchoes(prev => mergeVisibleScheduleShifts(prev, savedShiftEchoes))'), 'saved Schedule Builder shifts are merged into the visible grid immediately');
assert(schedule.includes('const existingShift = visibleShifts.find'), 'duplicate prevention checks the same visible shift set shown in the grid');

assert(scanMenu.includes('priceText') && scanMenu.includes('estimatedQuantity') && scanMenu.includes('portionConfidence'), 'menu scan API asks AI for prices and estimated portions');
assert(scanMenu.includes('selling price') || scanMenu.includes('menu price'), 'menu scan prompt explicitly asks for menu prices');
assert(scanMenu.includes('common kitchen portions') || scanMenu.includes('estimated portion'), 'menu scan prompt explicitly asks for portion estimates');

assert(menuCosting.includes('export const buildMenuCostBreakdowns') && menuCosting.includes('export const summarizeMenuCostBreakdowns'), 'menu costing core exports breakdown and summary builders');
assert(menuCosting.includes('parsePackSize') && menuCosting.includes('getInventoryUnitCost'), 'menu costing converts inventory pack/case costs to usable unit costs');
assert(menuCosting.includes('DEFAULT_PORTIONS') && menuCosting.includes('estimatedIngredients'), 'menu costing supplies review-first portion estimates and flags them');

assert(intelligence.includes('Menu Cost Breakdown'), 'Menu Intelligence includes the approved menu cost dashboard');
assert(intelligence.includes('menuItemPrice') && intelligence.includes('estimatedQuantity') && intelligence.includes('estimatedUnit'), 'approved menu links persist price and portion data');
assert(intelligence.includes('buildMenuCostBreakdowns({ menuDependencies, inventoryItems })'), 'approved menu cost dashboard uses current inventory costs and approved menu dependencies');
assert(intelligence.includes('buildMenuCostBreakdowns({ menuItems: source?.menuItems || [], inventoryItems })'), 'review editor previews estimated item cost before approval');

assert(protectedRoot.includes('geoffm1985@gmail.com') && protectedRoot.includes('protectedRootAdminError'), 'protected root administrator email and safe error are centralized server-side');
assert(chaosAdmin.includes('mergeProtectedRootAdminEmails') && whoami.includes('getMasterEmails'), 'server master-admin checks include the protected root email');
assert(adminAccess.includes('isProtectedRootAdminEmail') && adminAccess.includes("action === 'revoke'"), 'admin access revoke route blocks protected root admin revocation');
assert(deleteUser.includes('isProtectedRootAdminEmail') && deleteUser.includes('protectedRootAdminError'), 'single-user deletion route blocks protected root admin deletion');
assert(deleteUsersBulk.includes('protectedRootAdminEmails') && deleteUsersBulk.includes('isProtectedRootAdminEmail'), 'bulk deletion route blocks protected root admin deletion');
assert(staffMember.includes('isProtectedRootAdminEmail') && staffMember.includes('protectedRootAdminError'), 'staff member route blocks protected root admin deactivation/deletion');
assert(management.includes('Protected Root') && management.includes('cannot be revoked from inside 86 Chaos'), 'System Administrator UI labels and blocks protected root admin revocation');
assert(management.includes('cannot be deleted from inside 86 Chaos') && management.includes('cannot be removed from inside 86 Chaos'), 'System Administrator UI blocks protected root admin deletion/removal paths');

if (failures) {
  console.error(`16.0.54 targeted fix test failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log('16.0.54 targeted fix test passed. This checks the schedule assignment echo, menu costing hooks, and protected root admin guardrails only.');
