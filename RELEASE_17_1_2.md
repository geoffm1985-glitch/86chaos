# 86 Chaos 17.1.2 — Complete Concept 1 Page-by-Page Redesign Repair

Status: release candidate only. Not certified until the full deployed Play Store release gate passes against testing.86chaos.com.

## Scope

- Completes the Concept 1 presentation-layer migration across every real routed 86 Chaos surface and stateful subtab family.
- Keeps the existing 86 Chaos logo/icon brand assets intact.
- Makes Time Clock & Schedule the first primary navigation destination on desktop, drawer, and mobile navigation.
- Preserves all mature restaurant, employee, schedule, financial, inventory, security, backup, integration, i18n, PWA-back, testing-domain, and tenant-isolation behavior.
- Does not add Orders & Tickets.

## System Administrator repair

- Restores the exact 21-card canonical System Administrator directory contract.
- Keeps the 7 featured cards as presentation shortcuts without duplicating canonical directory identities.
- Preserves full-width desktop geometry, mobile behavior, subpage back navigation, and all existing admin tools.

## Complete Concept 1 migration

- Adds a shared route frame and explicit route blueprint for all real routed pages.
- Adds explicit Concept 1 state markers and layouts for Time Clock/Schedule, Schedule Builder tools, Prep, Inventory, Financials, Labor, Back Office, HR & Training, Maintenance, Settings, System Administrator, and nested invoice/specials states.
- Normalizes deep cards, segmented tabs, tables, forms, selects, modals, empty states, action decks, metrics, and responsive layout to the approved charcoal/bronze visual system.
- Removes legacy narrow desktop ceilings and prevents phone-width layouts from leaking into desktop pages.
- Adds responsive rules for 1440x900 desktop and 390x844 mobile geometry.

## Vercel build repair retained

- Keeps the lucide-react 0.344.0-compatible HelpCircle import used by the 17.1.x shell and route system.
- Protects the compatible import with current-release regression coverage.

## Validation policy

- Current-release targeted regressions must pass.
- Source/version/manifest validation must pass.
- Syntax checks must pass.
- Production build must be run with the repository-required Node 24.x environment.
- Deployed desktop/mobile Playwright route and subtab fidelity tests must pass against testing.86chaos.com.
- Full Play Store release gate must pass before certification.
