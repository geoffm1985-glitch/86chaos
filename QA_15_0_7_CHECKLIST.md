# QA Checklist - 86 Chaos 15.0.7

## Version

- [ ] Deploy the app and confirm `/version.json` reports `15.0.7`.
- [ ] Confirm the footer/version display reports `15.0.7`.

## 86 Voice smart prep matching

- [ ] Open Prep & Tasks for today's date.
- [ ] Confirm a MASTER prep task such as `slice tomato` exists.
- [ ] Use 86 Voice or typed voice command: `slice 3 tomatoes`.
- [ ] Confirm the existing `slice tomato` row quantity changes to `3`.
- [ ] Confirm no new duplicate `Slice Tomato` row appears under Voice Station.
- [ ] Repeat with a plural/singular variation such as `dice 2 onions` when `dice onion` exists.
- [ ] Confirm MASTER rows are preferred over older Voice Station duplicates when both exist.
- [ ] Confirm a truly new prep command still creates a new Voice Station item when no confident match exists.

## Multi-item prep command

- [ ] Use a command with multiple items, such as `prep 2 pans tomatoes and 3 pans onions`.
- [ ] Confirm existing matching rows update.
- [ ] Confirm only missing/non-matching items are created.

## Cost/read behavior

- [ ] Confirm no new constant prep listener was added.
- [ ] Confirm Firestore reads occur only when the voice prep command is executed.

## Administrator Manual

- [ ] Open System Administrator → Administrator Manual.
- [ ] Search `15.0.7`.
- [ ] Confirm the smart prep duplicate-prevention guidance is present.

## Regression

- [ ] Confirm 86/out-of-stock voice commands still create 86 alerts and do not edit inventory.
- [ ] Confirm voice navigation still respects permissions.
- [ ] Confirm ordinary manual prep entry still works.
- [ ] Confirm Menu Intelligence delete controls from 15.0.6 still work.
