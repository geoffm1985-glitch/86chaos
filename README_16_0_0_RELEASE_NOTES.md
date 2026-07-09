# 86 Chaos 16.0.0 Release Notes

## Full Command Center UI Redesign

16.0.0 is a major visual/UI release. The app shell has been redesigned to look much closer to the generated 86 Chaos app mockup instead of only changing colors.

### Changed

- Added a persistent desktop left-side navigation rail styled like the generated app mockup.
- Added a redesigned top command bar with current section title, global search action, problem report action, queue badge, and menu button.
- Added a mobile quick-navigation strip for faster tab switching on phones.
- Added a live operational command overview with four high-visibility tiles:
  - 86 Alerts
  - Prep Tasks
  - Next Shift
  - Backup Status
- Wrapped feature content in a darker glass command-center stage so existing tools visually sit inside the new UI frame.
- Restyled cards, panels, drawers, forms, buttons, tables, modals, and scrollbars toward the mockup’s orange/black command-center style.
- Moved the mobile drawer to open from the left so it matches the new navigation model.
- Updated core theme constants for version 16.0.0.
- Updated version metadata, README, release notes, and QA checklist.

### Preserved

- Existing React/Vite/Firebase/Vercel structure.
- Existing features, tabs, permissions, API routes, Firestore rules, and Storage rules.
- Mandatory 86 Chaos branding/logo.
- Optional restaurant/customer logo display beside 86 Chaos branding.

### Deployment notes

- Redeploy on Vercel.
- No Firestore rules publish required.
- No Storage rules publish required.
- No new environment variables required.
