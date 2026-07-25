#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [
  {
    name: 'Login remains eagerly imported and is not lazy-loaded',
    pass: () => {
      const app = read('src/App.js');
      return app.includes("import { LoginScreen } from './features/auth';") && !/const\s+LoginScreen\s*=\s*lazyFeature/.test(app) && !/React\.lazy\([^\)]*auth/.test(app);
    }
  },
  {
    name: 'Authenticated feature routes are lazy-loaded behind Suspense',
    pass: () => {
      const app = read('src/App.js');
      return app.includes('const TabInventory = lazyFeature') && app.includes("import('./features/inventory')") && app.includes('<React.Suspense fallback={<RouteLoading />}');
    }
  },
  {
    name: 'Inventory feature is isolated from shared Operations module',
    pass: () => {
      const ops = read('src/features/operations.jsx');
      const inv = read('src/features/inventory.jsx');
      return !ops.includes('const TabInventory =') && !ops.includes('TabInventory, TabRecipes') && inv.includes('const TabInventory =') && inv.includes('export { TabInventory }');
    }
  },
  {
    name: 'App shell does not duplicate inventory/menu listeners while Inventory route is active',
    pass: () => {
      const app = read('src/App.js');
      return app.includes("wantsToday || activeTabState === 'ops' || isGlobalSearchOpen") && !app.includes("['inventory', 'ops'].includes(activeTabState)") && !app.includes("activeTabState === 'inventory' || wantsToday");
    }
  },
  {
    name: 'Inventory heavy datasets are gated by active sub-tab',
    pass: () => {
      const inv = read('src/features/inventory.jsx');
      return inv.includes('const isAiOrderTab = invTab ===') && inv.includes('needsSmartHistory = isInvoiceTab || isAiOrderTab') && inv.includes('enabled: canUseAiOrdering && isAiOrderTab') && inv.includes('enabled: canUseSmartInventory && needsSmartHistory');
    }
  },
  {
    name: 'Vercel Node engine is updated for upcoming platform requirement',
    pass: () => JSON.parse(read('package.json')).engines?.node === '24.x'
  }
];
let failed = false;
for (const check of checks) {
  let ok = false;
  try { ok = Boolean(check.pass()); } catch (_) { ok = false; }
  console.log(`${ok ? 'PASS' : 'FAIL'} ${check.name}`);
  if (!ok) failed = true;
}
process.exit(failed ? 1 : 0);
