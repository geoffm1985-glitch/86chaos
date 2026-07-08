import { MASTER_ADMIN_EMAIL } from './appCore';

const normalize = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const canUseMenuIntelligence = (user = {}, clientData = {}) => {
  const email = String(user?.email || '').toLowerCase().trim();
  const ownerEmail = String(clientData?.ownerEmail || '').toLowerCase().trim();
  const access = clientData?.systemSettings?.menuIntelligenceAccess || [];
  const accessEmails = clientData?.systemSettings?.menuIntelligenceAccessEmails || [];
  return Boolean(
    user?.isSuperAdmin === true ||
    email === MASTER_ADMIN_EMAIL.toLowerCase() ||
    user?.isOwner === true ||
    user?.accountOwner === true ||
    user?.owner === true ||
    user?.workspaceOwner === true ||
    (ownerEmail && email === ownerEmail) ||
    user?.permissions?.menuIntelligence === true ||
    access.includes(user?.id) ||
    accessEmails.map(v => String(v || '').toLowerCase().trim()).includes(email)
  );
};

export const getMenuImpactForInventoryItem = (item = {}, menuDependencies = []) => {
  const itemKey = normalize(item.name);
  const hits = (menuDependencies || []).filter(dep => {
    if (dep.inventoryItemId && dep.inventoryItemId === item.id) return true;
    const depKey = normalize(dep.inventoryItemName || dep.ingredientName || dep.itemName);
    return itemKey && depKey && (depKey === itemKey || depKey.includes(itemKey) || itemKey.includes(depKey));
  });
  const byName = new Map();
  hits.forEach(dep => {
    const name = dep.menuItemName || dep.recipeName || dep.dishName || dep.name || 'Menu item';
    const key = normalize(name);
    if (!key) return;
    byName.set(key, {
      name,
      category: dep.menuCategory || dep.category || '',
      confidence: dep.confidence || dep.matchConfidence || '',
      dependencyId: dep.id || ''
    });
  });
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const getZeroStockMenuImpacts = (inventoryItems = [], menuDependencies = []) => (inventoryItems || [])
  .filter(item => Number(item.currentStock || 0) <= 0)
  .map(item => ({ item, impacts: getMenuImpactForInventoryItem(item, menuDependencies) }))
  .filter(row => row.impacts.length > 0);

export const buildMenuImpactText = (item = {}, menuDependencies = []) => {
  const impacts = getMenuImpactForInventoryItem(item, menuDependencies);
  if (!impacts.length) return '';
  const names = impacts.slice(0, 4).map(i => i.name).join(', ');
  const extra = impacts.length > 4 ? ` and ${impacts.length - 4} more` : '';
  return `Menu impact: ${names}${extra}`;
};
