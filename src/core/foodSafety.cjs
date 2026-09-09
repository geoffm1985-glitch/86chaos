'use strict';
const { finiteNumber } = require('./restaurantPack.cjs');
// Existing kitchen defaults are retained. Cooling is a timed process: a single
// temperature cannot certify it; the kitchen configures checkpoints and notes.
const FOOD_SAFETY_CATEGORIES = Object.freeze({
  'Cold Holding (≤ 41°F)': { max: 41 }, 'Hot Holding (≥ 135°F)': { min: 135 },
  'Poultry / Reheat (≥ 165°F)': { min: 165 }, 'Ground Meats (≥ 155°F)': { min: 155 },
  'Whole Meats / Fish (≥ 145°F)': { min: 145 },
  'Cooler temperature': { max: 41 }, 'Freezer temperature': {},
  'Cooling checkpoint': {}, 'Reheating checkpoint': { min: 165 },
  'Equipment temperature': {}, 'Daily food-safety checklist': { checklist: true }, 'Line check': {}
});
function expectation(item = {}) {
  const defaults = FOOD_SAFETY_CATEGORIES[item.category];
  if (!defaults) throw new Error('Choose a supported food-safety log type.');
  const range = { ...defaults };
  for (const key of ['min', 'max']) {
    const value = item[key === 'min' ? 'requiredMin' : 'requiredMax'];
    if (value !== '' && value !== null && value !== undefined) {
      range[key] = finiteNumber(value);
      if (range[key] === null || range[key] < -100 || range[key] > 600) throw new Error('Temperature limits must be between -100°F and 600°F.');
    }
  }
  if (range.min != null && range.max != null && range.min > range.max) throw new Error('Minimum temperature cannot exceed maximum.');
  const hours = finiteNumber(item.requiredEveryHours);
  if (item.requiredEveryHours && (hours === null || hours < 0.25 || hours > 168)) throw new Error('Choose a check interval between 0.25 and 168 hours.');
  return { ...range, requiredEveryHours: hours || 0 };
}
function evaluateFoodSafety(item, input = {}) {
  const range = expectation(item);
  const temp = range.checklist ? null : finiteNumber(input.temp);
  if (!range.checklist && (temp === null || temp < -100 || temp > 600)) throw new Error('Enter a temperature between -100°F and 600°F.');
  if (range.checklist && !['pass', 'attention'].includes(input.checklistResult)) throw new Error('Choose pass or attention for this checklist.');
  const outside = range.checklist ? input.checklistResult === 'attention' : (range.min != null && temp < range.min) || (range.max != null && temp > range.max);
  const unconfigured = !range.checklist && range.min == null && range.max == null;
  const status = outside || unconfigured ? 'Attention' : 'Safe';
  const correctiveAction = String(input.correctiveAction || '').trim().slice(0, 500);
  if (outside && !correctiveAction) throw new Error('Record the corrective action for an out-of-range check.');
  const notes = String(input.notes || '').trim().slice(0, 500);
  if (/cooling/i.test(item.category) && !notes) throw new Error('Include cooling start time and checkpoint details in notes.');
  return { temp, status, result: status === 'Safe' ? 'pass' : 'attention', correctiveAction, notes,
    requiredMin: range.min ?? null, requiredMax: range.max ?? null, managerReviewRequired: status !== 'Safe', reviewedByManager: false };
}
function missedFoodSafetyChecks(items = [], logs = [], now = Date.now()) {
  return items.filter(item => {
    const interval = Number(item.requiredEveryHours || 0);
    if (!(interval > 0)) return false;
    const latest = Math.max(Date.parse(item.lastLoggedAt) || 0, ...logs.filter(log => log.itemId === item.id).map(log => Date.parse(log.timestamp) || 0));
    return now - latest > interval * 3600000;
  });
}
module.exports = { FOOD_SAFETY_CATEGORIES, expectation, evaluateFoodSafety, missedFoodSafetyChecks };
