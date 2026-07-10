# 86 Chaos 16.0.4 Release Notes

## Copper Menu Overlay Cleanup

This release keeps the recovered 16.0.1/16.0.3 feature set and focuses on the menu and theme problems reported after the Codex build.

### Changes

- Restored the copper look across the app theme.
- Removed the bright action color from the shell, menu, buttons, borders, focus states, and command panels.
- Tightened hamburger menu spacing so menu items are closer together and easier to scan.
- Kept the useful organized menu categories: Command, Kitchen Ops, Management, and System.
- Made the hamburger menu a true overlay by locking the page behind it while open.
- Kept System Administrator on the recovered/stable layout instead of the older reverted dashboard-only layout.
- Kept safer 86 Voice behavior: 86/out-of-stock commands require confirmation and never edit inventory stock.
- Kept OpenAI diagnostics explanations and System Administrator search.

### Deploy / publish separately

- Vercel redeploy required.
- Firestore rules unchanged.
- Storage rules unchanged.
- No Firebase rules publish required.
- `OPENAI_API_KEY` is still required only for OpenAI diagnostics explanations.
