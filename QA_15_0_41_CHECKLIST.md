# QA Checklist - 86 Chaos 15.0.41

## System Administrator navigation
- [ ] Open System Administrator on desktop.
- [ ] Confirm the left Admin Menu starts at the top of the page.
- [ ] Confirm menu groups appear as Start Here, Backup & Recovery, Security & Access, Workspaces & People, Support & Monitoring, Maintenance & Releases, and Platform Tools.
- [ ] Click every menu button once and confirm the correct section opens.
- [ ] Confirm Global Event Injection / Forge opens from Platform Tools.
- [ ] Confirm Danger Zone remains under Platform Tools and still requires confirmation before destructive work.

## Overview Tool Map
- [ ] Open System Administrator → Command Center / Overview.
- [ ] Confirm the Tool Map appears below the status widgets.
- [ ] Confirm each category explains when to use it.
- [ ] Use Tool Map buttons to open Health, Backup Center, Security Center, People Directory, Support Diagnostics, Maintenance Mode, Platform Operations, and AI Administrator Manual.

## Mobile
- [ ] Open System Administrator on a phone or mobile emulator.
- [ ] Confirm the mobile section picker uses the same categories as desktop.
- [ ] Confirm quick chips still fit horizontally and open the correct sections.
- [ ] Confirm choosing a section closes the mobile menu.
- [ ] Confirm no horizontal page scrolling is introduced.

## Regression
- [ ] Confirm System Administrator loads without console errors.
- [ ] Confirm Ask Gemini still opens from AI Administrator Manual.
- [ ] Confirm Health Dashboard still refreshes.
- [ ] Confirm Backup Center still lists backups.
- [ ] Confirm Security Center still loads diagnostics.
- [ ] Confirm Workspaces, People Directory, Push Control Center, Support Diagnostics, and Maintenance Mode still render.

## Build checks
- [ ] Confirm `/version.json` reports `15.0.41` after deploy.
- [ ] Confirm Vercel deploy succeeds.
