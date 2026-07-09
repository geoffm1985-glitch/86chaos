# 86 Chaos 16.0.2 Controlled Design-System Upgrade

Copy the `src` folder into the existing 86 Chaos app repo.

This package keeps the same source shape as the uploaded source-of-truth ZIP:
- `src/App.js` - app shell, routing, global state, read-optimized collection loading
- `src/core/appCore.js` - Firebase setup, theme tokens, helpers, time formatting, shared hooks
- `src/components/common.jsx` - shared UI pieces such as Modal, DrawerMenu, Global Search, Kitchen TV, changelog, and quick actions
- `src/features/auth.jsx` - login and account entry
- `src/features/schedule.jsx` - schedule, event calendar, time off, schedule copilot
- `src/features/operations.jsx` - prep, inventory, recipes, maintenance, ops, today dashboard
- `src/features/management.jsx` - team, messages, settings, audit, labor, help, system administrator

16.0.2 is a controlled visual upgrade, not a sideways rebuild. It updates shared design tokens, the main shell, navigation styling, reusable surfaces, pre-login styling, and mobile touch sizing while preserving existing route IDs, tab names, permission gates, Firebase/Auth/Firestore behavior, and feature components.

The uploaded ZIP does not include `package.json`, `public`, `api`, Firebase rules, Vercel config, or installed dependencies. Build this by copying the updated `src` into the full app repository and updating that repository's hosted `version.json` to `16.0.2`.
