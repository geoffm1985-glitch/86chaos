# QA Checklist - 15.0.105 System Administrator Console Overhaul

## Version
- [ ] App footer/header shows 15.0.105 after deploy.
- [ ] `/version.json` reports 15.0.105.

## System Administrator Access
- [ ] Super Admin can open System Administrator.
- [ ] Staff cannot open System Administrator.
- [ ] Non-super-admin direct `?tab=godmode` still shows the generic permission gate.

## System Administrator Layout
- [ ] Header/status bar is lean and not bulky on desktop.
- [ ] Left admin navigation is readable and does not feel like one endless jumbled list.
- [ ] Categories appear in this order: Overview, Workspaces & Users, Security & Permissions, Deployments & Releases, Backups & Data Safety, Push & Automation, Diagnostics & Support, Platform Tools.
- [ ] Branding / Display does not appear in System Administrator navigation.
- [ ] Automation Center appears instead of Python Automation Center.
- [ ] Existing tools still open from their new categories.

## Search / Drawer Fixes
- [ ] System Administrator search text does not overlap the magnifying-glass icon.
- [ ] Main drawer search text does not overlap the magnifying-glass icon.
- [ ] Signed-in username in the drawer truncates cleanly if long.

## Regression
- [ ] Workspaces / Clients opens.
- [ ] People Directory opens.
- [ ] Security Center opens.
- [ ] Deployment Readiness opens.
- [ ] Backup Center & Audit Trail opens.
- [ ] Push Control Center opens.
- [ ] Automation Center opens.
- [ ] Support Diagnostics opens.
- [ ] Training & Administrator Manuals opens.
- [ ] Danger Zone remains separated.
