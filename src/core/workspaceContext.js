// Account-profile refreshes must not replace the workspace selected by the app.
// This only carries context; Firestore rules and API authorization still decide access.
export function withSelectedWorkspaceContext(profile, workspaceId) {
  if (!profile) return null;
  return { ...profile, restaurantId: String(workspaceId || '').trim() };
}

// Personal preferences belong to the account, not its copied roster membership.
export function resolvePersonalPreferences(accountUser = {}, member = {}) {
  return accountUser.preferences || member.preferences || {};
}

// These panels use the same broad manager access as hasAnyPermission. Additional
// owner aliases or a hydrated grant map do not change that effective access.
// Identity, tenant, role, loss of manager access and staff grants still reset it.
export function operationalReviewBoundary(user) {
  const manager = user?.isSuperAdmin === true || user?.systemAccess?.superAdmin === true ||
    ['isOwner','owner','accountOwner','workspaceOwner','isAdmin'].some(key => user?.[key] === true) ||
    String(user?.accountRole || '').toLowerCase() === 'owner';
  return JSON.stringify([
    user?.restaurantId || '', user?.uid || user?.id || '', user?.role || '',
    Boolean(user?.demoMode || user?.isDemo),
    manager ? 'workspace-manager' : Object.keys(user?.permissions || {}).filter(key => user.permissions[key] === true).sort(),
  ]);
}
