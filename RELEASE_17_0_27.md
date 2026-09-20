# 86 Chaos 17.0.27

## Time Clock and Schedule Runtime Recovery Repair

17.0.27 repairs the production-only module-loading regression that trapped the Time Clock & Schedule route behind the section recovery screen in 17.0.26.

### Confirmed root cause

Create React App's production Webpack configuration treated directly imported `.cjs` files as static media. The 17.0.26 ES-module wrappers therefore imported URL strings such as `static/media/scheduleRuntimeSafety.<hash>.cjs`, then attempted to read sanitizer functions from those strings. Jest loaded the same `.cjs` files as executable CommonJS, so the prior export-contract tests passed while the deployed browser received undefined helpers.

The first parent-route call to `safeScheduleRosterRows` could fail before subtab selection. Request Off also depended on an identically broken `.cjs` bridge, independently leaving `safeRequestOffRows`, `requestOffDateKey`, and `normalizeRequestOffRuntimeRow` undefined in the production bundle.

### Repairs

- Browser wrappers now import executable `.shared.js` implementations rather than `.cjs` assets.
- Node/CommonJS entry points proxy to those exact shared implementations, preventing test/browser drift.
- A production-bundle verifier rejects any future build that emits the schedule or Request Off safety modules under `static/media`.
- The React regression now mounts the real `TabMasterSchedule` parent behind a recovery-boundary probe and navigates My Schedule/Time Clock, Month View, Request Off, Availability, and Schedule Builder with mixed valid and malformed legacy records.
- Firestore listener cleanup is defensive when a nonstandard test or adapter fails to return an unsubscribe function; normal Firestore behavior is unchanged.

### Preserved behavior

No data migration, Firestore write, permission, payroll, labor, publishing, Firebase rule, MFA, App Check, Shift4, inventory, financial, or unrelated UI change is included. The stable Firebase-approved testing alias and immutable deployment-identity certification flow from 17.0.25 remain intact.

### Certification status

Targeted schedule/runtime contracts, the parent-route React regression, the production build, and the extracted-ZIP package preflight must pass before delivery. The deployed full Play Store release gate remains the final certification step in the one-paste testing workflow.
