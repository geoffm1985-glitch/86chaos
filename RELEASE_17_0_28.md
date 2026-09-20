# 86 Chaos 17.0.28 — Time Clock and Schedule Roster Role Runtime Repair

## Root cause

17.0.27 correctly moved the schedule and Request Off runtime-safety modules away from direct `.cjs` browser imports, but the shared Time Clock and Schedule route still imported `src/core/rosterRoleIdentityCore.cjs` through `rosterRoleIdentity.js`.

Create React App/Webpack emitted that `.cjs` file as `static/media/rosterRoleIdentityCore.<hash>.cjs`. In the browser, the default import therefore became a URL string rather than the CommonJS exports object. `activeRosterRoles`, `resolveShiftRosterRole`, `copyRosterRoleFields`, and related helpers were undefined. `TabSchedule` calls `activeRosterRoles(...)` during the parent route render, so the entire Time Clock and Schedule section entered the recovery boundary before any subtab could open.

The deployed 17.0.27 asset manifest and schedule chunk independently confirmed this production-only failure mode.

## Repair

- Added `src/core/rosterRoleIdentity.shared.js` as the executable shared implementation.
- Changed `src/core/rosterRoleIdentity.js` to require the `.shared.js` implementation for browser bundling.
- Changed `src/core/rosterRoleIdentityCore.cjs` into a Node/API proxy to that same `.shared.js` implementation.
- Extended `scripts/verify-schedule-runtime-bundle.cjs` to fail if `rosterRoleIdentityCore.cjs` is emitted as static media.
- Added `api/roster-role-browser-runtime-contract-17-0-28.test.cjs` to lock the browser/Node contract.

## Scope

No schedule behavior, Time Clock behavior, permissions, payroll/labor calculations, Firebase rules, or stored restaurant data were redesigned or migrated.
