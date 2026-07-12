const PLAN_IDS = {
  SHIFT: 'shift',
  OPERATIONS: 'operations',
  SMART_KITCHEN: 'smart_kitchen',
  OWNER_PRO: 'owner_pro',
  MASTER_ADMIN: 'master_admin'
};

const FEATURE_KEYS = {
  INVOICE_SCANNING: 'invoice_scanning',
  MENU_SCANNING: 'menu_scanning',
  INTEGRATIONS: 'integrations'
};

const PLAN_ORDER = [PLAN_IDS.SHIFT, PLAN_IDS.OPERATIONS, PLAN_IDS.SMART_KITCHEN, PLAN_IDS.OWNER_PRO, PLAN_IDS.MASTER_ADMIN];

const PLAN_DEFINITIONS = {
  [PLAN_IDS.SHIFT]: { id: PLAN_IDS.SHIFT, label: 'Shift', monthlyPrice: 49, invoicePagesLimit: 0, menuPagesLimit: 0, features: [] },
  [PLAN_IDS.OPERATIONS]: { id: PLAN_IDS.OPERATIONS, label: 'Operations', monthlyPrice: 99, invoicePagesLimit: 20, menuPagesLimit: 3, features: [FEATURE_KEYS.INVOICE_SCANNING, FEATURE_KEYS.MENU_SCANNING] },
  [PLAN_IDS.SMART_KITCHEN]: { id: PLAN_IDS.SMART_KITCHEN, label: 'Smart Kitchen', monthlyPrice: 179, invoicePagesLimit: 75, menuPagesLimit: 10, features: [FEATURE_KEYS.INVOICE_SCANNING, FEATURE_KEYS.MENU_SCANNING] },
  [PLAN_IDS.OWNER_PRO]: { id: PLAN_IDS.OWNER_PRO, label: 'Owner Pro', monthlyPrice: 299, invoicePagesLimit: 200, menuPagesLimit: 25, features: [FEATURE_KEYS.INVOICE_SCANNING, FEATURE_KEYS.MENU_SCANNING] },
  [PLAN_IDS.MASTER_ADMIN]: { id: PLAN_IDS.MASTER_ADMIN, label: 'Master Admin', monthlyPrice: 0, invoicePagesLimit: Number.MAX_SAFE_INTEGER, menuPagesLimit: Number.MAX_SAFE_INTEGER, features: [FEATURE_KEYS.INVOICE_SCANNING, FEATURE_KEYS.MENU_SCANNING, FEATURE_KEYS.INTEGRATIONS] }
};

function clean(value = '') { return String(value == null ? '' : value).trim(); }
function lower(value = '') { return clean(value).toLowerCase(); }
function normalizePlanId(value = '') {
  const key = lower(value).replace(/\s+/g, '_').replace(/-/g, '_');
  if (key === 'starter' || key === 'trial') return PLAN_IDS.SHIFT;
  if (key === 'pro') return PLAN_IDS.OPERATIONS;
  if (key === 'elite' || key === 'smart' || key === 'smartkitchen') return PLAN_IDS.SMART_KITCHEN;
  if (key === 'enterprise' || key === 'ownerpro' || key === 'owner_pro') return PLAN_IDS.OWNER_PRO;
  if (key === 'master' || key === 'master_admin' || key === 'system_admin' || key === 'internal') return PLAN_IDS.MASTER_ADMIN;
  return PLAN_DEFINITIONS[key] ? key : PLAN_IDS.SHIFT;
}
function getPlanDefinition(planId) { return PLAN_DEFINITIONS[normalizePlanId(planId)] || PLAN_DEFINITIONS[PLAN_IDS.SHIFT]; }
function planIsAtLeast(planId, minimumPlanId) { return PLAN_ORDER.indexOf(normalizePlanId(planId)) >= PLAN_ORDER.indexOf(normalizePlanId(minimumPlanId)); }
function toMs(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}
function addDaysIso(value, days) {
  const base = value ? new Date(value) : new Date();
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + Number(days || 0));
  return base.toISOString();
}
function addMonthsIso(value, months) {
  const base = value ? new Date(value) : new Date();
  if (Number.isNaN(base.getTime())) return '';
  base.setMonth(base.getMonth() + Number(months || 0));
  return base.toISOString();
}
function iso(value) {
  if (!value) return '';
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return '';
}
function parseEmailList(value = '') {
  return String(value || '').split(/[\s,;]+/).map(lower).filter(Boolean);
}
function bypassEmails() {
  return Array.from(new Set([
    ...parseEmailList(process.env.AI_SCAN_LIMIT_BYPASS_EMAILS),
    ...parseEmailList(process.env.MASTER_ADMIN_EMAIL),
    ...parseEmailList(process.env.MASTER_ADMIN_EMAILS),
    // Verified owner/testing account used for 86 Chaos preview validation.
    'geoffm1985@gmail.com'
  ]));
}
function isInternalTestingUser(decoded = {}, user = {}) {
  const email = lower(decoded.email || user.email);
  return Boolean(
    decoded.superAdmin === true || decoded.masterAdmin === true || decoded.isMasterAdmin === true || decoded.aiScanLimitBypass === true ||
    user.isSuperAdmin === true || user.masterAdmin === true || user?.systemAccess?.superAdmin === true ||
    (email && decoded.email_verified !== false && bypassEmails().includes(email))
  );
}
function resolveWorkspaceSubscription(workspace = {}, decoded = {}, user = {}) {
  const raw = workspace.subscription || {};
  const isInternal = isInternalTestingUser(decoded, user) || normalizePlanId(raw.planId || workspace.planId || workspace.planType) === PLAN_IDS.MASTER_ADMIN;
  const isFounderBeta = raw.isFounderBeta === true || workspace.isFounderBeta === true || workspace.founderBeta === true || workspace.billingStatus === 'Trial';
  const selectedFutureTier = normalizePlanId(raw.selectedFutureTier || raw.futurePlanId || workspace.selectedFutureTier || workspace.futurePlanId || raw.planId || workspace.planId || workspace.planType || (isFounderBeta ? PLAN_IDS.SMART_KITCHEN : PLAN_IDS.SHIFT));
  const storedPlan = normalizePlanId(raw.planId || workspace.planId || workspace.planType || (isFounderBeta ? selectedFutureTier : PLAN_IDS.SHIFT));
  const betaStartedAt = iso(raw.betaStartedAt || workspace.betaStartedAt);
  const betaEndsAt = iso(raw.betaEndsAt || workspace.betaEndsAt) || (isFounderBeta && betaStartedAt ? addDaysIso(betaStartedAt, 60) : '');
  const betaExtendedUntil = iso(raw.betaExtendedUntil || workspace.betaExtendedUntil);
  const effectiveBetaEnd = betaExtendedUntil || betaEndsAt;
  const betaActive = Boolean(isFounderBeta && effectiveBetaEnd && toMs(effectiveBetaEnd) >= Date.now());
  const rawStatus = raw.status || workspace.subscriptionStatus || '';
  const legacyBillingStatus = workspace.billingStatus || '';
  const status = isInternal
    ? 'internal'
    : (rawStatus ? lower(rawStatus).replace(/\s+/g, '_') : legacyBillingStatus === 'Past Due' ? 'past_due' : legacyBillingStatus === 'Trial' ? 'beta' : betaActive ? 'beta' : 'active');
  const planId = isInternal ? PLAN_IDS.MASTER_ADMIN : (isFounderBeta && betaActive ? normalizePlanId(raw.planId || selectedFutureTier || PLAN_IDS.SMART_KITCHEN) : storedPlan);
  return {
    planId,
    selectedFutureTier,
    status,
    isFounderBeta,
    betaStartedAt,
    betaEndsAt,
    betaExtendedUntil: betaExtendedUntil || null,
    betaActive,
    founderDiscountPercent: Number(raw.founderDiscountPercent ?? workspace.founderDiscountPercent ?? 50),
    founderDiscountEndsAt: iso(raw.founderDiscountEndsAt || workspace.founderDiscountEndsAt) || (!betaActive && isFounderBeta && effectiveBetaEnd ? addMonthsIso(effectiveBetaEnd, 12) : null),
    billingProvider: raw.billingProvider || workspace.billingProvider || 'none',
    integrationsLocked: raw.integrationsLocked !== false
  };
}
function planIncludesFeature(planId, featureKey) {
  const plan = getPlanDefinition(planId);
  return plan.id === PLAN_IDS.MASTER_ADMIN || plan.features.includes(featureKey);
}
function featureForScanType(scanType) {
  const type = lower(scanType);
  if (type === 'invoice') return FEATURE_KEYS.INVOICE_SCANNING;
  if (type === 'menu') return FEATURE_KEYS.MENU_SCANNING;
  return null;
}
function planLimitsForSubscription(subscription = {}) {
  const plan = getPlanDefinition(subscription.planId);
  return {
    invoicePagesLimit: plan.invoicePagesLimit,
    menuPagesLimit: plan.menuPagesLimit
  };
}
function assertPlanAllowsScan({ workspace = {}, decoded = {}, user = {}, scanType = '' }) {
  const subscription = resolveWorkspaceSubscription(workspace, decoded, user);
  const plan = getPlanDefinition(subscription.planId);
  if (plan.id !== PLAN_IDS.MASTER_ADMIN && ['canceled', 'trial_expired'].includes(lower(subscription.status))) {
    const error = new Error('This workspace subscription is not active. Ask the owner to review Plan & Billing.');
    error.statusCode = 402;
    error.code = 'SUBSCRIPTION_NOT_ACTIVE';
    throw error;
  }
  const feature = featureForScanType(scanType);
  if (feature && !planIncludesFeature(plan.id, feature)) {
    const label = scanType === 'menu' ? 'Menu scanning' : 'Invoice scanning';
    const error = new Error(`${label} is not included in the current ${plan.label} plan. Upgrade or ask the System Administrator to enable testing access.`);
    error.statusCode = 403;
    error.code = 'PLAN_FEATURE_LOCKED';
    throw error;
  }
  const limits = planLimitsForSubscription(subscription);
  if (feature && !isInternalTestingUser(decoded, user)) {
    const limit = scanType === 'menu' ? limits.menuPagesLimit : limits.invoicePagesLimit;
    if (Number(limit) <= 0) {
      const label = scanType === 'menu' ? 'Menu scanning' : 'Invoice scanning';
      const error = new Error(`${label} is not included in the current ${plan.label} plan.`);
      error.statusCode = 403;
      error.code = 'PLAN_SCAN_LIMIT_ZERO';
      throw error;
    }
  }
  return { subscription, plan, limits, isInternalTesting: isInternalTestingUser(decoded, user) };
}

module.exports = {
  PLAN_IDS,
  FEATURE_KEYS,
  PLAN_DEFINITIONS,
  normalizePlanId,
  getPlanDefinition,
  planIsAtLeast,
  resolveWorkspaceSubscription,
  planIncludesFeature,
  featureForScanType,
  planLimitsForSubscription,
  isInternalTestingUser,
  assertPlanAllowsScan
};
