# QA Checklist - 86 Chaos 15.0.10

## Version

- [ ] Confirm `/version.json` reports `15.0.10`.
- [ ] Confirm footer/version display reports `15.0.10`.
- [ ] Confirm only `README_15_0_10_RELEASE_NOTES.md` is included as the current release note.

## Menu labels

- [ ] Open the side menu and confirm Today Command Center is now labeled `Manager Brief`.
- [ ] Open the side menu and confirm Ops Command Center is now labeled `Kitchen Command Center`.
- [ ] Confirm the Kitchen Command Center page still opens for users with the proper Ops/Kitchen Command permission.

## 86 Voice smart matching

- [ ] In Menu Intelligence, confirm a menu item such as a burger is approved and linked to the correct inventory product.
- [ ] Use 86 Voice and say or type `86 burger`.
- [ ] Confirm the voice summary shows an 86 alert and, when applicable, the matched inventory product.
- [ ] Confirm inventory quantities are not modified by the voice command.
- [ ] Confirm the alert saves as an important Message Board post.

## Message Board menu impact

- [ ] Open Message Board after the voice alert.
- [ ] Confirm the 86 post includes the requested item.
- [ ] Confirm the post includes inventory match details when the matched inventory name differs from the spoken item.
- [ ] Confirm the post lists unavailable menu items from Menu Intelligence.
- [ ] Confirm Message Board search can find the unavailable menu item text.

## Manager Brief and Kitchen Command Center

- [ ] Open Manager Brief and confirm the important 86 alert appears.
- [ ] Confirm Manager Brief shows the menu impact/details underneath the alert when present.
- [ ] Open Kitchen Command Center and confirm the 86 alert appears in the 86 Watch/timeline areas.
- [ ] Confirm the feature uses one shared event record rather than creating multiple duplicate alert posts.

## Help Center and Administrator Manual

- [ ] Open Help Center and search `15.0.10`.
- [ ] Confirm the Release Notes article explains 86 Voice menu impact alerts and the menu renames.
- [ ] Open System Administrator → Administrator Manual and search `15.0.10`.
- [ ] Confirm the deployment checklist and support routine are present.

## Deployment/rules

- [ ] Confirm no new Firestore rules are required beyond 15.0.9.
- [ ] Confirm no new Storage rules are required beyond 15.0.9.
- [ ] Confirm no new Vercel environment variables are required.
