# 86 Chaos 14.0.8 Release Notes

## Menu Workspace Switcher

- The side menu signed-in card now shows the active restaurant/workspace under the user name and role.
- If the employee belongs to more than one active restaurant, the restaurant line is tappable and opens the existing workspace switcher.
- The menu closes before the workspace picker opens so the picker is not hidden behind the drawer.
- Single-workspace employees still see their restaurant name, but it is read-only.
- Demo mode does not expose workspace switching from the menu.

## Deployment impact

- No new API routes.
- No new Vercel environment variables.
- No Firestore rule changes required.
- No Storage rule changes required.
