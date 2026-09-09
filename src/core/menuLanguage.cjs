'use strict';
const normalize = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const EQUIVALENTS = Object.freeze({ burger: ['beef patty'], fries: ['frozen french fries', 'french fries'], wings: ['chicken wings'], ranch: ['house ranch', 'batch ranch'] });
function suggestMenuIngredient(name, inventory = []) {
  const key = normalize(name);
  const products = inventory.filter(item => item.inventorySourceType !== 'non_food_supply' && !/suppl|cleaning|paper goods/i.test(item.category || ''));
  const exact = products.filter(item => normalize(item.name) === key || (Array.isArray(item.aliases) && item.aliases.some(alias => normalize(alias) === key)));
  if (exact.length === 1) return { ...exact[0], matchConfidence: 'high', explanation: 'Matched by the restaurant product name or a restaurant-approved alias. Review the portion before approval.' };
  if (exact.length > 1) return { matchConfidence: 'needs review', explanation: 'Needs Review because more than one restaurant item uses this name or alias.' };
  const phrases = EQUIVALENTS[key] || [];
  const candidates = products.filter(item => phrases.some(phrase => normalize(item.name) === phrase) || (key.length > 3 && normalize(item.name).endsWith(` ${key}`)));
  if (candidates.length === 1) return { ...candidates[0], matchConfidence: 'medium', explanation: 'Suggested by common restaurant wording. Confirm this restaurant uses that ingredient.' };
  return { matchConfidence: candidates.length > 1 ? 'needs review' : 'low', explanation: candidates.length > 1 ? 'Needs Review because several products could fit this menu ingredient.' : 'Needs Review: choose the restaurant ingredient or approved batch recipe.' };
}
module.exports = { suggestMenuIngredient };
