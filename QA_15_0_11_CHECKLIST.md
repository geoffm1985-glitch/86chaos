# 86 Chaos 15.0.11 QA Checklist

## Version

- [ ] Deploy the app.
- [ ] Confirm `/version.json` shows `15.0.11`.
- [ ] Confirm the side menu still shows **Manager Brief** and **Kitchen Command Center**.

## Kitchen 86 alerts

- [ ] In Menu Intelligence, confirm a burger menu item is linked to the correct inventory item, such as `BEEF GR PTY`.
- [ ] Use 86 Voice and say `86 burger`.
- [ ] Confirm the Message Board post says the requested item was 86'd.
- [ ] Confirm the post shows the matched inventory item when it differs from the spoken phrase.
- [ ] Confirm unavailable menu items are shown when Menu Intelligence links exist.
- [ ] Confirm Manager Brief shows the 86 alert.
- [ ] Confirm Kitchen Command Center shows the 86 alert.
- [ ] Confirm inventory quantities are not changed by the 86 voice command.

## Kitchen Command Center 86 post

- [ ] Open Kitchen Command Center.
- [ ] Use the 86/low-stock post action.
- [ ] Confirm the Message Board post includes low-stock items.
- [ ] Confirm menu impact appears for linked items.
- [ ] Confirm the post is important and visible in Manager Brief.

## Voice navigation

- [ ] Say `open manager brief` and confirm it opens Manager Brief.
- [ ] Say `open kitchen command center` and confirm it opens Kitchen Command Center.
- [ ] Say `open inventory` and confirm it opens Inventory & Orders.
- [ ] Say `open prep` and confirm it opens Prep & Tasks.
- [ ] Say `open time off` and confirm it opens Time Clock & Schedule → Request Off.
- [ ] Say `open help center` and confirm it opens Help Center.
- [ ] Test a restricted destination with a staff account and confirm the app blocks it politely.

## Simple kitchen use

- [ ] Confirm priority cards and command center copy are plain and readable.
- [ ] Confirm staff-facing Help Center content is public-safe.
- [ ] Confirm Administrator Manual contains 15.0.11 guidance.

## Deployment notes

- [ ] Firestore rules: no new 15.0.11 changes.
- [ ] Storage rules: no new 15.0.11 changes.
- [ ] Vercel/API routes: deploy updated app code.
- [ ] New environment variables: none.
