// Account-profile refreshes must not replace the workspace selected by the app.
// This only carries context; Firestore rules and API authorization still decide access.
export function withSelectedWorkspaceContext(profile, workspaceId) {
  if (!profile) return null;
  return { ...profile, restaurantId: String(workspaceId || '').trim() };
}
