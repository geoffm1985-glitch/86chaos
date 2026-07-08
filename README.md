# 86 Chaos

Current version: 15.0.11

## 15.0.11 focus

15.0.11 tightens kitchen 86 alerts, improves voice navigation, and makes the command centers feel more like simple service tools instead of a cockpit panel.

## What changed

- 86 Voice now loads Inventory and Menu Intelligence context on demand when an 86 command is spoken, instead of relying only on whatever screen data was already loaded.
- Spoken menu shorthand like `86 burger` has stronger matching for kitchen product names like `BEEF GR PTY`, `beef patty`, `hamburger`, or `ground beef`.
- Voice-created 86 alerts now include matched inventory details and unavailable menu items when Menu Intelligence links exist.
- Kitchen Command Center 86 posts now include Menu Intelligence impact and are flagged for Manager Brief and Kitchen Command Center.
- Kitchen Command Center now subscribes to alert posts while that tab is open, so important 86 alerts are easier to see there.
- Voice navigation now recognizes more plain-language destinations such as Manager Brief, Kitchen Command Center, Inventory, Prep, Time Off, Staff Roster, Financials, Help Center, and System Administrator.
- Staff-facing command center wording was simplified so urgent work reads more clearly at a glance.
- Help Center includes 15.0.11 release notes.
- Administrator Manual includes 15.0.11 support and QA guidance.

## Deployment notes

1. Deploy the app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.11` after deploy.
3. Test voice command `86 burger` in a workspace with approved Menu Intelligence links.
4. Confirm the Message Board shows the requested item, matched inventory item, and unavailable menu items.
5. Confirm Manager Brief and Kitchen Command Center both show the alert.
6. Test voice navigation phrases like `open kitchen command center`, `manager brief`, `open inventory`, and `open time off`.
7. Run the 15.0.11 QA checklist before handing it to staff.

## Separate publishing required

- Firestore rules: no new changes from 15.0.10.
- Storage rules: no new changes from 15.0.10.
- Vercel/API routes: deploy the updated app code.
- New environment variables: none.
