# 86 Chaos 17.0.26

## Schedule Runtime Export Contract and Recovery Repair

17.0.26 is a surgical follow-up to the interrupted 17.0.25 candidate. It fixes the confirmed regression-test blocker without weakening the schedule/runtime hardening or Firebase/Vercel release-gate repairs introduced in 17.0.25.

### Confirmed root cause

`src/core/scheduleRuntimeSafety.cjs` correctly defined and exported `safeScheduleAvailabilityRows`, and `src/features/schedule.jsx` correctly imported and called it. However, the ES-module bridge `src/core/scheduleRuntimeSafety.js` did not forward `safeScheduleAvailabilityRows` (or `normalizeScheduleAvailabilityRow`). In the React/Jest module path the named import therefore resolved to `undefined`, producing `TypeError: safeScheduleAvailabilityRows is not a function` before Schedule Builder could render.

### Repairs

- `src/core/scheduleRuntimeSafety.js` now forwards every schedule safety helper consumed by `schedule.jsx`, including availability normalization.
- A permanent 17.0.26 module-contract regression verifies the CommonJS implementation, ES-module wrapper, and actual schedule consumer stay aligned.
- `src/features/scheduleRuntimeSafety.test.jsx` now explicitly verifies the wrapper contract and renders Request Off with mixed malformed legacy roster, shift, event, and request data.
- The 17.0.25 route-boundary normalization for Schedule Builder and Request Off is preserved unchanged except for making its availability sanitizer reachable through the real browser/Jest import path.
- The 17.0.25 stable Firebase-compatible Vercel browser-alias certification repair is carried forward unchanged.

### Data and security

No Firebase project, credential, rule, App Check, MFA, permission, wage-visibility, schedule-publish, Time Clock, payroll, Shift4, QuickBooks, inventory, recipe, vendor-order, or financial behavior was weakened or redesigned. No production data migration or automatic record rewrite is introduced.

### Certification status

The focused Node contract/runtime tests pass in the repair environment. The full React/Jest schedule runtime test and production build require the project's Node 24 dependency environment; the release remains repaired but not certified until the one-paste workflow completes the deployed full Play Store release gate on the user's Node 24.18.0 machine.
