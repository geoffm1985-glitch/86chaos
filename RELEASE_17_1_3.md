# 86 Chaos 17.1.3

## Mobile Workflow and Message Board Repair

17.1.3 is a targeted production-safe repair on top of the 17.1.2 Concept 1 redesign.

### Fixed

- Keeps the Schedule Builder day/date header pinned while staff rows scroll.
- Tightens Schedule Builder spacing on mobile while preserving 44px touch targets.
- Widens the sticky staff column on mobile so employee names are less aggressively truncated.
- Repairs Message Board live events loading on the Messages route, so saved posts appear instead of only sending a push notification.
- Adds immediate optimistic rendering for a successfully saved Message Board post while the Firestore listener catches up.
- Moves the existing 86Voice microphone control into the first visual slot of the mobile bottom toolbar without creating a duplicate voice control.
- Keeps the mobile 86Voice panel above the bottom toolbar when open.
- Prevents Kitchen Tools status badges such as READY, SMART KITCHEN, INVENTORY, BETA, and KITCHEN from stacking one letter per line.
- Repairs the Kitchen Command Center runtime crash caused by calling `formatFullDate` without obtaining it from the i18n hook.
- Suppresses the reconnect-notifications banner when the current device already has a healthy active push token and granted notification permission.
- Preserves the existing 86 Chaos icon/wordmark, Time Clock-first navigation, Concept 1 redesign, Spanish support, System Administrator 21-card directory, and existing production safeguards.

### Certification

Run the targeted/delta gate first after deployment to testing, then run the complete Play Store release gate before production promotion.
