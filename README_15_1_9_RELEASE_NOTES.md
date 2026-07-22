# 86 Chaos 15.1.9 Pixel + Production Lock Pass

## Summary
This release tightens the full-app reference redesign against the uploaded mockups and hardens the places that were most likely to feel visual-only.

## What changed
- Locked the desktop shell closer to the 1672px mockup proportions:
  - 188px left rail
  - 64px top command bar
  - tighter content padding
  - denser KPI cards and panel spacing
- Added System Administrator rail swapping:
  - The System Administrator route now shows the internal admin navigation set instead of the normal restaurant navigation.
  - Top workspace selector changes to System Administrator / Super Administrator while on the admin console.
  - Admin rail footer now shows system time and production environment like the mockup.
- Improved visual fidelity for Recipes/Menu Cost:
  - Added image-backed recipe thumbnails cropped from the supplied reference mockup.
  - Added a recipe hero image crop so the selected recipe panel no longer looks like an emoji placeholder.
- Hardened reference panel actions:
  - Panel headers now render JSX actions safely instead of wrapping selects/elements inside buttons.
  - Key Today dashboard panel actions route to real app tabs where possible.
- Preserved the existing app structure:
  - React/Vite/Firebase/Vercel files remain in place.
  - Existing auth, Firestore, Storage, API routes, plan gates, and permission gates were not weakened.

## Known limitations
- This pass improves pixel accuracy substantially, but true pixel-perfect proof still requires browser screenshots compared directly against the uploaded images.
- Full production confidence still requires running the app against the real Firebase/Vercel preview environment.
- Some dashboard actions remain visual dashboard controls unless the underlying old workflow already existed on that route.
