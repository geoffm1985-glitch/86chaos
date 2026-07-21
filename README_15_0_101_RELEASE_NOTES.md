# 86 Chaos 15.0.101 Release Notes

## Premium App UI Polish

This release keeps the existing React/Firebase/Vercel app structure intact and focuses on making 86 Chaos feel more like a professional installed restaurant operations app instead of a web page.

### What changed

- Added a calmer premium app shell class across the main app.
- Reworked the desktop header into a compact command bar with the active tool and workspace chip.
- Changed the desktop rail from a floating rounded dock into a cleaner full-height app sidebar.
- Kept mobile on bottom navigation only.
- Reduced heavy glows, stacked borders, and busy shadows across normal work screens.
- Made cards, inputs, buttons, and panels more consistent.
- Toned down the working-screen background so tools are easier to read.
- Improved Inventory count rows with flatter app-style rows, aligned stock/par controls, and calmer below-par states.
- Preserved the 15.0.98 push duplicate fixes and 15.0.100 desktop/mobile nav separation.

### What did not change

- No Firebase project/config changes.
- No Firestore or Storage rules changes.
- No QuickBooks live-posting changes.
- No System Administrator permission changes.
- No app routes or features removed.
- No sideways rebuild.

## Deployment note

After deploy, update local test env to:

```env
CHAOS_EXPECTED_VERSION=15.0.101
```
