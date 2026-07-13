# 86 Chaos 15.0.63 Release Notes

## Maintenance Mode Undefined-Field Hotfix

This release fixes a System Administrator maintenance-mode save error where Firestore could reject a restaurant update with:

> Function updateDoc() called with invalid data. Unsupported field value: undefined

### Fixed

- Maintenance Mode enable now sanitizes the entire Firestore payload before `updateDoc()`.
- Maintenance Mode clear now sanitizes the entire Firestore payload before `updateDoc()`.
- Maintenance settings history now stores `null` for missing prior fields instead of `undefined`.
- Maintenance clear now explicitly clears stale maintenance message, audience, start, and end values with safe `null` values.
- Maintenance mode still keeps Super Admin/System Admin recovery access intact.
- No features, tabs, permissions, plans, Firebase rules, API routes, voice workflows, or retention functions were removed or downgraded.

### Not changed

- No Firebase rules changes.
- No Storage rules changes.
- No Vercel environment variable changes.
- No production retention setup changes.
- No plan/Founder Beta changes.
- No voice command behavior changes.

