# QA Checklist: 15.0.104 Serious App Design System Cleanup

## Version

- [ ] App shows Version 15.0.104.
- [ ] Existing login still works.
- [ ] Existing workspace data still loads.

## Desktop App Feel

- [ ] Desktop shows left rail only, not bottom nav.
- [ ] Desktop content does not clip on the right.
- [ ] Header actions are plain icons/text, not pill/square/oval controls.
- [ ] Drawer menu rows do not have rounded active backgrounds behind the words.
- [ ] App surfaces feel flatter and calmer, not like marketing cards.
- [ ] Inventory screen fits within the browser width.
- [ ] Inventory rows remain readable and clickable.

## Mobile App Feel

- [ ] Mobile shows bottom nav only, not desktop left rail.
- [ ] Bottom nav is fixed and usable.
- [ ] Drawer opens/closes correctly.
- [ ] Forms still respect mobile no-zoom behavior.

## Functional Regression

- [ ] Today opens.
- [ ] Schedule opens.
- [ ] Prep opens.
- [ ] Inventory opens.
- [ ] Menu drawer opens.
- [ ] Report Problem still opens.
- [ ] Log Out still works.
- [ ] Staff permission gates are unchanged.
- [ ] System Administrator gates are unchanged.

## Push/Notification Regression

- [ ] Existing push duplicate hotfix remains intact.
- [ ] Test push/reminder does not duplicate on the same device.
