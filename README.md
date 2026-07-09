# 86 Chaos

Current Version: 15.0.41 - System Administrator Tool Reorganization

## 15.0.41 focus

This release reorganizes System Administrator so the right tools live together and the menu is easier to understand on desktop and mobile.

### Included fixes
- Rebuilt the System Administrator menu categories around jobs instead of scattered feature names.
- Added these new tool groups: Start Here, Backup & Recovery, Security & Access, Workspaces & People, Support & Monitoring, Maintenance & Releases, and Platform Tools.
- Added a System Administrator Tool Map on Overview that explains what each category is for and opens the correct tool directly.
- Updated the desktop left rail and mobile section picker to use the same category structure.
- Moved high-risk global tools into Platform Tools, with Danger Zone grouped beside global platform operations instead of mixed into normal support areas.
- Added the previously orphaned Global Event Injection / Forge tool back into the organized menu.
- Updated Administrator Manual release documentation for the new category layout.

### Separate deployment / publishing
- Vercel redeploy required because frontend code and version metadata changed.
- API behavior unchanged. Version metadata only.
- No `vercel.json` changes.
- No Firestore rules changes.
- No Storage rules changes.
- No new env vars required.

### Quick validation
1. Deploy to Vercel preview/testing first.
2. Confirm `/version.json` reports `15.0.41`.
3. Open System Administrator on desktop and confirm the left menu starts at the top and shows the new grouped categories.
4. Open System Administrator on a phone or browser mobile emulator and confirm the picker groups match the desktop left rail.
5. Open Overview and confirm the System Administrator Tool Map appears under the status widgets.
6. Test category jumps: Health, Backups, Security, People, Support, Maintenance, Platform Operations, and Manual.
7. Confirm the high-risk Danger Zone is grouped under Platform Tools and still requires its existing confirmations.

## Notes
- 86 Chaos branding remains mandatory and cannot be hidden or replaced.
- Customer restaurant logos may appear beside 86 Chaos branding, but not instead of it.
- Keep Help Center public-facing and generic. Keep System Administrator security details inside the Administrator Manual.
