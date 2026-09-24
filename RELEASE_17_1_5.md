# 86 Chaos 17.1.5

## Mobile Bottom Toolbar Single-Line Label Repair

17.1.5 is a precision presentation repair requested before the next release-gate run.

### Repair

- Keeps Voice, Schedule, Home, Kitchen, Staff, and More on one line in the six-slot mobile bottom toolbar.
- Adds dedicated mobile-nav label markup with explicit `nowrap`, `keep-all`, and normal overflow-wrap behavior.
- Applies narrow-phone font sizing that remains readable while fitting the fixed six-slot command bar.
- Preserves the existing 44px+ touch geometry and the first-slot 86Voice placement.
- Adds source and deployed-browser regressions that verify each toolbar label stays on one line and fits its slot.

### Preserved

- All 17.1.4 release-gate browser stability repairs.
- Schedule Builder sticky day/date behavior.
- Message Board posting repair.
- Kitchen Command crash repair.
- Existing 86 Chaos branding.
- Time Clock & Schedule remains first.
- Orders & Tickets remains excluded.

### Certification status

This source is not Play Store certified until 17.1.5 is deployed to `testing.86chaos.com` and the delta/full release gate passes there.
