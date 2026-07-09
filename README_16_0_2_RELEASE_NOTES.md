# 86 Chaos 16.0.2 Release Notes

## Summary

16.0.2 is a controlled visual design-system upgrade that moves the app toward a premium dark restaurant operations command center while preserving the existing React/Firebase/Vercel behavior and route structure.

## Changed

- Added 16.0.2 global design tokens in `src/core/appCore.js` with a darker deck, glass panels, orange/gold accents, stronger borders, polished buttons, inputs, table headers, and reusable card defaults.
- Upgraded the main app shell in `src/App.js` with scoped command-center CSS variables, legacy color overrides, improved header/date strip/footer styling, better mobile touch targets, and the 16.0.2 version label.
- Kept the 86 Chaos logo mandatory and visible in the header, drawer, login screen, and footer.
- Added optional customer logo support beside the 86 Chaos logo without replacing the 86 Chaos mark.
- Reworked drawer styling into visual groups: Command, Kitchen Ops, Management, and System. Existing menu item IDs, labels, permission checks, and navigation callbacks are preserved.
- Improved shared modal, global search, quick action dock, empty state, and status tile styling.
- Updated the pre-login screen to match the new dark command-center palette without changing Firebase Auth flow.
- Updated the in-app changelog modal to describe the 16.0.2 design-system release.

## Not Changed

- No tabs were removed or renamed.
- No Firebase, Auth, Firestore, Storage, Messaging, or secure fetch behavior was rebuilt.
- No feature screens were replaced with a new app layout.
- No duplicate navigation drawer or competing sidebar was added.
- System Administrator remains available as the `godmode` tab under the System group for super-admin users.

## Notes

This full package uses the 15.0.43 app harness for `api`, `public`, Firebase rules, Storage rules, Vercel config, package metadata, and app assets. The 16.0.2 source overlay is applied to the active app shell and shared source files, with `package.json` and `public/version.json` updated to `16.0.2`.
