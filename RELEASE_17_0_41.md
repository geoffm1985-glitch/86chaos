# 86 Chaos 17.0.41 — Emergency Manager Brief Runtime + Sticky Schedule Header Repair

## Emergency repairs

- Manager Brief no longer imports the 17.0.39 restaurant-intelligence helpers through browser CommonJS interop. Browser-native ES module counterparts now export the exact functions used by Manager Brief, removing the observed minified `Ve is not a function` recovery crash path.
- Schedule Builder now measures the sticky control deck on mobile as well as desktop. The day/date header uses that live height as its sticky offset, so the header remains visible immediately below the control deck instead of sliding behind it while the staff grid scrolls.
- Mobile sticky-header stacking is raised above the schedule grid while remaining below the app header/control context. Horizontal header/body synchronization is preserved.

## Test coverage added (not executed in this build-only push)

- `api/emergency-runtime-sticky-17-0-41.test.cjs`
- `tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs`
- `scripts/validate-17-0-41.js`

Per instruction, this push is build-only. Automated Release Gate / Play Store / targeted / delta execution remains stopped until further instruction.
