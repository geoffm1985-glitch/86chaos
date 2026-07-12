# 86 Chaos 15.0.58 Changed Files Report

Base source: `86chaos_15_0_57_desktop_ui_refinement_clean_source.zip`

## Source files changed

- `package.json`
  - Updated app version marker to `15.0.58`.
- `functions/package.json`
  - Updated Functions package version marker to `15.0.58`.
- `public/version.json`
  - Updated public version metadata to `15.0.58`.
- `src/core/appCore.js`
  - Updated `CURRENT_VERSION` to `15.0.58`.
- `src/App.js`
  - Hardened app-shell data subscriptions so restricted financial, labor, inventory, Menu Intelligence, COGS, sales, and maintenance listeners are only opened when the current workspace plan and current user permission allow the related feature.
  - Reduced locked-plan and staff-user Firestore reads and permission-denied noise.
- `src/features/management.jsx`
  - Added Administrator Manual article for 15.0.58 website-claim readiness hardening.
  - Added customer-facing Help Center article explaining what 86 Chaos connects, AI-assisted manager review, menu impact setup requirements, operational snapshots, cost visibility, and integrations coming soon.
  - Cleaned active Staff Roster role defaults to avoid preferring a hardcoded restaurant role.
  - Updated Settings default-tab role checks so hardcoded kitchen-role behavior is legacy fallback only when no custom Roster Roles are configured.
- `src/components/DrawerMenu.js`
  - Isolated older drawer kitchen-role access logic as legacy fallback only when no custom Roster Roles are available.
- `src/components/TabSettings.js`
  - Isolated older settings kitchen-role access logic as legacy fallback only when no custom Roster Roles are available.
- `src/components/TabTeam.js`
  - Updated older team component role defaults to use configured Roster Roles first and generic fallback only if empty.
  - Removed hardcoded Bartender-first sorting and special badge styling.
- `src/components/TabMonth.js`
  - Removed hardcoded Bartender-specific schedule color styling.
- `src/features/schedule.jsx`
  - Removed hardcoded Bartender-specific month schedule color styling.
- `README.md`
  - Updated main README to current 15.0.58 scope and deployment notes.

## Documentation changed

- Removed old current-version files from prior release:
  - `README_15_0_57_RELEASE_NOTES.md`
  - `QA_15_0_57_DESKTOP_UI_POLISH.md`
- Added current-version files:
  - `README_15_0_58_RELEASE_NOTES.md`
  - `QA_15_0_58_WEBSITE_CLAIMS.md`
  - `86chaos_15_0_58_changed_files_report.md`
  - `86chaos_15_0_58_deployment_notes.md`
  - `86chaos_15_0_58_build_verification.md`
  - `86chaos_15_0_58_website_claim_readiness_table.md`

## Files intentionally not changed

- `firestore.rules`
  - No new rule changes in this pass. The existing plan-sensitive rules from the 15.0.54+ tier work remain included.
- `storage.rules`
  - No new Storage rule changes in this pass.
- `vercel.json`
  - No Vercel route, function, cron, or environment changes.
- API route behavior
  - No route was removed or renamed. Invoice/menu scan routes and push routes remain intact.

## Preservation note

This was not a feature-removal pass. Existing tabs, workflows, feature gates, reports, admin tools, APIs, rules, documents, and UI sections were preserved.
