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

const singularizeKitchenToken = (value = '') => String(value || '')
  .replace(/\b([a-z]{4,})ies\b/g, '$1y')
  .replace(/\b([a-z]{4,})es\b/g, '$1')
  .replace(/\b([a-z]{4,})s\b/g, '$1')
  .trim();

const expandProductAliases = (value = '') => {
  const base = normalize(value);
  if (!base) return [];
  const out = new Set([base, singularizeKitchenToken(base)]);
  const directAliases = EIGHTY_SIX_MENU_ALIASES[base.replace(/\s+/g, '')] || EIGHTY_SIX_MENU_ALIASES[base] || [];
  directAliases.forEach(alias => {
    const key = normalize(alias);
    if (key) { out.add(key); out.add(singularizeKitchenToken(key)); }
  });
  tokenize(base).forEach(word => {
    const singular = singularizeKitchenToken(word);
    if (singular) out.add(singular);
    (EIGHTY_SIX_MENU_ALIASES[word] || EIGHTY_SIX_MENU_ALIASES[singular] || []).forEach(alias => {
      const key = normalize(alias);
      if (key) { out.add(key); out.add(singularizeKitchenToken(key)); }
    });
  });
  return Array.from(out).filter(Boolean);
};

const aliasTokensFor = (spoken = '') => expandProductAliases(spoken);

const scoreTextMatch = (candidateText = '', spoken = '') => {
  const candidate = normalize(candidateText);
  const q = normalize(spoken);
  if (!candidate || !q) return 0;
  let score = 0;
  const qOptions = expandProductAliases(q);
  const candidateOptions = expandProductAliases(candidate);
  const qWords = Array.from(new Set(qOptions.flatMap(option => tokenize(option).map(singularizeKitchenToken)).filter(w => w.length > 1)));
  const cWords = Array.from(new Set(candidateOptions.flatMap(option => tokenize(option).map(singularizeKitchenToken)).filter(w => w.length > 1)));
  qOptions.forEach(qOption => {
    candidateOptions.forEach(candidateOption => {
      if (!qOption || !candidateOption) return;
      if (candidateOption === qOption) score = Math.max(score, 140);
      if (candidateOption.includes(qOption) || qOption.includes(candidateOption)) score = Math.max(score, 88);
    });
  });
  const exactHits = qWords.filter(w => cWords.includes(w)).length;
  const partialHits = qWords.filter(w => !cWords.includes(w) && cWords.some(c => c.includes(w) || w.includes(c))).length;
  score += exactHits * 22;
  score += partialHits * 12;
  if (qWords.length && exactHits === qWords.length) score += 42;
  if (cWords.length && exactHits === cWords.length) score += 14;
  return Math.round(score);
};

const getInventoryVoiceAliases = (item = {}) => [
  item.name,
  item.title,
  item.itemName,
  item.productName,
  item.displayName,
  item.category,
  item.subcategory,
  item.supplierName,
  item.vendorName,
  item.brand,
  item.manufacturer,
  item.packSize,
  item.size,
  item.pfgCode,
  item.vendorItemNumber,
  item.vendorCode,
  item.code,
  item.sku,
  item.upc,
  item.gtin,
  item.barcode,
  item.notes,
  ...(Array.isArray(item.aliases) ? item.aliases : []),
  ...(Array.isArray(item.alternateNames) ? item.alternateNames : []),
  ...(Array.isArray(item.keywords) ? item.keywords : [])
].filter(Boolean);

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
    (MASTER_ADMIN_EMAIL && email === MASTER_ADMIN_EMAIL.toLowerCase()) ||
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
  const searchBlob = getInventoryVoiceAliases(item).join(' ');
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



const serializeEightySixCandidate = (row = {}) => ({
  item: row.item || null,
  confidence: Number(row.score || 0),
  method: row.method || 'inventory',
  matchedMenuItemName: row.menuName || '',
  matchedIngredientName: row.ingredientName || row.item?.name || ''
});

export const resolveStrictEightySixMatch = (spoken = '', inventoryItems = [], menuDependencies = []) => {
  const q = normalize(spoken);
  if (!q) return { status: 'review', item: null, confidence: 0, method: 'empty', requestedName: '', candidates: [] };
  const aliasTokens = aliasTokensFor(q);
  const rankedByItem = new Map();

  const keepBest = (row) => {
    if (!row?.item) return;
    const key = row.item.id || normalize(row.item.name || row.item.title || '');
    if (!key) return;
    const current = rankedByItem.get(key);
    if (!current || Number(row.score || 0) > Number(current.score || 0)) rankedByItem.set(key, row);
  };

  const qAliases = expandProductAliases(q);
  const inventoryEvidence = (inventoryItems || []).map(item => {
    const aliases = getInventoryVoiceAliases(item).flatMap(expandProductAliases);
    const aliasBlob = aliases.join(' ');
    const aliasWords = new Set(tokenize(aliasBlob).map(singularizeKitchenToken).filter(w => w.length > 1));
    let score = scoreInventoryItemForSpoken(item, q);
    const exactAlias = aliases.some(alias => qAliases.includes(alias));
    const tokenExact = qAliases.some(alias => tokenize(alias).map(singularizeKitchenToken).filter(Boolean).every(word => aliasWords.has(word)));
    if (exactAlias) score += 260;
    else if (tokenExact) score += 86;
    return { item, score, method: 'inventory', exact: exactAlias, tokenExact };
  });
  inventoryEvidence.forEach(keepBest);

  (menuDependencies || []).forEach(dep => {
    const menuName = dep.menuItemName || dep.recipeName || dep.dishName || dep.name || '';
    const ingredientName = dep.inventoryItemName || dep.ingredientName || dep.itemName || '';
    const inventoryItem = findInventoryByDependency(dep, inventoryItems);
    if (!inventoryItem) return;
    const menuScore = scoreTextMatch(menuName, q);
    const ingredientScore = scoreTextMatch(ingredientName, q);
    let score = menuScore + Math.round(ingredientScore * 0.9) + Math.round(scoreInventoryItemForSpoken(inventoryItem, q) * 0.9);
    if (normalize(menuName) === q) score += 220;
    if (normalize(ingredientName) === q) score += 200;
    if (menuScore >= 55) score += 30;
    const menuKey = normalize(menuName);
    const ingredientKey = normalize(`${ingredientName} ${inventoryItem.name || ''}`);
    aliasTokens.forEach(alias => {
      if (menuKey.includes(alias)) score += 10;
      if (ingredientKey.includes(alias)) score += 26;
      score += tokenize(alias).filter(w => w.length > 2 && ingredientKey.includes(w)).length * 9;
    });
    score += 8;
    keepBest({
      item: inventoryItem,
      score,
      method: 'menuIntelligence',
      dep,
      menuName,
      ingredientName,
      exact: normalize(menuName) === q || normalize(ingredientName) === q || normalize(inventoryItem.name || '') === q
    });
  });

  const ranked = Array.from(rankedByItem.values()).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const best = ranked[0];
  const second = ranked[1];
  const exactRows = ranked.filter(row => row.exact === true);
  const margin = Number(best?.score || 0) - Number(second?.score || 0);
  const uniquelyExact = exactRows.length === 1 && exactRows[0]?.item?.id === best?.item?.id;
  const bestDirectScore = Math.max(0, ...inventoryEvidence.map(row => Number(row.score || 0)));
  const plausibleDirectMatches = inventoryEvidence.filter(row => Number(row.score || 0) >= 70 && Number(row.score || 0) >= bestDirectScore - 30);
  const exactOrTokenRows = inventoryEvidence.filter(row => row.exact === true || row.tokenExact === true);
  const hasExactInventoryName = inventoryEvidence.some(row => row.exact === true);
  const broadInventoryAmbiguity = !hasExactInventoryName && plausibleDirectMatches.length > 1 && !(exactOrTokenRows.length === 1 && exactOrTokenRows[0]?.item?.id === best?.item?.id);
  const veryStrong = Number(best?.score || 0) >= 185 && (ranked.length === 1 || margin >= 35);
  const uniqueInventoryProduct = best?.method === 'inventory' && Number(best?.score || 0) >= 84 && (!second || margin >= 24) && plausibleDirectMatches.length <= 1;
  const uniqueInventoryToken = best?.method === 'inventory' && exactOrTokenRows.length === 1 && exactOrTokenRows[0]?.item?.id === best?.item?.id && (!second || margin >= 12);
  const strong = Boolean(best?.item && !broadInventoryAmbiguity && (uniquelyExact || veryStrong || uniqueInventoryProduct || uniqueInventoryToken));
  const candidates = ranked
    .filter(row => Number(row.score || 0) >= 38)
    .slice(0, 5)
    .map(serializeEightySixCandidate);

  if (!strong) {
    return {
      status: 'review',
      item: null,
      confidence: Number(best?.score || 0),
      method: best?.method || 'none',
      requestedName: spoken,
      candidates,
      ambiguityMargin: margin,
      matchedMenuItemName: best?.menuName || '',
      matchedIngredientName: best?.ingredientName || ''
    };
  }

  return {
    status: 'strong',
    item: best.item,
    confidence: Number(best.score || 0),
    method: best.method,
    requestedName: spoken,
    candidates: [serializeEightySixCandidate(best)],
    ambiguityMargin: margin,
    matchedMenuItemName: best.menuName || '',
    matchedIngredientName: best.ingredientName || best.item?.name || ''
  };
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
