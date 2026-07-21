# 86 Chaos 15.0.105 Release Notes

## System Administrator Console Overhaul

This release reorganizes System Administrator into a leaner, cleaner operations console without changing the app stack, Firebase data model, permissions, routes, or customer-facing tools.

### Changed
- Reorganized System Administrator into clear categories:
  - Overview
  - Workspaces & Users
  - Security & Permissions
  - Deployments & Releases
  - Backups & Data Safety
  - Push & Automation
  - Diagnostics & Support
  - Platform Tools
- Removed **Branding / Display** from System Administrator navigation. Workspace branding/display remains available from normal Settings.
- Renamed **Python Automation Center** to **Automation Center** in the admin UI while keeping the existing safe alert-only automation backend behavior.
- Slimmed the System Administrator status/header area so it is less bulky.
- Fixed the System Administrator command search input so text no longer overlaps the magnifying-glass icon.
- Tightened the left admin navigation and content shell for a slicker desktop console feel.
- Fixed the main drawer menu search input padding so text does not sit on top of the search icon.
- Added safer username truncation in the main drawer so longer signed-in names do not get visually chopped awkwardly.

### Preserved
- Existing React/Firebase/Vercel structure.
- Existing System Administrator controls, except Branding / Display in the admin screen.
- Existing permissions and Super Admin gates.
- Existing push duplicate hotfixes.
- Existing QuickBooks review-first safety.
- Existing app features/routes.

### Notes
- This is a UI/information-architecture cleanup. It does not add live Firebase rule deployment from the app yet.
- Branding/display is intentionally moved out of System Administrator because it belongs in Settings.
