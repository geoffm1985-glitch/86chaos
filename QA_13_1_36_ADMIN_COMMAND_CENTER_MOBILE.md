# QA 13.1.36 — Admin Command Center + Mobile Layout

## Mobile administrator layout

1. Open the app on a phone-sized screen and log in as Super Admin.
2. Open System Administrator.
3. Confirm the Command Deck is not expanded by default.
4. Confirm the mobile section picker appears near the top.
5. Use the dropdown to open Health + Deployment, Live Activity, People, Forensics + Backups, Operations + Lockdown, and Administrator Manual.
6. Confirm each section opens without needing to scroll past the full Command Deck first.
7. Tap Signals and confirm the Command Deck opens in a scroll-contained panel, then tap Hide.

## Desktop administrator layout

1. Open System Administrator on a desktop screen.
2. Confirm grouped section cards show across the top.
3. Confirm the Command Deck appears as the left-side signal board.
4. Hide and show the Command Deck.
5. Confirm existing admin sections still work: Workspaces, People, Health Dashboard, Live Activity, Support Desk, Forensics & Backups, Platform Operations, Access Control, and Manual.

## Regression checks

1. Run Full System Diagnostics from Health + Deployment.
2. Open Live Activity and confirm the panel still loads.
3. Open Platform Operations and confirm Test Push Notifications and Global Lockdown controls are still present.
4. Open Forensics & Backups and confirm Backup Center still lists backups.
5. Open Administrator Manual and search for Command Deck and mobile layout.
