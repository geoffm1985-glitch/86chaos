# 86 Chaos 17.1.0

## Full-App Concept 1 Responsive Redesign

17.1.0 establishes the approved charcoal-and-bronze Concept 1 presentation system as the shared visual baseline for the 86 Chaos application. Existing production workflows remain in place; this release changes the application shell, shared visual primitives, navigation presentation, responsive layout, and the current delta-gate defects rather than replacing mature business logic.

### App-wide design system

- Added `src/concept17.css` as the shared presentation layer for cards, controls, tables, modals, typography, workspace spacing, desktop and mobile geometry.
- Added reusable `Concept17Sidebar` and `Concept17MobileNav` shell components.
- Reworked the command header with integrated global search, restaurant workspace selection, report/menu controls, and user identity.
- Added a true fixed desktop navigation rail at large desktop widths and a touch-first mobile bottom navigation bar.
- Preserved the existing drawer as the complete navigation surface for secondary tools and workflows.
- Updated Manager Brief to use the active restaurant name as its visual hero while retaining the existing role brief, priority logic, and operational metrics.
- Did not add or expose an Orders & Tickets feature or placeholder.

### System Administrator delta repair

The attached release-gate evidence showed the Concept 1 home exposing 14 `system-admin-directory-card` elements while the current browser contract correctly expected all 21 real System Administrator tools. The seven featured tools now participate in the same 21-tool directory contract while retaining their established featured-card geometry. The older browser regression that still expected 14 was corrected to the current 21-tool contract rather than weakening the newer test.

### Localization and safety preserved

- New shell labels are available in both browser and Node English/Spanish dictionaries.
- Restaurant-entered content remains untranslated.
- `testing.86chaos.com`, the testing Firebase project, testing-only PWA identity, production mutation safeguards, PWA Back behavior, schedule repairs, removal of presence tracking, POS bridge boundaries, App Check/MFA boundaries, and backup/recovery logic remain preserved.

### Test additions

- Added `api/app-wide-concept1-redesign-17-1-0.test.cjs` for design-system, navigation, directory-contract, localization, PWA identity, and testing-boundary source contracts.
- Added deployed Playwright coverage at `tests/86chaos-new-implementations/17-app-wide-concept1-layout.spec.cjs` for 1440x900 desktop and 390x844 mobile geometry, horizontal overflow, touch targets, desktop width, navigation presence, and Orders & Tickets absence.
- The new deployed browser regression is part of the current release repair scope for both Chromium and mobile Chromium.

## Certification status

17.1.0 is not certified until the complete deployed Play Store/release gate passes against the canonical testing deployment. Targeted validation and local build results are evidence for the candidate only, not certification.
