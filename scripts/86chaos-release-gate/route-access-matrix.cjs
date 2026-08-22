const APP_ROUTE_IDS = Object.freeze([
  'today', 'published', 'schedule', 'events', 'ops', 'financials', 'sales', 'labor',
  'back-office', 'messages', 'prep', 'recipes', 'inventory', 'ai-tools',
  'menu-intelligence', 'reminders', 'team', 'hr-training', 'maintenance',
  'godmode', 'audit', 'help', 'settings'
]);

const ROLE_ALLOWED_ROUTES = Object.freeze({
  'system-admin': APP_ROUTE_IDS.slice(),
  owner: APP_ROUTE_IDS.filter(route => route !== 'godmode'),
  manager: APP_ROUTE_IDS.filter(route => route !== 'godmode' && route !== 'audit'),
  staff: ['today', 'published', 'messages', 'reminders', 'team', 'prep', 'recipes', 'hr-training', 'help'],
});

const ROLE_DENIAL_REASONS = Object.freeze({
  'system-admin': {},
  owner: { godmode: 'platform_authority_required' },
  manager: { godmode: 'platform_authority_required', audit: 'owner_or_platform_admin_required' },
  staff: Object.fromEntries(APP_ROUTE_IDS.filter(route => !ROLE_ALLOWED_ROUTES.staff.includes(route)).map(route => [route, route === 'godmode' ? 'platform_authority_required' : 'missing_required_permission'])),
});

function normalizeRouteId(route = '') {
  const value = String(route || '').trim().toLowerCase().replace(/_/g, '-');
  if (value === 'hr') return 'hr-training';
  if (value === 'kitchen') return 'ops';
  return value;
}

function expectedRoutesForRole(role = '') {
  const key = String(role || '').trim().toLowerCase();
  const allowed = new Set(ROLE_ALLOWED_ROUTES[key] || []);
  return APP_ROUTE_IDS.map(route => ({
    route,
    expectedVisible: allowed.has(route),
    directNavigationAllowed: allowed.has(route),
    expectedHidden: !allowed.has(route),
    permissionReason: allowed.has(route) ? 'allowed_by_canonical_route_matrix' : (ROLE_DENIAL_REASONS[key]?.[route] || 'missing_required_permission'),
    planReason: 'workspace_plan_verified_by_release_gate_setup',
  }));
}

module.exports = { APP_ROUTE_IDS, ROLE_ALLOWED_ROUTES, ROLE_DENIAL_REASONS, normalizeRouteId, expectedRoutesForRole };
