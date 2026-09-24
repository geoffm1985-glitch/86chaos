# 86 Chaos 17.1.1

## Full-App Concept 1 Deep Workflow Redesign

17.1.1 completes the presentation-layer migration requested for the Concept 1 redesign and repairs the failed Vercel 17.1 build without weakening production logic or release-gate safeguards.

### Completed

- Keeps the existing 86 Chaos icon and wordmark assets as the application brand.
- Wraps every real routed workflow in the shared Concept 1 route frame so the redesign reaches deep tabs and subpages, not only the outer shell.
- Extends the charcoal / bronze design system through cards, page sections, tab bars, forms, selects, tables, alerts, Schedule Builder surfaces, Inventory, Financials, Staff, HR & Training, Maintenance, Settings, Help, System Administrator, and auxiliary workflows.
- Removes legacy desktop width ceilings that could collapse real pages into narrow mobile-like columns.
- Preserves touch-friendly mobile geometry and horizontal-overflow protections.
- Keeps Orders & Tickets absent as requested.
- Preserves testing-only PWA identity, canonical testing domain, Spanish support, PWA Back behavior, presence retirement, schedule repairs, POS boundaries, and security safeguards.
- Repairs the failed Vercel 17.1 compile/import path by replacing the unsupported `CircleHelp` named Lucide import with the pinned-version-compatible `HelpCircle` export.
- Adds static source contracts and deployed Playwright coverage for representative real routes at desktop and mobile sizes.

### Certification status

Targeted/source/syntax validation may be run for this package. The release is **not certified** until the final candidate is deployed to `https://testing.86chaos.com` and the complete Play Store release gate passes.
