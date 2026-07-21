# QA Checklist: 15.0.102 Desktop Shell Clipping + Header Chrome Cleanup

## Desktop shell

- [ ] App version reads 15.0.102.
- [ ] Desktop shows only the left rail, not the mobile bottom nav.
- [ ] Main content does not clip off the right side at common desktop widths.
- [ ] Inventory Count page shows tabs, search/filter row, categories, and stock controls without disappearing under the browser scrollbar.
- [ ] Menu icon is centered as an icon, with no square/rounded background behind it.
- [ ] Report bug icon has no square background behind it.
- [ ] Version label has no oval/pill background behind it.
- [ ] Workspace switcher text has no pill background behind it.

## Mobile

- [ ] Mobile still shows the bottom nav only.
- [ ] Mobile route content still has enough bottom padding above the nav.
- [ ] Drawer menu still opens from More/menu.

## Regression

- [ ] Push notifications remain deduplicated.
- [ ] Staff permission gates still protect Back Office/System Admin/QuickBooks.
- [ ] Help Center staff filtering remains in place.
- [ ] Schedule, Inventory, Today, and Settings still load without fatal UI.
