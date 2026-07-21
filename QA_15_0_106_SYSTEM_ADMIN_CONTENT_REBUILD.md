# QA 15.0.106 System Administrator Content Rebuild

## Manual QA
- Open System Administrator on desktop.
- Confirm the top status/header bar is still lean.
- Click every System Administrator section: Overview, Workspaces & Users, Security & Permissions, Deployments & Releases, Backups & Data Safety, Push & Automation, Diagnostics & Support, Platform Tools.
- Confirm each clicked tool page uses dark, readable panels and does not show pale/white unreadable cards.
- Confirm Data Retention Setup legal schedule is readable and compact.
- Confirm the page content is contained in the work area instead of becoming one huge body scroll on desktop.
- Confirm the section map appears under non-overview pages.
- Confirm Branding / Display is not present in System Administrator.
- Confirm Settings still contains Branding / Display for authorized users.

## Regression QA
- Staff accounts must not access System Administrator.
- Owner/manager/staff role gates must remain unchanged.
- Push duplicate fixes from prior versions must remain intact.
- QuickBooks must remain review-first with no auto-posting.

## Suggested Playwright
```powershell
cd C:\Users\geoff\Documents\GitHub\86chaos
npx.cmd playwright test tests/86chaos-deep-suite/01-auth-permission-matrix.spec.js --project=chromium --headed --workers=1
npx.cmd playwright test tests/86chaos-deep-suite/06-mobile-layout.spec.js --project=chromium --headed --workers=1
npx.cmd playwright test tests/86chaos-deep-suite/09-backup-restore-admin-safety.spec.js --project=chromium --headed --workers=1
```
