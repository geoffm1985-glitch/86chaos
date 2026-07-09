# 86 Chaos 15.0.41 Release Notes

## System Administrator Tool Reorganization

This release reorganizes the System Administrator into clearer operating categories so support, backup, security, customer, release, and high-risk platform tools are easier to find.

### Changed
- Replaced the older scattered menu grouping with job-based categories:
  - Start Here
  - Backup & Recovery
  - Security & Access
  - Workspaces & People
  - Support & Monitoring
  - Maintenance & Releases
  - Platform Tools
- Added an Overview Tool Map that explains what each category is for and provides direct buttons into each tool.
- Updated desktop left-rail navigation, mobile dropdown grouping, and quick chips to match the new structure.
- Grouped dangerous/global tools under Platform Tools so regular support workflows are less cluttered.
- Added Global Event Injection / Forge into the visible organized menu.
- Added Administrator Manual documentation for the new organization.

### Deployment notes
- Redeploy on Vercel.
- No Firestore rules publish required.
- No Storage rules publish required.
- No new environment variables required.
