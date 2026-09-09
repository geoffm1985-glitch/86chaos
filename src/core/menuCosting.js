import restaurantPackHelpers from './restaurantPack.cjs';
import menuApprovalHelpers from './menuApproval.cjs';

const { parseCasePack, convertQuantity, normalizeUnit, usableYield } = restaurantPackHelpers;
const { isApprovedDependency } = menuApprovalHelpers;
const normalize = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const words = (value = '') => normalize(value).split(' ').filter(Boolean);

export const parseMenuPrice = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const match = String(value).replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : 0;
};

const cleanUnit = (unit = '') => {
  const raw = normalize(unit);
  if (/^(lb|lbs|pound|pounds)$/.test(raw)) return 'lb';
  if (/^(oz|ounce|ounces)$/.test(raw)) return 'oz';
  if (/^(gal|gallon|gallons)$/.test(raw)) return 'gal';
  if (/^(qt|quart|quarts)$/.test(raw)) return 'qt';
  if (/^(slice|slices)$/.test(raw)) return 'each';
  if (/^(ea|each|piece|pieces|pc|pcs|count|ct)$/.test(raw)) return 'each';
  if (/^(cup|cups)$/.test(raw)) return 'cup';
  if (/^(tbsp|tablespoon|tablespoons)$/.test(raw)) return 'tbsp';
  if (/^(tsp|teaspoon|teaspoons)$/.test(raw)) return 'tsp';
  return raw || 'each';
};

const qty = (value, fallback = 0) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

export const getInventoryUnitCost = (item = {}, desiredUnit = '') => {
  const unit = normalizeUnit(cleanUnit(desiredUnit));
  const price = qty(item.price ?? item.latestPrice ?? item.casePrice ?? item.totalPrice ?? item.unitCost, 0);
  const missing = reason => ({ unitCost: 0, basis: reason, packageAmount: 0, packageUnit: '', needsReview: true });
  if (item.inventorySourceType === 'non_food_supply' || /^(supplies|cleaning|paper goods)$/i.test(item.category || '')) return missing('non-food-supply');
  if (price <= 0) return missing('missing-price');
  const stockUnit = normalizeUnit(item.inventoryUnit || item.stockUnit || 'case');
  const yieldFactor = usableYield(1, item.yieldPercent ?? 100);
  if (!yieldFactor) return missing('invalid-yield');
  if (stockUnit !== 'case') {
    const amount = convertQuantity(1, stockUnit, unit);
    if (amount > 0) return { unitCost: price / amount / yieldFactor, basis: `stock-${stockUnit}`, packageAmount: amount, packageUnit: unit };
    return missing('incompatible-stock-unit');
  }
  const pack = parseCasePack(item.packSize || item.size || item.caseSize || item.packageSize || '');
  if (pack.known) {
    const amount = convertQuantity(pack.amount, pack.unit, unit);
    if (amount > 0) return { unitCost: price / amount / yieldFactor, basis: `pack-${pack.amount}-${pack.unit}`, packageAmount: pack.amount, packageUnit: pack.unit };
  }
  const yieldQty = qty(item.yieldQty ?? item.unitsPerCase ?? item.caseUnits, 0);
  if (unit === 'each' && yieldQty > 0) return { unitCost: price / yieldQty / yieldFactor, basis: `yield-${yieldQty}`, packageAmount: yieldQty, packageUnit: 'each' };
  return missing('package-conversion-needs-review');
};

export const getBatchRecipeCost = ({ recipe = {}, inventoryItems = [], menuDependencies = [] } = {}) => {
  if (!recipe.id || !recipe.costingApprovedAt) return { ready: false, reason: 'Approve the batch ingredients and usable yield first.', totalCost: 0, unitCost: 0 };
  const links = menuDependencies.filter(dep => dep.recipeId === recipe.id && dep.source === 'approved_batch_recipe' && (recipe.costingDependencyIds || []).includes(dep.id) && isApprovedDependency(dep));
  const ingredients = links.map(dep => {
    const item = inventoryItems.find(row => row.id === dep.inventoryItemId);
    return estimateIngredientCost({ name: dep.ingredientName, quantity: dep.batchQuantity ?? dep.portionQuantity ?? dep.estimatedQuantity,
      unit: dep.batchUnit || dep.portionUnit || dep.estimatedUnit, portionConfidence: 'approved' }, item || {}, recipe);
  });
  const amount = usableYield(recipe.batchYieldQuantity, recipe.batchYieldPercent ?? 100);
  const unit = normalizeUnit(recipe.batchYieldUnit);
  const totalCost = ingredients.reduce((sum, row) => sum + row.cost, 0);
  const expectedLinks = new Set(recipe.costingDependencyIds || []);
  const ready = links.length > 0 && links.length === expectedLinks.size && amount > 0 && Boolean(unit) && ingredients.every(row => !row.missingCost && row.portionConfidence === 'approved');
  return { ready, totalCost, unitCost: ready ? totalCost / amount : 0, unit, usableYield: amount, ingredients,
    reason: ready ? 'Approved batch ingredients divided by usable yield.' : 'Batch ingredient cost, quantity, or usable yield needs review.' };
};

const DEFAULT_PORTIONS = [
  { test: /burger|patty|beef/, quantity: 6, unit: 'oz' },
  { test: /chicken|tender|breast|fried chicken|grilled chicken/, quantity: 6, unit: 'oz' },
  { test: /fish|cod|haddock|perch|walleye/, quantity: 6, unit: 'oz' },
  { test: /fries|french fry|chips/, quantity: 6, unit: 'oz' },
  { test: /cheese|american|cheddar|swiss|mozzarella|pepper jack/, quantity: 1, unit: 'slice' },
  { test: /bacon/, quantity: 2, unit: 'slice' },
  { test: /bun|roll|tortilla|wrap|bread|toast|hoagie/, quantity: 1, unit: 'each' },
  { test: /ranch|sauce|dressing|mayo|aioli|bbq|barbecue|salsa|sour cream/, quantity: 2, unit: 'oz' },
  { test: /lettuce|tomato|onion|pickle|jalapeno|slaw|coleslaw/, quantity: 1, unit: 'oz' },
  { test: /pepperoni|sausage|ham|turkey|pork/, quantity: 2, unit: 'oz' },
  { test: /box|container|cup|lid|foil|paper|bag/, quantity: 1, unit: 'each' }
];

export const estimateIngredientPortion = (ingredient = {}, menuItem = {}) => {
  const explicitQty = qty(ingredient.estimatedQuantity ?? ingredient.quantity ?? ingredient.portionQuantity ?? ingredient.recipeQuantity, 0);
  const explicitUnit = cleanUnit(ingredient.estimatedUnit || ingredient.unit || ingredient.portionUnit || ingredient.recipeUnit || '');
  if (explicitQty > 0) return { quantity: explicitQty, unit: explicitUnit || 'each', confidence: ingredient.portionConfidence || ingredient.confidence || 'provided' };
  const blob = normalize([ingredient.name, ingredient.ingredientName, ingredient.inventoryItemName, menuItem.name, menuItem.description].filter(Boolean).join(' '));
  const match = DEFAULT_PORTIONS.find(row => row.test.test(blob));
  if (match) return { quantity: match.quantity, unit: match.unit, confidence: 'estimated' };
  return { quantity: 1, unit: 'each', confidence: 'needs-review' };
};

export const estimateIngredientCost = (ingredient = {}, inventoryItem = {}, menuItem = {}) => {
  const portion = estimateIngredientPortion(ingredient, menuItem);
  const costBasis = getInventoryUnitCost(inventoryItem || {}, portion.unit);
  const cost = Math.max(0, portion.quantity * Number(costBasis.unitCost || 0));
  return {
    ingredientName: ingredient.name || ingredient.ingredientName || inventoryItem?.name || 'Ingredient',
    inventoryItemId: inventoryItem?.id || ingredient.matchedInventoryItemId || ingredient.inventoryItemId || '',
    inventoryItemName: inventoryItem?.name || ingredient.matchedInventoryItemName || ingredient.inventoryItemName || '',
    quantity: portion.quantity,
    unit: portion.unit,
    portionConfidence: portion.confidence,
    unitCost: Number(costBasis.unitCost || 0),
    cost,
    basis: costBasis.basis,
    missingCost: !inventoryItem?.id || Number(costBasis.unitCost || 0) <= 0 || costBasis.needsReview === true
  };
};

const inventoryForIngredient = (ingredient = {}, inventoryItems = []) => {
  const id = ingredient.matchedInventoryItemId || ingredient.inventoryItemId || ingredient.itemId || '';
  if (id) {
    const byId = inventoryItems.find(item => item.id === id);
    return byId || null;
  }
  const key = normalize(ingredient.matchedInventoryItemName || ingredient.inventoryItemName || ingredient.name || ingredient.ingredientName || '');
  if (!key) return null;
  return inventoryItems.find(item => {
    const itemKey = normalize([item.name, item.productName, item.itemName, item.pfgCode, item.sku].filter(Boolean).join(' '));
    return itemKey && (itemKey === key || itemKey.includes(key) || key.includes(itemKey));
  }) || null;
};

const groupDependencies = (menuDependencies = []) => {
  const groups = new Map();
  (menuDependencies || []).filter(dep => dep.source !== 'approved_batch_recipe' && isApprovedDependency(dep)).forEach(dep => {
    const name = dep.menuItemName || dep.recipeName || dep.dishName || dep.name || 'Menu item';
    const key = normalize([name, dep.menuCategory || '', dep.menuDescription || ''].join('|')) || name;
    if (!groups.has(key)) groups.set(key, { name, category: dep.menuCategory || '', description: dep.menuDescription || '', price: parseMenuPrice(dep.menuItemPrice ?? dep.price ?? dep.menuPrice), ingredients: [] });
    const group = groups.get(key);
    if (!group.price) group.price = parseMenuPrice(dep.menuItemPrice ?? dep.price ?? dep.menuPrice);
    group.ingredients.push({
      name: dep.ingredientName || dep.inventoryItemName || '',
      batchRecipeId: dep.batchRecipeId || '',
      matchedInventoryItemId: dep.inventoryItemId || '',
      matchedInventoryItemName: dep.inventoryItemName || '',
      estimatedQuantity: dep.estimatedQuantity ?? dep.portionQuantity,
      estimatedUnit: dep.estimatedUnit ?? dep.portionUnit,
      portionConfidence: dep.portionConfidence || dep.confidence || 'reviewed',
      confidence: dep.confidence || 'reviewed'
    });
  });
  return Array.from(groups.values());
};

export const buildMenuCostBreakdowns = ({ menuItems = [], menuDependencies = [], inventoryItems = [], recipes = [] } = {}) => {
  const rows = (menuItems && menuItems.length ? menuItems : groupDependencies(menuDependencies)).map(item => {
    const ingredients = (item.ingredients || []).map(ingredient => {
      if (ingredient.batchRecipeId) {
        const batch = getBatchRecipeCost({ recipe: recipes.find(recipe => recipe.id === ingredient.batchRecipeId) || {}, inventoryItems, menuDependencies });
        const portion = estimateIngredientPortion(ingredient, item);
        const amount = convertQuantity(portion.quantity, portion.unit, batch.unit);
        return { ingredientName: ingredient.name, inventoryItemId: ingredient.batchRecipeId, inventoryItemName: ingredient.name,
          quantity: portion.quantity, unit: portion.unit, portionConfidence: portion.confidence,
          cost: batch.ready && amount !== null ? amount * batch.unitCost : 0, unitCost: batch.unitCost,
          basis: 'approved-batch-yield', missingCost: !batch.ready || amount === null };
      }
      const inventoryItem = inventoryForIngredient(ingredient, inventoryItems);
      return estimateIngredientCost(ingredient, inventoryItem || {}, item);
    });
    const totalCost = ingredients.reduce((sum, row) => sum + row.cost, 0);
    const menuPrice = parseMenuPrice(item.price ?? item.menuItemPrice ?? item.menuPrice ?? item.priceText);
    const missing = ingredients.filter(row => row.missingCost || !row.inventoryItemId);
    const estimated = ingredients.filter(row => /estimated|needs-review/i.test(String(row.portionConfidence || '')));
    const foodCostPct = menuPrice > 0 ? (totalCost / menuPrice) * 100 : 0;
    const confidenceScore = ingredients.length ? Math.max(0, Math.round(((ingredients.length - missing.length) / ingredients.length) * 100) - Math.min(25, estimated.length * 4)) : 0;
    return {
      menuItemName: item.name || item.menuItemName || 'Menu item',
      category: item.category || item.menuCategory || '',
      description: item.description || item.menuDescription || '',
      menuPrice,
      totalCost,
      foodCostPct,
      grossProfit: menuPrice ? menuPrice - totalCost : 0,
      ingredients,
      missingIngredients: missing,
      estimatedIngredients: estimated,
      confidenceScore,
      confidenceLabel: confidenceScore >= 85 ? 'high' : confidenceScore >= 60 ? 'medium' : confidenceScore >= 35 ? 'low' : 'needs review',
      status: missing.length ? 'missing-costs' : menuPrice <= 0 ? 'missing-price' : foodCostPct > 38 ? 'high-food-cost' : 'ready'
    };
  });
  return rows.sort((a, b) => {
    const severity = { 'missing-costs': 4, 'high-food-cost': 3, 'missing-price': 2, ready: 1 };
    return (severity[b.status] || 0) - (severity[a.status] || 0) || b.foodCostPct - a.foodCostPct || a.menuItemName.localeCompare(b.menuItemName);
  });
};

export const summarizeMenuCostBreakdowns = (rows = []) => {
  const priced = rows.filter(row => row.menuPrice > 0 && row.totalCost > 0);
  const averageFoodCostPct = priced.length ? priced.reduce((sum, row) => sum + row.foodCostPct, 0) / priced.length : 0;
  return {
    menuItemCount: rows.length,
    pricedCount: priced.length,
    needsReviewCount: rows.filter(row => row.status !== 'ready').length,
    missingCostCount: rows.reduce((sum, row) => sum + row.missingIngredients.length, 0),
    highFoodCostCount: rows.filter(row => row.status === 'high-food-cost').length,
    averageFoodCostPct
  };
};
