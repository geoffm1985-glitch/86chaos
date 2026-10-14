'use strict';
const ROUTES = Object.freeze([
  { pattern: /^(?:review|open|show)(?: the| my)? (?:food safety|haccp|line checks?|temperature checks?|corrective actions?)(?: audit| review)?$/, label: 'Review food safety', tab: 'prep', focus: 'checks', summary: 'Open recorded checks, corrective actions and manager closure. Review the exact records before saving.' },
  { pattern: /^(?:review|open|show)(?: the| my)? (?:shift changes?|schedule changes?|shift acknowledgments?|published changes?)$/, label: 'Review published shift changes', tab: 'published', subTab: 'my-schedule', summary: 'Open your published versions. Acknowledgment requires your explicit review of the current version.' },
  { pattern: /^(?:review|open|show)(?: the)? (?:invoice discrepancies|invoices?|receiving|purchase reconciliation)$/, label: 'Review receiving and invoices', tab: 'inventory', focus: 'invoices', summary: 'Review products, quantities and costs against delivery evidence before approving an invoice.' },
  { pattern: /^(?:review|open|show)(?: the)? (?:vendor mappings?|learned vendor products?|vendor aliases?)$/, label: 'Review learned vendor products', tab: 'inventory', focus: 'invoices', summary: 'Open learned vendor product mappings for explicit correction or revocation.' },
  { pattern: /^(?:review|open|show)(?: the)? (?:waste|burn log|waste history)$/, label: 'Review waste evidence', tab: 'inventory', focus: 'waste', summary: 'Open waste evidence. Verify the item, quantity and stock unit before a change.' },
  { pattern: /^(?:review|open|show)(?: the)? (?:readiness|manager brief|restaurant readiness|service readiness)$/, label: 'Review restaurant readiness', tab: 'today', summary: 'Open the evidence-backed readiness categories, incomplete sources and reviewed actions.' },
  { pattern: /^(?:review|open|show)(?: the| my)? (?:training|competency|station training|training follow up)$/, label: 'Review operational training', tab: 'hr-training', summary: 'Open role and station training. Checklist completion is separate from manager competency verification.' },
  { pattern: /^(?:review|open|show)(?: the)? (?:pos recovery|integration recovery|pos connection|shift4 connection)$/, label: 'Review POS integration recovery', tab: 'settings', summary: 'Review connection, staged imports and recovery evidence. Reconnection and import require explicit controls.' }
]);
function buildOperationalVoiceReview(raw, canOpen) {
  const text = String(raw || '').toLowerCase().trim().replace(/[?.!]$/g, '').replace(/\s+/g, ' ');
  const route = ROUTES.find(row => row.pattern.test(text));
  if (!route) return null;
  if (!canOpen(route.tab)) return { intent: 'blocked', label: 'Review access unavailable', summary: 'Your current workspace role cannot open that review.', blocked: true, safe: true, needsConfirmation: false };
  const { pattern, ...action } = route;
  return { ...action, intent: 'navigate', safe: true, reviewOnly: true, needsConfirmation: false };
}
function voiceReviewBoundary(user = {}, features = {}) {
  const permissions = Object.entries(user.permissions || {}).sort(([a],[b]) => a.localeCompare(b));
  const flags = Object.entries(features).filter(([,value]) => typeof value === 'boolean').sort(([a],[b]) => a.localeCompare(b));
  return JSON.stringify([user.restaurantId || '', user.authUid || user.uid || user.id || '', Boolean(user.isAdmin), Boolean(user.isOwner || user.accountOwner), permissions, flags]);
}
function voiceReviewIsCurrent(action, boundary, now = Date.now()) {
  return Boolean(action && action.reviewBoundary === boundary && Number.isFinite(action.reviewCreatedAt) && now >= action.reviewCreatedAt && now - action.reviewCreatedAt <= 120000);
}
Object.defineProperty(globalThis,'__86ChaosOperationalVoice',{value:{ ROUTES, buildOperationalVoiceReview, voiceReviewBoundary, voiceReviewIsCurrent },configurable:true,writable:true});
