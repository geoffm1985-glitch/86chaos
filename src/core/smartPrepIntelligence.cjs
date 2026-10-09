'use strict';

const rows = value => Array.isArray(value) ? value : [];
const text = value => String(value == null ? '' : value).trim();
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const dateKey = value => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString().slice(0,10) : String(value || '').slice(0,10); };
const weekday = value => { const date = new Date(`${dateKey(value)}T12:00:00Z`); return Number.isFinite(date.getTime()) ? date.getUTCDay() : null; };

function buildSmartPrepRecommendations(input = {}) {
  const workspaceId = text(input.workspaceId || input.restaurantId);
  const targetDate = input.targetDate || new Date().toISOString().slice(0,10);
  const minimumDays = Math.max(2, Number(input.minimumDays || 3));
  const sales = rows(input.salesHistory).filter(row => !row.restaurantId || !workspaceId || text(row.restaurantId) === workspaceId);
  const recipes = rows(input.recipes).filter(row => !row.restaurantId || !workspaceId || text(row.restaurantId) === workspaceId);
  const inventory = rows(input.inventoryItems).filter(row => !row.restaurantId || !workspaceId || text(row.restaurantId) === workspaceId);
  const prep = rows(input.prepItems).filter(row => !row.restaurantId || !workspaceId || text(row.restaurantId) === workspaceId);
  const waste = rows(input.wasteLogs).filter(row => !row.restaurantId || !workspaceId || text(row.restaurantId) === workspaceId);
  const outages = rows(input.outageEvents || input.eightySixEvents).filter(row => !row.restaurantId || !workspaceId || text(row.restaurantId) === workspaceId);
  const targetWeekday = weekday(targetDate);
  const grouped = new Map();
  for (const row of sales) {
    const itemId = text(row.menuItemId || row.recipeId || row.itemId || row.itemName || row.name);
    if (!itemId) continue;
    const key = dateKey(row.businessDate || row.date || row.createdAt);
    if (!key || key >= targetDate || weekday(key) !== targetWeekday || (new Date(targetDate)-new Date(key))/86400000 > 112) continue;
    if (!grouped.has(itemId)) grouped.set(itemId, new Map());
    const byDate = grouped.get(itemId);
    byDate.set(key, (byDate.get(key) || 0) + number(row.quantity ?? row.qty ?? row.count ?? row.units));
  }
  const recommendations = [];
  const itemIds = new Set([...grouped.keys(), ...recipes.map(row => text(row.id || row.name || row.title)).filter(Boolean)]);
  for (const itemId of itemIds) {
    const history = grouped.get(itemId) || new Map();
    const samples = [...history.entries()].sort(([a],[b]) => a.localeCompare(b));
    const recipe = recipes.find(row => text(row.id || row.name || row.title) === itemId) || {};
    const label = text(recipe.name || recipe.title || sales.find(row => text(row.menuItemId || row.recipeId || row.itemId || row.itemName || row.name) === itemId)?.itemName || itemId);
    const stale=samples.length && (new Date(targetDate)-new Date(samples.at(-1)[0]))/86400000 > 28;
    if (samples.length < minimumDays || stale) {
      recommendations.push({ id:`smart-prep:${itemId}`, workspaceId, itemId, itemName:label, state:'insufficient-data', recommendedQuantity:null, recommendedRange:null, reason:stale ? 'Comparable item sales are more than 28 days old; review recent source history.' : `Only ${samples.length} comparable day${samples.length === 1 ? '' : 's'} are available; ${minimumDays} are required.`, dataWindow:{ comparableDays:samples.length, dates:samples.map(([date]) => date) }, confidence:0, dataQuality:'insufficient', stock86Impact:'unknown', reviewRequired:true, mutationAllowed:false });
      continue;
    }
    const quantities = samples.map(([,quantity]) => quantity).sort((a,b) => a-b);
    const average = quantities.reduce((sum,value) => sum + value, 0) / quantities.length;
    const recent = samples.slice(-3).map(([,quantity]) => quantity);
    const recentAverage = recent.reduce((sum,value) => sum + value, 0) / recent.length;
    const predicted = Math.max(0, Math.round((average * 0.6 + recentAverage * 0.4) * 10) / 10);
    const wasteQty = waste.filter(row => text(row.menuItemId || row.recipeId || row.itemId || row.itemName) === itemId).reduce((sum,row) => sum + number(row.quantity || row.qty), 0);
    const adjustment = Math.min(predicted * 0.2, wasteQty / Math.max(1, samples.length));
    const adjusted = Math.max(0, Math.round((predicted - adjustment) * 10) / 10);
    const linkedInventoryIds = rows(recipe.ingredients).map(row => text(row.inventoryItemId || row.ingredientId)).filter(Boolean);
    const lowStock = inventory.filter(row => linkedInventoryIds.includes(text(row.id)) && number(row.currentStock) <= number(row.parLevel));
    const outageCount = outages.filter(row => text(row.menuItemId || row.recipeId || row.itemId || row.itemName) === itemId).length;
    const currentPrep = prep.filter(row => text(row.menuItemId || row.recipeId || row.itemId || row.itemName) === itemId && dateKey(row.date) === targetDate && row.isCompleted !== true).reduce((sum,row) => sum + number(row.quantity || row.qty), 0);
    const finalQuantity = Math.max(0, Math.round((adjusted - currentPrep) * 10) / 10);
    const spread = Math.max(...quantities) - Math.min(...quantities);
    const confidence = Math.max(0.35, Math.min(0.95, Math.round((0.55 + Math.min(samples.length, 8) * 0.04 - Math.min(0.2, spread / Math.max(1, average) * 0.1)) * 100) / 100));
    recommendations.push({ id:`smart-prep:${itemId}`, workspaceId, itemId, itemName:label, state:finalQuantity === 0 ? 'predicted-zero' : 'recommendation', recommendedQuantity:finalQuantity, recommendedRange:[Math.max(0, Math.floor(finalQuantity * 0.85)), Math.ceil(finalQuantity * 1.15)], reason:finalQuantity === 0 ? 'Comparable demand minus current prep and waste adjustment predicts no additional prep.' : `Comparable ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][targetWeekday]} demand, recent trend, current prep, and recorded waste support this review quantity.`, dataWindow:{ comparableDays:samples.length, start:samples[0][0], end:samples[samples.length - 1][0], dates:samples.map(([date]) => date) }, confidence, dataQuality:outageCount || lowStock.length ? 'qualified' : 'good', stock86Impact:lowStock.length ? `${lowStock.length} linked ingredient${lowStock.length === 1 ? '' : 's'} at/below par; 86 risk review required.` : outageCount ? `${outageCount} prior 86 event${outageCount === 1 ? '' : 's'} in the data window.` : 'No linked low-stock or 86 signal in loaded data.', evidence:{ average, recentAverage, wasteAdjustment:adjustment, currentPrep, outageCount, lowStockIds:lowStock.map(row => row.id) }, reviewRequired:true, mutationAllowed:false });
  }
  return { schemaVersion:1, workspaceId, targetDate, recommendations:recommendations.sort((a,b) => a.itemName.localeCompare(b.itemName)), reviewRequired:true, automaticOrdering:false, automaticInventoryMutation:false };
}

module.exports = { buildSmartPrepRecommendations };
