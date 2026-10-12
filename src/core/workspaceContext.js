// Account-profile refreshes must not replace the workspace selected by the app.
// This only carries context; Firestore rules and API authorization still decide access.
export function withSelectedWorkspaceContext(profile, workspaceId) {
  if (!profile) return null;
  return { ...profile, restaurantId: String(workspaceId || '').trim() };
}

// Permission map ordering and an explicit denied flag do not change access.
// Real account, tenant, role, or granted-permission changes still clear reviews.
export function operationalReviewBoundary(user) {
  return JSON.stringify([
    user?.restaurantId || '', user?.uid || user?.id || '', user?.role || '',
    ['isOwner','owner','accountOwner','workspaceOwner','isAdmin','isSuperAdmin','demoMode','isDemo'].filter(key => Boolean(user?.[key])),
    Object.keys(user?.permissions || {}).filter(key => Boolean(user.permissions[key])).sort(),
  ]);
}
