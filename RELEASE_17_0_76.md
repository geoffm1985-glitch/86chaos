# 86 Chaos 17.0.76 - Ghost Request Off Certification Selector Repair

## Captured failure

The completed 17.0.75 full Yardmaster gate passed the prior QA role-target repair, then blocked before Playwright in api/release-browser-reliability.test.cjs.

The active Ghost Request Off Playwright workflow correctly enters Time Clock & Schedule with gotoTab(page, 'published') and opens Request Off through the stable schedule-request-off-tab test ID.

The server-side reliability assertion was stale and still required the former button-name selector:

getByRole('button', { name: /^Schedule Request Off$/i })

That obsolete source assertion failed even though the browser workflow continued to use the correct employee route.

## Surgical repair

- Bump testing build identity to 17.0.76.
- Change only the stale release-browser selector assertion to schedule-request-off-tab.
- Preserve the prohibition on navigating the Ghost Request Off workflow through Schedule Builder.
- Preserve the prohibition on elevating Allen QA Schedule Builder permission.
- Do not change Ghost Mode, Request Off, Schedule Builder permissions, Firebase rules, or production authorization behavior.

## Coverage

- Exact repaired server assertion: api/release-browser-reliability.test.cjs.
- Targeted Node regression: api/ghost-request-off-route-source-17-0-76.test.cjs.
- Mandatory Play Store/release-gate Playwright regression: tests/86chaos-release-gate/88-ghost-request-off-selector-17-0-76.spec.cjs.
- Independent Playwright regression: tests/e2e/ghost-request-off-selector-17-0-76.spec.cjs.

No production push or deployment is included.
