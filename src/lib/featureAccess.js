import { PLAN_DEFINITIONS, PLAN_IDS, PLAN_ORDER, FEATURE_MIN_PLAN, FEATURE_LABELS, ROUTE_FEATURES, FINANCIAL_SUBTAB_FEATURES, FOUNDER_DISCOUNT_PERCENT, FOUNDER_BETA_DAYS, FOUNDER_BETA_EXTENSION_DAYS } from '../config/plans';

const clean = (value = '') => String(value == null ? '' : value).trim();
const lower = (value = '') => clean(value).toLowerCase();
const nowMs = () => Date.now();

export const isVerifiedPlatformAdminUser = (user = {}) => {
  const serverCheck = user?.serverAdminCheck || user?.platformAdminVerification || {};
  const trustedSource = clean(user?.superAdminAccessSource || serverCheck?.platformAuthority?.source || '');
  return Boolean(
    serverCheck?.superAdmin === true ||
    serverCheck?.platformAuthority?.superAdmin === true ||
    (user?.isSuperAdmin === true && trustedSource && trustedSource !== 'local-profile-hint')
  );
};

export const isMasterAdminUser = (user = {}) => isVerifiedPlatformAdminUser(user);

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

export const hasExplicitSubscription = (workspace = {}) => Boolean(
  workspace?.subscription && typeof workspace.subscription === 'object' && Object.keys(workspace.subscription).length > 0
);

export const hasExplicitModernPlan = (workspace = {}) => {
  const rawPlan = clean(workspace?.planId || workspace?.subscription?.planId || '');
  return [PLAN_IDS.SHIFT, PLAN_IDS.OPERATIONS, PLAN_IDS.SMART_KITCHEN, PLAN_IDS.OWNER_PRO, PLAN_IDS.MASTER_ADMIN].includes(normalizePlanId(rawPlan)) && rawPlan !== '';
};

export const buildDefaultFounderBetaSubscription = (workspace = {}) => {
  const started = isoFromMaybeTimestamp(workspace?.createdAt || workspace?.createdAtBackfilledAt) || new Date().toISOString();
  const futureTier = normalizePlanId(workspace?.subscription?.selectedFutureTier || workspace?.selectedFutureTier || PLAN_IDS.SMART_KITCHEN);
  return {
    planId: futureTier || PLAN_IDS.SMART_KITCHEN,
    selectedFutureTier: futureTier || PLAN_IDS.SMART_KITCHEN,
    status: 'beta',
    isFounderBeta: true,
    betaStartedAt: started,
    betaEndsAt: addDaysIso(started, FOUNDER_BETA_DAYS),
    betaExtendedUntil: null,
    founderDiscountPercent: FOUNDER_DISCOUNT_PERCENT,
    founderDiscountEndsAt: null,
    billingProvider: 'none',
    billingNotes: 'Backfill default: existing workspace treated as Founder Beta Smart Kitchen until manually changed.',
    integrationsLocked: true,
    createdAt: started,
    updatedAt: ''
  };
};

export const betaDaysRemaining = (subscription = {}) => {
  const end = subscription.betaExtendedUntil || subscription.betaEndsAt;
  if (!end || !subscription.isFounderBeta) return null;
  const diff = new Date(end).getTime() - nowMs();
  if (!Number.isFinite(diff)) return null;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
};

export const betaLifecycleFlag = (subscription = {}) => {
  const days = betaDaysRemaining(subscription);
  if (days == null) return '';
  if (days < 0) return 'beta_ended';
  if (days <= 1) return 'beta_ending_1_day';
  if (days <= 7) return 'beta_ending_7_days';
  if (days <= 14) return 'beta_ending_14_days';
  return 'beta_active';
};

export const resolveSubscription = (workspace = {}, user = {}) => {
  const rawStored = workspace?.subscription || {};
  const explicitSubscription = hasExplicitSubscription(workspace);
  const explicitModernPlan = hasExplicitModernPlan(workspace);
  const raw = explicitSubscription ? rawStored : (explicitModernPlan ? rawStored : buildDefaultFounderBetaSubscription(workspace));
  const isMaster = isMasterAdminUser(user) || normalizePlanId(raw.planId || workspace?.planId || workspace?.planType) === PLAN_IDS.MASTER_ADMIN;
  const defaultedFounderBeta = !explicitSubscription && !explicitModernPlan && !isMaster;
  const isFounderBeta = defaultedFounderBeta || raw.isFounderBeta === true || workspace?.isFounderBeta === true || workspace?.founderBeta === true || workspace?.billingStatus === 'Trial';
  const selectedFutureTier = normalizePlanId(raw.selectedFutureTier || raw.futurePlanId || workspace?.selectedFutureTier || workspace?.futurePlanId || raw.planId || workspace?.planId || (isFounderBeta ? PLAN_IDS.SMART_KITCHEN : PLAN_IDS.SHIFT));
  const storedPlanId = normalizePlanId(raw.planId || workspace?.planId || (isFounderBeta ? selectedFutureTier : PLAN_IDS.SHIFT));
  const planId = isMaster ? PLAN_IDS.MASTER_ADMIN : storedPlanId;
  const betaStartedAt = isoFromMaybeTimestamp(raw.betaStartedAt || workspace?.betaStartedAt) || (isFounderBeta ? new Date().toISOString() : '');
  const betaEndsAt = isoFromMaybeTimestamp(raw.betaEndsAt || workspace?.betaEndsAt) || (isFounderBeta && betaStartedAt ? addDaysIso(betaStartedAt, FOUNDER_BETA_DAYS) : '');
  const betaExtendedUntil = isoFromMaybeTimestamp(raw.betaExtendedUntil || workspace?.betaExtendedUntil);
  const effectiveBetaEnd = betaExtendedUntil || betaEndsAt;
  const betaActive = Boolean(isFounderBeta && effectiveBetaEnd && new Date(effectiveBetaEnd).getTime() >= nowMs());
  const founderDiscountEndsAt = isoFromMaybeTimestamp(raw.founderDiscountEndsAt || workspace?.founderDiscountEndsAt) || (!betaActive && isFounderBeta && effectiveBetaEnd ? addMonthsIso(effectiveBetaEnd, 12) : '');
  const legacyBillingStatus = workspace?.billingStatus || '';
  const rawStatus = raw.status || workspace?.subscriptionStatus || '';
  const status = isMaster ? 'internal' : (rawStatus ? lower(rawStatus).replace(/\s+/g, '_') : legacyBillingStatus === 'Past Due' ? 'past_due' : legacyBillingStatus === 'Trial' ? 'beta' : betaActive ? 'beta' : 'active');
  const activePlanId = isFounderBeta && betaActive ? normalizePlanId(raw.planId || selectedFutureTier || PLAN_IDS.SMART_KITCHEN) : planId;
  const subscription = {
    planId: activePlanId,
    selectedFutureTier,
    status,
    isFounderBeta,
    betaStartedAt,
    betaEndsAt,
    betaExtendedUntil: betaExtendedUntil || null,
    betaActive,
    betaDaysRemaining: null,
    betaLifecycleFlag: '',
    founderDiscountPercent: Number(raw.founderDiscountPercent ?? workspace?.founderDiscountPercent ?? FOUNDER_DISCOUNT_PERCENT),
    founderDiscountEndsAt: founderDiscountEndsAt || null,
    billingProvider: raw.billingProvider || workspace?.billingProvider || 'none',
    billingNotes: raw.billingNotes || workspace?.billingNotes || '',
    integrationsLocked: true,
    defaultedFounderBeta: defaultedFounderBeta,
    needsSubscriptionBackfill: defaultedFounderBeta,
    createdAt: isoFromMaybeTimestamp(raw.createdAt) || '',
    updatedAt: isoFromMaybeTimestamp(raw.updatedAt) || ''
  };
  subscription.betaDaysRemaining = betaDaysRemaining(subscription);
  subscription.betaLifecycleFlag = betaLifecycleFlag(subscription);
  return subscription;
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
  const configuredRosterRoles = Array.isArray(workspace?.rosterRoles) ? workspace.rosterRoles : (Array.isArray(workspace?.systemSettings?.rosterRoles) ? workspace.systemSettings.rosterRoles : (Array.isArray(workspace?.customRosterRoles) ? workspace.customRosterRoles : []));
  const hasCustomRosterRoles = configuredRosterRoles.length > 0;
  const legacyRoleName = lower(user?.role || user?.position || user?.jobTitle);
  const legacyKitchenFallback = !hasCustomRosterRoles && (legacyRoleName.includes('kitchen') || legacyRoleName.includes('cook') || legacyRoleName.includes('chef') || legacyRoleName.includes('prep'));
  const rolePermissionAllows = Boolean(perms[featureKey] === true);
  switch (featureKey) {
    case ROUTE_FEATURES.settings:
    case 'basic_permissions': return true;
    case 'help_center':
    case 'mobile_access':
    case 'personal_reminders':
    case 'basic_schedule_view':
    case 'team_messages': return true;
    case 'staff_roster_basic': return true;
    case 'manager_brief': return true;
    case 'kitchen_command': return Boolean(ownerAdmin || perms.ops || perms.events || perms.schedule || perms.team);
    case 'cleaning_routines': return Boolean(ownerAdmin || perms.maintenance || perms.team || perms.ops);
    case 'prep_lists':
    case 'recipes_basic': return Boolean(ownerAdmin || perms.prep || perms.recipes || perms.kitchen || perms.ops || legacyKitchenFallback);
    case 'basic_inventory':
    case 'burn_log':
    case 'invoice_scanning':
    case 'menu_scanning':
    case 'menu_intelligence':
    case 'dependency_tools': return Boolean(ownerAdmin || perms.inventory || perms.inventoryEdit || perms.menuIntelligence || perms.scans || perms.ops);
    case 'ai_order_assistant':
    case 'python_intelligence':
    case 'smart_86_alerts': return Boolean(ownerAdmin || perms.inventory || perms.inventoryEdit || perms.prep || perms.team || perms.ops);
    case 'schedule_builder': return Boolean(ownerAdmin || perms.schedule);
    case 'time_clock': return true;
    case 'basic_dashboard': return true;
    case 'timesheets':
    case 'labor_command':
    case 'tip_center': return Boolean(ownerAdmin || perms.labor || perms.laborRead || perms.sales || perms.salesRead || perms.financialRead || perms.financialEdit || perms.schedule);
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
    case 'advanced_financial_audit': return Boolean(ownerAdmin || perms.sales || perms.salesRead || perms.financialRead || perms.financialEdit || perms.labor || perms.laborRead || perms.wageView || perms.wageEdit);
    case 'back_office_suite':
    case 'back_office_dashboard':
    case 'back_office_deposit_log':
    case 'back_office_documents':
    case 'back_office_approvals':
    case 'back_office_owner_reports':
    case 'quickbooks_integration': return Boolean(ownerAdmin || perms.backOffice || perms.ownerTools || perms.settings || perms.financialEdit);
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


export const hasFeature = (workspace = {}, user = {}, featureKey = '') => resolveFeatureAccess({ workspace, user, featureKey }).allowed;

export const normalizeRouteId = (route = '') => {
  const value = lower(route).replace(/_/g, '-');
  if (value === 'hr') return 'hr-training';
  if (value === 'kitchen') return 'ops';
  return value;
};

export const APP_ROUTE_IDS = Object.freeze([
  'today', 'published', 'schedule', 'events', 'ops', 'financials', 'sales', 'labor',
  'back-office', 'messages', 'prep', 'recipes', 'inventory', 'ai-tools',
  'menu-intelligence', 'reminders', 'team', 'hr-training', 'maintenance',
  'godmode', 'audit', 'help', 'settings'
]);

export const ROUTE_CLIENT_FEATURES = Object.freeze({
  published: 'schedule',
  schedule: 'schedule',
  events: 'events',
  ops: 'ops',
  financials: 'labor',
  sales: 'sales',
  labor: 'labor',
  messages: 'messages',
  prep: 'prep',
  recipes: 'recipes',
  inventory: 'inventory',
  team: 'team',
  'hr-training': 'hr',
  maintenance: 'maintenance'
});

const ROUTE_PERMISSION_ALIASES = Object.freeze({
  schedule: ['schedule'],
  events: ['events', 'schedule', 'team'],
  ops: ['ops'],
  financials: ['sales', 'salesRead', 'labor', 'laborRead', 'financialRead', 'financialEdit', 'wageView', 'wageEdit'],
  sales: ['sales', 'salesRead', 'financialRead', 'financialEdit'],
  labor: ['labor', 'laborRead', 'schedule', 'financialRead', 'financialEdit', 'wageView', 'wageEdit'],
  'back-office': ['backOffice', 'ownerTools', 'settings', 'financialEdit'],
  prep: ['prep', 'ops'],
  recipes: ['prep', 'recipes', 'team'],
  inventory: ['inventory', 'inventoryEdit', 'ops'],
  'ai-tools': ['inventory', 'inventoryEdit', 'prep', 'team', 'ops'],
  'menu-intelligence': ['menuIntelligence', 'inventory', 'inventoryEdit', 'ops'],
  'hr-training': ['hr', 'team'],
  maintenance: ['maintenance', 'team'],
  audit: ['audit', 'settings'],
  settings: ['settings', 'branding']
});

const ROUTE_OWNER_ADMIN_ALLOWED = new Set(['schedule', 'events', 'ops', 'financials', 'sales', 'labor', 'back-office', 'prep', 'recipes', 'inventory', 'ai-tools', 'menu-intelligence', 'hr-training', 'maintenance', 'audit', 'settings']);

export const routePermissionAliases = (route = '') => ROUTE_PERMISSION_ALIASES[normalizeRouteId(route)] || [];

const routeUserIsOwnerAdmin = (user = {}) => Boolean(
  isMasterAdminUser(user) || user?.isOwner === true || user?.accountOwner === true ||
  user?.workspaceOwner === true || user?.owner === true || user?.isAdmin === true
);

const routeUserHasAlias = (user = {}, aliases = []) => {
  const perms = user?.permissions || {};
  return aliases.some(alias => perms?.[alias] === true);
};

const routeClientFeatureEnabled = (clientFeatures = {}, route = '') => {
  const feature = ROUTE_CLIENT_FEATURES[normalizeRouteId(route)];
  return !feature || clientFeatures?.[feature] !== false;
};

export const featureForRoute = (route) => ROUTE_FEATURES[normalizeRouteId(route)] || null;
export const featureForFinancialSubtab = (subTab) => FINANCIAL_SUBTAB_FEATURES[subTab] || null;

export const resolveRouteAccess = ({ route = '', workspace = {}, user = {}, clientFeatures = {}, demoMode = false, serverVerifiedPlatformAdmin = false, platformAdminPending = false } = {}) => {
  const routeId = normalizeRouteId(route);
  const knownRoute = APP_ROUTE_IDS.includes(routeId);
  const featureKey = featureForRoute(routeId);
  const featureAccess = featureKey ? resolveFeatureAccess({ workspace, user, featureKey }) : { allowed: knownRoute, planAllowed: true, roleAllowed: true, reason: knownRoute ? 'no_feature_gate' : 'unknown_route', subscription: resolveSubscription(workspace, user) };
  const aliases = routePermissionAliases(routeId);
  const ownerAdmin = routeUserIsOwnerAdmin(user);
  const aliasAllowed = routeUserHasAlias(user, aliases);
  const clientEnabled = routeClientFeatureEnabled(clientFeatures, routeId);
  const demoDenied = demoMode === true && ['godmode', 'audit', 'back-office', 'ai-tools', 'settings'].includes(routeId);

  if (!knownRoute) {
    return { allowed: false, pending: false, route: routeId, featureKey, requiredPlan: featureAccess.requiredPlan, permissionReason: 'unknown_route', roleReason: 'unknown_route', featureDisabledReason: '', demoModeReason: '', planReason: 'unknown_route', reason: 'unknown_route', subscription: featureAccess.subscription };
  }
  if (routeId === 'godmode') {
    const verified = serverVerifiedPlatformAdmin === true || isVerifiedPlatformAdminUser(user);
    const pending = !verified && (platformAdminPending === true || user?.pendingSystemAdminVerification === true);
    return { allowed: verified, pending, route: routeId, featureKey, requiredPlan: featureAccess.requiredPlan, permissionReason: verified ? 'server_verified_platform_authority' : (pending ? 'pending_secure_verification' : 'platform_authority_required'), roleReason: verified ? 'server_verified_platform_authority' : 'platform_authority_required', featureDisabledReason: '', demoModeReason: demoDenied ? 'demo_mode' : '', planReason: 'internal_platform_tools', reason: verified ? 'allowed' : (pending ? 'pending_secure_verification' : 'platform_authority_required'), subscription: featureAccess.subscription };
  }
  if (demoDenied) {
    return { ...featureAccess, allowed: false, pending: false, route: routeId, featureKey, permissionReason: 'demo_mode', roleReason: 'demo_mode', featureDisabledReason: '', demoModeReason: 'demo_mode', planReason: featureAccess.planAllowed ? 'plan_allowed' : featureAccess.reason, reason: 'demo_mode' };
  }
  if (!clientEnabled) {
    return { ...featureAccess, allowed: false, pending: false, route: routeId, featureKey, permissionReason: 'feature_disabled', roleReason: 'feature_disabled', featureDisabledReason: ROUTE_CLIENT_FEATURES[routeId] || 'feature_disabled', demoModeReason: '', planReason: featureAccess.planAllowed ? 'plan_allowed' : featureAccess.reason, reason: 'feature_disabled' };
  }

  const publicRoleRoute = ['today', 'published', 'messages', 'reminders', 'team', 'help'].includes(routeId);
  const routeRoleAllowed = publicRoleRoute || featureAccess.roleAllowed === true || aliasAllowed || (ownerAdmin && ROUTE_OWNER_ADMIN_ALLOWED.has(routeId));
  const planAllowed = featureAccess.planAllowed !== false;
  const allowed = Boolean(planAllowed && routeRoleAllowed);
  const reason = allowed ? 'allowed' : (!planAllowed ? 'plan_locked' : 'permission_locked');
  return {
    ...featureAccess,
    allowed,
    pending: false,
    route: routeId,
    featureKey,
    routeRoleAllowed,
    permissionAliases: aliases,
    permissionReason: allowed ? (aliasAllowed ? `permission:${aliases.find(alias => user?.permissions?.[alias] === true)}` : (ownerAdmin ? 'owner_or_admin' : 'public_or_feature_role')) : reason,
    roleReason: routeRoleAllowed ? (ownerAdmin ? 'owner_or_admin' : aliasAllowed ? 'permission_alias' : 'feature_role') : 'missing_required_permission',
    featureDisabledReason: '',
    demoModeReason: '',
    planReason: planAllowed ? 'plan_allowed' : 'plan_locked',
    reason
  };
};

export const isPlanAtLeast = (planId, minimumPlanId) => PLAN_ORDER.indexOf(normalizePlanId(planId)) >= PLAN_ORDER.indexOf(normalizePlanId(minimumPlanId));

export const formatMoney = (amount) => `$${Number(amount || 0).toFixed(2)}`;
