# 86 Chaos 15.0.6 QA Checklist

## Version

- [ ] Deploy the app.
- [ ] Confirm `/version.json` shows `15.0.6`.
- [ ] Confirm the footer/app version shows `15.0.6`.

## Menu Intelligence fast delete

- [ ] Open Menu Intelligence as a user with permission.
- [ ] Delete a Recent Menu Scan with several linked ingredients.
- [ ] Confirm the row changes to deleting and shows a progress bar, record count, percent, and elapsed timer.
- [ ] Try clicking delete/edit again while deletion is running and confirm the buttons are disabled.
- [ ] Confirm the menu scan disappears after the delete finishes.
- [ ] Confirm the linked menu-impact dependencies for that scan are removed.
- [ ] Confirm unrelated menu scans and unrelated menu-impact dependencies remain.

## Edit regression

- [ ] Edit an approved menu scan and remove one or more ingredient links.
- [ ] Save the scan and confirm removed links disappear from Current Menu Impacts.
- [ ] Confirm the scan dependency count updates correctly.

## Regression checks

- [ ] Menu scan upload progress from 15.0.4 still works.
- [ ] Approve Reviewed Menu Links still blocks duplicate clicking.
- [ ] Manual Presence Snapshot from 15.0.5 still only refreshes when Super Admin presses the button.
- [ ] Invoice bulk-save notifications from 15.0.3 still show one summary notification.
