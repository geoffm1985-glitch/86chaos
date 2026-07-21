# 86 Chaos 15.0.104 Release Notes

## Serious App Design System Cleanup

This release keeps the existing React/Firebase/Vercel app structure intact and focuses on making the product feel less like a webpage and more like a serious restaurant operations app.

## What Changed

- Added the `serious-app-system-v104` design-system layer to the main app shell.
- Replaced decorative webpage-style chrome with a calmer operations-console look.
- Flattened the desktop header into a compact command bar.
- Cleaned the desktop left rail so it behaves like a true app sidebar instead of a floating dock.
- Kept mobile navigation as bottom-nav only, but removed the rounded floating website-dock style.
- Reworked drawer menu styling so role/workspace/actions/menu rows no longer use badge/pill/rounded-card backgrounds.
- Reduced glow, gradient, heavy shadow, and stacked-border noise across working screens.
- Standardized panel, input, button, and inventory row styling around a calmer dark operations palette.
- Kept real content panels, real forms, real buttons, permissions, Firebase routes, push duplicate fixes, and existing feature structure intact.

## Preserved

- 15.0.98 push duplicate prevention.
- 15.0.103 navigation chrome purge behavior.
- Desktop left rail only.
- Mobile bottom nav only.
- System Administrator safety gates.
- Help Center safety filtering.
- QuickBooks review-first behavior.

## Test Env

Update Playwright env before testing:

```env
CHAOS_EXPECTED_VERSION=15.0.104
```

## Suggested Tests

```powershell
cd C:\Users\geoff\Documents\GitHub\86chaos
npx.cmd playwright test tests/86chaos-deep-suite/06-mobile-layout.spec.js --project=chromium --headed --workers=1
npx.cmd playwright test tests/86chaos-deep-suite/01-auth-permission-matrix.spec.js --project=chromium --headed --workers=1
```
