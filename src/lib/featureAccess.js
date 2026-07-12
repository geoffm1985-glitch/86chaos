import { PLAN_DEFINITIONS, PLAN_IDS, PLAN_ORDER, FEATURE_MIN_PLAN, FEATURE_LABELS, ROUTE_FEATURES, FINANCIAL_SUBTAB_FEATURES, FOUNDER_DISCOUNT_PERCENT } from '../config/plans';

const clean = (value = '') => String(value == null ? '' : value).trim();
const lower = (value = '') => clean(value).toLowerCase();
const nowMs = () => Date.now();

export const isMasterAdminUser = (user = {}) => Boolean(
  user?.isSuperAdmin === true ||
  user?.systemAccess?.superAdmin === true ||
  user?.masterAdmin === true ||
  lower(user?.accountRole) === 'master_admin' ||
  lower(user?.role) === 'master admin' ||
  lower(user?.role) === 'system administrator'
);

export const normalizePlanId = (value = '') => {
  const key = lower(value).replace(/\s+/g, '_').replace(/-/g, '_');
  if (key === 'starter' || key === 'trial') return PLAN_IDS.SHIFT;
  if (key === 'pro') return PLAN_IDS.OPERATIONS;
  if (key === 'elite' || key === 'smart' || key === 'smartkitchen') return PLAN_IDS.SMART_KITCHEN;
  if (key === 'enterprise' || key === 'ownerpro' || key === 'owner_pro') return PLAN_IDS.OWNER_PRO;
  if (key === 'master' || key === 'master_admin' || key === 'system_admin' || key === 'internal') return PLAN_IDS.MASTER_ADMIN;
  return PLAN_DEFINITIONS[key] ? key : PLAN_IDS.SHIFT;
};

export const isoFromMaybeTimestamp = (value) => {
  if (!value) return '';
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return '';
};

export const addDaysIso = (base, days) => {
  const d = base ? new Date(base) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString();
};

export const addMonthsIso = (base, months) => {
  const d = base ? new Date(base) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + Number(months || 0));
  return d.toISOString();
};

export const resolveSubscription = (workspace = {}, user = {}) => {
  const raw = workspace?.subscription || {};
  const isMaster = isMasterAdminUser(user) || normalizePlanId(raw.planId || workspace?.planId || workspace?.planType) === PLAN_IDS.MASTER_ADMIN;
  const isFounderBeta = raw.isFounderBeta === true || workspace?.isFounderBeta === true || workspace?.founderBeta === true || workspace?.billingStatus === 'Trial';
  const selectedFutureTier = normalizePlanId(raw.selectedFutureTier || raw.futurePlanId || workspace?.selectedFutureTier || workspace?.futurePlanId || raw.planId || workspace?.planId || workspace?.planType || (isFounderBeta ? PLAN_IDS.SMART_KITCHEN : PLAN_IDS.SHIFT));
  const planId = isMaster ? PLAN_IDS.MASTER_ADMIN : normalizePlanId(raw.planId || workspace?.planId || workspace?.planType || (isFounderBeta ? selectedFutureTier : PLAN_IDS.SHIFT));
  const betaStartedAt = isoFromMaybeTimestamp(raw.betaStartedAt || workspace?.betaStartedAt);
  const betaEndsAt = isoFromMaybeTimestamp(raw.betaEndsAt || workspace?.betaEndsAt) || (isFounderBeta && betaStartedAt ? addDaysIso(betaStartedAt, 60) : '');
  const betaExtendedUntil = isoFromMaybeTimestamp(raw.betaExtendedUntil || workspace?.betaExtendedUntil);
  const effectiveBetaEnd = betaExtendedUntil || betaEndsAt;
  const betaActive = Boolean(isFounderBeta && effectiveBetaEnd && new Date(effectiveBetaEnd).getTime() >= nowMs());
  const founderDiscountEndsAt = isoFromMaybeTimestamp(raw.founderDiscountEndsAt || workspace?.founderDiscountEndsAt) || (!betaActive && isFounderBeta && effectiveBetaEnd ? addMonthsIso(effectiveBetaEnd, 12) : '');
  const legacyBillingStatus = workspace?.billingStatus || '';
  const rawStatus = raw.status || workspace?.subscriptionStatus || '';
  const status = isMaster ? 'internal' : (rawStatus ? lower(rawStatus).replace(/\s+/g, '_') : legacyBillingStatus === 'Past Due' ? 'past_due' : legacyBillingStatus === 'Trial' ? 'beta' : betaActive ? 'beta' : 'active');
  const activePlanId = isFounderBeta && betaActive ? normalizePlanId(raw.planId || selectedFutureTier || PLAN_IDS.SMART_KITCHEN) : planId;
  return {
    planId: activePlanId,
    selectedFutureTier,
    status,
    isFounderBeta,
    betaStartedAt,
    betaEndsAt,
    betaExtendedUntil: betaExtendedUntil || null,
    betaActive,
    founderDiscountPercent: Number(raw.founderDiscountPercent ?? workspace?.founderDiscountPercent ?? FOUNDER_DISCOUNT_PERCENT),
    founderDiscountEndsAt: founderDiscountEndsAt || null,
    billingProvider: raw.billingProvider || workspace?.billingProvider || 'none',
    billingNotes: raw.billingNotes || workspace?.billingNotes || '',
    integrationsLocked: raw.integrationsLocked !== false,
    createdAt: isoFromMaybeTimestamp(raw.createdAt) || '',
    updatedAt: isoFromMaybeTimestamp(raw.updatedAt) || ''
  };
};

export const getPlanDefinition = (planId) => PLAN_DEFINITIONS[normalizePlanId(planId)] || PLAN_DEFINITIONS[PLAN_IDS.SHIFT];
export const planIncludesFeature = (planId, featureKey) => getPlanDefinition(planId).features.includes(featureKey);
export const requiredPlanForFeature = (featureKey) => getPlanDefinition(FEATURE_MIN_PLAN[featureKey] || PLAN_IDS.MASTER_ADMIN);
export const featureLabel = (featureKey) => FEATURE_LABELS[featureKey] || clean(featureKey).replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());

export const hasManualFeatureOverride = (workspace = {}, featureKey) => {
  const access = workspace?.featureAccess || workspace?.featureOverrides || {};
  return access?.[featureKey] === true || workspace?.features?.[featureKey] === true;
};

export const roleAllowsFeature = (user = {}, featureKey, workspace = {}) => {
  if (isMasterAdminUser(user)) return true;
  const perms = user?.permissions || {};
  const ownerAdmin = Boolean(user?.isOwner || user?.accountOwner || user?.workspaceOwner || user?.owner || user?.isAdmin);
  const configuredRosterRoles = Array.isArray(workspace?.rosterRoles) ? workspace.rosterRoles : (Array.isArray(workspace?.customRosterRoles) ? workspace.customRosterRoles : []);
  const hasCustomRosterRoles = configuredRosterRoles.length > 0;
  const legacyRoleName = lower(user?.role || user?.position || user?.jobTitle);
  const legacyKitchenFallback = !hasCustomRosterRoles && (legacyRoleName.includes('kitchen') || legacyRoleName.includes('cook') || legacyRoleName.includes('chef') || legacyRoleName.includes('prep'));
  const rolePermissionAllows = Boolean(perms[featureKey] === true || perms.team === true);
  switch (featureKey) {
    case ROUTE_FEATURES.settings:
    case 'basic_permissions': return true;
    case 'help_center':
    case 'mobile_access':
    case 'personal_reminders':
    case 'basic_schedule_view':
    case 'team_messages': return true;
    case 'staff_roster_basic': return true;
    case 'prep_lists':
    case 'recipes_basic': return Boolean(ownerAdmin || perms.prep || perms.team || legacyKitchenFallback);
    case 'basic_inventory':
    case 'burn_log':
    case 'invoice_scanning':
    case 'menu_scanning':
    case 'menu_intelligence':
    case 'dependency_tools': return Boolean(ownerAdmin || perms.inventory || perms.menuIntelligence || perms.team);
    case 'schedule_builder': return Boolean(ownerAdmin || perms.schedule);
    case 'time_clock': return true;
    case 'timesheets':
    case 'labor_command':
    case 'tip_center': return Boolean(ownerAdmin || perms.labor || perms.sales || perms.schedule);
    case 'daily_close':
    case 'sales_breakdown':
    case 'financial_overview':
    case 'prime_cost':
    case 'cogs_center':
    case 'expenses':
    case 'pnl_snapshot':
    case 'budget_targets':
    case 'basic_reports':
    case 'advanced_reports':
    case 'advanced_financial_audit': return Boolean(ownerAdmin || perms.sales || perms.labor || perms.team || perms.wageView || perms.wageEdit);
    case 'integrations': return isMasterAdminUser(user);
    default: return Boolean(ownerAdmin || rolePermissionAllows);
  }
};

export const resolveFeatureAccess = ({ workspace = {}, user = {}, featureKey }) => {
  const subscription = resolveSubscription(workspace, user);
  const master = isMasterAdminUser(user) || subscription.planId === PLAN_IDS.MASTER_ADMIN;
  const integrationsLocked = featureKey === 'integrations' && !master;
  const manualEnabled = hasManualFeatureOverride(workspace, featureKey);
  const planAllowed = master || manualEnabled || (!integrationsLocked && planIncludesFeature(subscription.planId, featureKey));
  const roleAllowed = roleAllowsFeature(user, featureKey, workspace);
  const requiredPlan = requiredPlanForFeature(featureKey);
  return {
    allowed: Boolean(planAllowed && roleAllowed),
    planAllowed,
    roleAllowed,
    manualEnabled,
    master,
    subscription,
    currentPlan: getPlanDefinition(subscription.planId),
    requiredPlan,
    featureKey,
    featureLabel: featureLabel(featureKey),
    reason: integrationsLocked ? 'integrations_locked' : !planAllowed ? 'plan_locked' : !roleAllowed ? 'permission_locked' : 'allowed'
  };
};

export const featureForRoute = (route) => ROUTE_FEATURES[route] || null;
export const featureForFinancialSubtab = (subTab) => FINANCIAL_SUBTAB_FEATURES[subTab] || null;
export const isPlanAtLeast = (planId, minimumPlanId) => PLAN_ORDER.indexOf(normalizePlanId(planId)) >= PLAN_ORDER.indexOf(normalizePlanId(minimumPlanId));

export const formatMoney = (amount) => `$${Number(amount || 0).toFixed(2)}`;
