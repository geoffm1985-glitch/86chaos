# 86 Chaos 16.0.2 Deploy Notes

## Package Scope

This is a full project package using the 15.0.43 full app harness plus the 16.0.2 command-center `src` overlay.

Included:
- `api`
- `public`
- `src`
- `firebase.json`
- `firestore.rules`
- `storage.rules`
- `vercel.json`
- `package.json`
- app icon and public assets
- 16.0.2 release notes, QA checklist, changed-file list, and deploy notes

## Version Metadata

- `src/core/appCore.js` uses `CURRENT_VERSION = '16.0.2'`.
- `package.json` uses `"version": "16.0.2"`.
- `public/version.json` uses `"version": "16.0.2"`.

## Deployment

1. Run the production build from this full project.
2. Deploy through the existing Vercel workflow.
3. Keep existing Firebase project configuration, Firestore rules, Storage rules, Vercel routes, cron settings, and environment variables.

## Risk Notes

- The visual upgrade is scoped to shared styling, shell chrome, drawer/menu presentation, reusable controls, and pre-login visuals.
- Existing route IDs, menu labels, permission gates, data hooks, Firebase config, secure fetch logic, API routes, and feature render conditions are preserved.
- The drawer visually groups existing tabs but does not add duplicate menus or move System Administrator into a new route.
- Customer logos are optional and can only appear beside the 86 Chaos logo.
