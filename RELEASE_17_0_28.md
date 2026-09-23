# 86 Chaos 17.0.28

## Browser-Safe Spanish Runtime Emergency Repair

17.0.28 is an emergency application-bootstrap repair. Phase 1 Spanish introduced a browser import from `src/core/i18n.cjs`. In this Create React App production pipeline, `.cjs` files can be emitted as asset URLs rather than executed browser modules. That leaves the imported translation functions undefined at runtime and can prevent the entire React tree, including the login screen, from rendering.

The browser translation runtime now lives entirely in the executable ES-module `src/core/i18n.js`; the `.cjs` module remains Node-only for release-gate contract tests. English and Spanish dictionaries, per-user language persistence, localized dates, and all Phase 1 translated surfaces are preserved.

A new current-release Node regression rejects any `.cjs` browser import, checks that every English/Spanish translation key in the Node contract is present in the browser module, and verifies that the application still mounts through `I18nProvider`. The existing deployed Spanish and Schedule Builder assignment Playwright regressions remain in the full and delta release-gate scope.

No schedule assignment, schedule deletion, publishing, Request Off, POS, inventory, financial, or permission behavior was redesigned.
