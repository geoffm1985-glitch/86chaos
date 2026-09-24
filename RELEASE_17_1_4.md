# 86 Chaos 17.1.4

## Release-Gate Browser Stability Repair

17.1.4 is a targeted repair driven by the failed+new Play Store evidence from 17.1.3. It fixes actual browser geometry defects and replaces stale or locale-fragile test selectors without weakening correct production behavior.

### Repairs

- Keeps the Schedule Builder day/date row sticky, but returns the control deck to normal document flow so it cannot intercept grid cells or the Assign button.
- Aligns the 86Voice trigger with the exact first mobile bottom-navigation slot on narrow phones.
- Adds stable `data-shell-route` and `data-concept-subtab-button` identities to real navigation/subtab controls.
- Isolates Spanish interface tests across desktop/mobile QA accounts and waits for language restoration before the test exits.
- Makes deployed version verification dynamic from `package.json` instead of hard-coding 17.1.0.
- Makes System Administrator drawer return locale-independent.
- Gives exhaustive Concept 1 route sweeps an evidence-based timeout budget rather than treating healthy long coverage as a timeout.
- Keeps the Kitchen Command crash assertion strict while accepting the legitimate Spanish heading.

### Preserved

- Existing 86 Chaos logos and branding.
- Time Clock & Schedule remains the first primary tab.
- Orders & Tickets remains excluded.
- 17.1.3 Message Board, Kitchen crash, Schedule Builder sticky-date, Kitchen Tools badge, push-repair-banner, and 86Voice behavior repairs remain intact.

### Certification status

This source is not Play Store certified until the final 17.1.4 candidate is deployed to `testing.86chaos.com` and the delta/full release gate passes there.
