import { MASTER_ADMIN_EMAIL } from './appCore';

const normalize = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokenize = (value = '') => normalize(value).split(' ').filter(w => w.length > 1);

const EIGHTY_SIX_MENU_ALIASES = {
  burger: ['burger', 'hamburger', 'patty', 'pty', 'beef', 'ground', 'gr', 'grnd', 'chuck', '80 20'],
  burgers: ['burger', 'hamburger', 'patty', 'pty', 'beef', 'ground', 'gr', 'grnd', 'chuck', '80 20'],
  cheeseburger: ['burger', 'hamburger', 'patty', 'pty', 'beef', 'ground', 'gr', 'grnd', 'cheese'],
  chicken: ['chicken', 'chix', 'ckn', 'breast', 'thigh', 'tender', 'strip'],
  wings: ['wing', 'wings', 'jumbo wing', 'chicken wing'],
  fries: ['fries', 'fry', 'potato', 'french fry'],
  pizza: ['pizza', 'dough', 'crust', 'mozzarella', 'pepperoni', 'sauce'],
  fish: ['fish', 'cod', 'haddock', 'walleye', 'perch', 'tilapia'],
  steak: ['steak', 'sirloin', 'ribeye', 'beef'],
  bacon: ['bacon'],
  lettuce: ['lettuce', 'romaine', 'iceberg'],
  tomato: ['tomato', 'tomatoes'],
  onion: ['onion', 'onions'],
  tortilla: ['tortilla', 'wrap', 'shell'],
  chips: ['chips', 'tortilla chips'],
  salsa: ['salsa'],
  sourcream: ['sour cream', 'sourcream'],
  olive: ['olive', 'olives'],
};

const aliasTokensFor = (spoken = '') => {
  const q = normalize(spoken);
  const direct = EIGHTY_SIX_MENU_ALIASES[q.replace(/\s+/g, '')] || EIGHTY_SIX_MENU_ALIASES[q] || [];
  const fromWords = tokenize(q).flatMap(word => EIGHTY_SIX_MENU_ALIASES[word] || []);
  return Array.from(new Set([...direct, ...fromWords].map(normalize).filter(Boolean)));
};

const scoreTextMatch = (candidateText = '', spoken = '') => {
  const candidate = normalize(candidateText);
  const q = normalize(spoken);
  if (!candidate || !q) return 0;
  let score = 0;
  if (candidate === q) score += 100;
  if (candidate.includes(q) || q.includes(candidate)) score += 55;
  const qWords = tokenize(q).filter(w => w.length > 2);
  const cWords = tokenize(candidate).filter(w => w.length > 2);
  score += qWords.filter(w => cWords.some(c => c.includes(w) || w.includes(c))).length * 15;
  return score;
};

const findInventoryByDependency = (dep = {}, inventoryItems = []) => {
  if (dep.inventoryItemId) {
    const byId = inventoryItems.find(item => item.id === dep.inventoryItemId);
    if (byId) return byId;
  }
  const depName = dep.inventoryItemName || dep.ingredientName || dep.itemName || '';
  const depKey = normalize(depName);
  if (!depKey) return null;
  return inventoryItems.find(item => {
    const itemKey = normalize(item.name || item.title || '');
    return itemKey && (itemKey === depKey || itemKey.includes(depKey) || depKey.includes(itemKey));
  }) || null;
};

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
  const names = impacts.slice(0, 6).map(i => i.name).join(', ');
  const extra = impacts.length > 6 ? ` and ${impacts.length - 6} more` : '';
  return `Unavailable menu items: ${names}${extra}`;
};

export const resolveEightySixInventoryMatch = (spoken = '', inventoryItems = [], menuDependencies = []) => {
  const q = normalize(spoken);
  if (!q) return { item: null, confidence: 0, method: 'empty', requestedName: '' };
  const aliasTokens = aliasTokensFor(q);

  const inventoryMatches = (inventoryItems || []).map(item => {
    const name = item.name || item.title || '';
    let score = scoreTextMatch(name, q);
    const itemKey = normalize(name);
    aliasTokens.forEach(alias => {
      if (itemKey.includes(alias) || alias.includes(itemKey)) score += 28;
      const aliasWords = tokenize(alias).filter(w => w.length > 2);
      score += aliasWords.filter(w => itemKey.includes(w)).length * 10;
    });
    return { item, score, method: 'inventory' };
  }).sort((a, b) => b.score - a.score);

  const menuMatches = (menuDependencies || []).map(dep => {
    const menuName = dep.menuItemName || dep.recipeName || dep.dishName || dep.name || '';
    const ingredientName = dep.inventoryItemName || dep.ingredientName || dep.itemName || '';
    const inventoryItem = findInventoryByDependency(dep, inventoryItems);
    const inventoryName = inventoryItem?.name || ingredientName;
    let score = scoreTextMatch(menuName, q) + Math.round(scoreTextMatch(ingredientName, q) * 0.9) + Math.round(scoreTextMatch(inventoryName, q) * 0.9);
    const menuKey = normalize(menuName);
    const ingredientKey = normalize(`${ingredientName} ${inventoryName}`);
    aliasTokens.forEach(alias => {
      if (menuKey.includes(alias)) score += 10;
      if (ingredientKey.includes(alias)) score += 26;
      const aliasWords = tokenize(alias).filter(w => w.length > 2);
      score += aliasWords.filter(w => ingredientKey.includes(w)).length * 9;
    });
    if (inventoryItem?.id) score += 8;
    return { item: inventoryItem, score, method: 'menuIntelligence', dep, menuName, ingredientName };
  }).filter(row => row.item).sort((a, b) => b.score - a.score);

  const bestInventory = inventoryMatches[0] || { score: 0 };
  const bestMenu = menuMatches[0] || { score: 0 };
  const best = bestMenu.score > bestInventory.score ? bestMenu : bestInventory;
  if (!best?.item || best.score <= 0) return { item: null, confidence: 0, method: 'none', requestedName: spoken };
  return {
    item: best.item,
    confidence: best.score,
    method: best.method,
    requestedName: spoken,
    matchedMenuItemName: best.menuName || '',
    matchedIngredientName: best.ingredientName || best.item?.name || ''
  };
};
