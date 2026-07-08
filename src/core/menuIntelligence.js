import { MASTER_ADMIN_EMAIL } from './appCore';

const normalize = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokenize = (value = '') => normalize(value).split(' ').filter(w => w.length > 1);

const EIGHTY_SIX_MENU_ALIASES = {
  burger: ['burger', 'hamburger', 'cheeseburger', 'patty', 'patties', 'pty', 'beef', 'ground', 'gr', 'grnd', 'chuck', '80 20', 'gr pty', 'beef gr pty', 'beef patty'],
  burgers: ['burger', 'hamburger', 'cheeseburger', 'patty', 'patties', 'pty', 'beef', 'ground', 'gr', 'grnd', 'chuck', '80 20', 'gr pty', 'beef gr pty', 'beef patty'],
  hamburger: ['burger', 'hamburger', 'patty', 'patties', 'pty', 'beef', 'ground', 'gr', 'grnd', 'chuck', '80 20', 'gr pty', 'beef gr pty', 'beef patty'],
  cheeseburger: ['burger', 'hamburger', 'cheeseburger', 'patty', 'patties', 'pty', 'beef', 'ground', 'gr', 'grnd', 'cheese'],
  chicken: ['chicken', 'chix', 'ckn', 'breast', 'thigh', 'tender', 'tenders', 'strip', 'strips', 'chkn'],
  wings: ['wing', 'wings', 'jumbo wing', 'chicken wing'],
  fries: ['fries', 'fry', 'potato', 'potatoes', 'french fry', 'ff'],
  pizza: ['pizza', 'dough', 'crust', 'mozzarella', 'moz', 'pepperoni', 'pep', 'sauce'],
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
  const qWords = tokenize(q).filter(w => w.length > 1);
  const cWords = tokenize(candidate).filter(w => w.length > 1);
  score += qWords.filter(w => cWords.some(c => c === w || c.includes(w) || w.includes(c))).length * 15;
  const aliasTokens = aliasTokensFor(q).flatMap(alias => tokenize(alias));
  const aliasHits = aliasTokens.filter(w => w.length > 1 && cWords.some(c => c === w || c.includes(w) || w.includes(c))).length;
  score += aliasHits * 9;
  if (qWords.length && qWords.every(w => cWords.some(c => c === w || c.includes(w) || w.includes(c)))) score += 20;
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
  const itemBlob = normalize([item.name, item.category, item.supplierName, item.vendorName, item.packSize, item.pfgCode, item.code, item.sku].filter(Boolean).join(' '));
  const aliases = aliasTokensFor(itemBlob || itemKey);
  const hits = (menuDependencies || []).filter(dep => {
    if (dep.inventoryItemId && dep.inventoryItemId === item.id) return true;
    const depKey = normalize(dep.inventoryItemName || dep.ingredientName || dep.itemName);
    const menuKey = normalize(dep.menuItemName || dep.recipeName || dep.dishName || dep.name);
    if (itemKey && depKey && (depKey === itemKey || depKey.includes(itemKey) || itemKey.includes(depKey))) return true;
    if (itemBlob && depKey && scoreTextMatch(depKey, itemBlob) >= 55) return true;
    if (itemBlob && menuKey && scoreTextMatch(menuKey, itemBlob) >= 65) return true;
    return aliases.some(alias => alias && depKey && (depKey.includes(alias) || alias.includes(depKey)));
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
  return `No longer available from the menu: ${names}${extra}`;
};


const scoreInventoryItemForSpoken = (item = {}, spoken = '') => {
  const q = normalize(spoken);
  const name = item.name || item.title || '';
  const searchBlob = [
    name,
    item.category,
    item.supplierName,
    item.vendorName,
    item.packSize,
    item.pfgCode,
    item.code,
    item.sku,
    item.notes
  ].filter(Boolean).join(' ');
  let score = scoreTextMatch(searchBlob, q);
  const itemKey = normalize(searchBlob);
  aliasTokensFor(q).forEach(alias => {
    const aliasKey = normalize(alias);
    if (!aliasKey) return;
    if (itemKey.includes(aliasKey) || aliasKey.includes(itemKey)) score += 28;
    const aliasWords = tokenize(aliasKey);
    score += aliasWords.filter(w => w.length > 1 && itemKey.includes(w)).length * 10;
  });
  return score;
};

export const buildEightySixAlertDetails = ({ requestedName = '', inventoryItem = null, menuDependencies = [], matchMethod = '', matchedMenuItemName = '' } = {}) => {
  const inventoryName = String(inventoryItem?.name || requestedName || 'Item').trim();
  const impactText = inventoryItem ? buildMenuImpactText(inventoryItem, menuDependencies) : '';
  const impactedItems = inventoryItem ? getMenuImpactForInventoryItem(inventoryItem, menuDependencies).map(i => i.name).filter(Boolean) : [];
  const matchText = inventoryItem && normalize(inventoryName) !== normalize(requestedName)
    ? `Inventory match: ${inventoryName}${matchMethod === 'menuIntelligence' ? ' (matched through Menu Intelligence)' : ''}.`
    : '';
  const details = [
    matchText,
    impactText,
    matchedMenuItemName ? `Menu phrase matched: ${matchedMenuItemName}.` : ''
  ].filter(Boolean).join('\n');
  return { inventoryName, impactText, impactedItems, matchText, details };
};

export const resolveEightySixInventoryMatch = (spoken = '', inventoryItems = [], menuDependencies = []) => {
  const q = normalize(spoken);
  if (!q) return { item: null, confidence: 0, method: 'empty', requestedName: '' };
  const aliasTokens = aliasTokensFor(q);

  const inventoryMatches = (inventoryItems || []).map(item => ({
    item,
    score: scoreInventoryItemForSpoken(item, q),
    method: 'inventory'
  })).sort((a, b) => b.score - a.score);

  const menuMatches = (menuDependencies || []).map(dep => {
    const menuName = dep.menuItemName || dep.recipeName || dep.dishName || dep.name || '';
    const ingredientName = dep.inventoryItemName || dep.ingredientName || dep.itemName || '';
    const inventoryItem = findInventoryByDependency(dep, inventoryItems);
    const inventoryName = inventoryItem?.name || ingredientName;
    let score = scoreTextMatch(menuName, q) + Math.round(scoreTextMatch(ingredientName, q) * 0.9) + Math.round(scoreInventoryItemForSpoken(inventoryItem || { name: inventoryName }, q) * 0.9);
    if (scoreTextMatch(menuName, q) >= 55 && inventoryItem?.id) score += 30;
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
