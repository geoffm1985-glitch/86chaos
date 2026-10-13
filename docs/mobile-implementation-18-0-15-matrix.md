# Mobile 18.0.15 implementation and acceptance matrix

All 47 reconciled recommendations are covered below. Source references identify retained foundations and the new extensions; passing evidence is recorded separately after pushed-source validation. Local tests cannot establish live provider/device/production-console acceptance.

| ID | Recommendation | Implementation | External acceptance |
|---|---|---|---|
| R01 | Keep source/deployment/version identity fail-closed and exact-commit verified. | Extended in 18.0.15 |  |
| R02 | Harden full/delta/failed-only/partial-resume test truth, retry accounting, Windows runner exit codes, hermetic fixtures, and emergency report ZIP finalization. | Existing implementation retained; regression coverage required |  |
| R03 | Eliminate runtime/console defects and prove mobile Schedule Builder, request-off, shift publishing, and schedule recovery correctness. | Existing implementation retained; regression coverage required |  |
| R04 | Ensure partial data is never silently shown as complete; surface incomplete/retry states. | Existing implementation retained; regression coverage required |  |
| R05 | Harden backup/restore integrity, diagnostics, rollback evidence, and deployment validation. | Existing implementation retained; regression coverage required | Production restore and protection evidence requires live acceptance. |
| R06 | Measure Firebase/RTDB read-write demand and remove wasteful/duplicate reads while preserving correctness. | Existing implementation retained; regression coverage required |  |
| R07 | Keep testing vs production visually unmistakable, including preview/PWA environment warning. | Existing implementation retained; regression coverage required |  |
| R08 | Remove/rotate any exposed credentials and keep secret scanning / service-account protection strong. | Existing implementation retained; regression coverage required | Credential exposure inventory requires live account review. |
| R09 | Build a shared needs-attention engine that normalizes actionable cards across inventory/par, 86 risk/menu impact, prep/tasks, maintenance, staffing/schedule, labor, time off/trades, vendors, invoice jumps, waste/burn, AI ordering, Python findings, owner/admin alerts, and setup gaps. | Extended in 18.0.15 |  |
| R10 | Make the manager experience answer: “what needs attention today, why it matters, and the button to fix it.” | Extended in 18.0.15 |  |
| R11 | Rank Restaurant Readiness across Inventory, Prep, Staffing, Maintenance, Food Safety, Financial, Operations, and System with direct actions and explainable reasons. | Extended in 18.0.15 |  |
| R12 | Keep operational intelligence deterministic, grounded in real data, review-first, and measurable. | Existing implementation retained; regression coverage required |  |
| R13 | Strengthen the menu → recipe → inventory → prep → vendor → invoice → cost → margin → 86-risk dependency graph. | Existing implementation retained; regression coverage required |  |
| R14 | Include allergens, substitutions, vendor-cost changes, yield, portion cost, and menu impact. | Existing implementation retained; regression coverage required |  |
| R15 | Make dependency ownership/reachability auditable and read-efficient. | Existing implementation retained; regression coverage required |  |
| R16 | Build deterministic PO ↔ Receiving ↔ Invoice reconciliation. | Existing implementation retained; regression coverage required |  |
| R17 | Harden case-pack, catch-weight, split-case, partial delivery, substitution/backorder, ordered/shipped/received quantities, unit conversion, yield, and portion-cost math. | Existing implementation retained; regression coverage required |  |
| R18 | Add low-confidence product research using workspace history, vendor catalogs, UPC/GTIN, and controlled web lookup, always retaining evidence/confidence and requiring human review. | Existing implementation retained; regression coverage required |  |
| R19 | Add editable/revocable vendor/workspace learned aliases with approval metadata, match explanations, and conflict-triggered review. | Existing implementation retained; regression coverage required |  |
| R20 | Add a brutal end-to-end invoice → matching → review → approval → inventory/cost → menu costing/86 impact → AI order suggestion test. | Existing implementation retained; regression coverage required |  |
| R21 | Keep high-risk changes blocked until reviewed; no automatic ordering. | Existing implementation retained; regression coverage required |  |
| R22 | Build data-grounded demand → menu → recipe → inventory → prep → 86-risk forecasting. | Existing implementation retained; regression coverage required |  |
| R23 | Generate explainable prep recommendations and risk alerts with human approval. | Existing implementation retained; regression coverage required |  |
| R24 | Use price, waste, par, order, sales/POS, and operational history only when data quality is sufficient. | Existing implementation retained; regression coverage required |  |
| R25 | Continue provider-neutral, server-only, tenant-isolated, authenticated, replay-protected, idempotent POS ingestion. | Extended in 18.0.15 |  |
| R26 | Preserve integer-cents normalization, business date/timezone handling, pagination completeness, sequence windows, durable receipts, reconciliation, and export. | Extended in 18.0.15 | Provider pagination/completion contract remains unverified; imports remain staged/incomplete. |
| R27 | Keep POS reads/staging unable to modify inventory, Daily Close, ledger, schedule, Time Clock, payroll, orders, recipes, or menu without explicit future approval. | Existing implementation retained; regression coverage required |  |
| R28 | Keep PCI boundary intact. | Existing implementation retained; regression coverage required |  |
| R29 | Move from voice navigation toward safe, permission-aware actions. | Extended in 18.0.15 |  |
| R30 | Require confirmation/approval for consequential actions. | Extended in 18.0.15 |  |
| R31 | Preserve mobile/desktop voice parity and accessible fallback. | Existing implementation retained; regression coverage required | USB Android acceptance deferred by Geoff. |
| R32 | Mature HACCP-style logs, corrective actions, food-safety alerts, auditability, and completion evidence. | Extended in 18.0.15 |  |
| R33 | Connect allergens/substitutions to recipe/menu/inventory intelligence. | Existing implementation retained; regression coverage required |  |
| R34 | Never allow AI to silently alter food-safety-critical data. | Existing implementation retained; regression coverage required |  |
| R35 | Bring Help Center coverage to feature parity with real workflows, deep links, direct fixes, and setup/empty-state guidance. | Existing implementation retained; regression coverage required |  |
| R36 | Build operational training intelligence around real incidents, repeated errors, readiness gaps, and role-specific coaching rather than a generic LMS. | Extended in 18.0.15 |  |
| R37 | Keep training and Ask 86 grounded in actual app behavior/data. | Existing implementation retained; regression coverage required |  |
| R38 | Tighten owner/admin boundaries, guarded alternate writes, precise authorization, MFA/App Check/security diagnostics, and audit evidence. | Extended in 18.0.15 | Production console MFA/App Check and deployed rules evidence remains separate. |
| R39 | Improve runtime diagnostics, forensics, backup visibility, integration health, and failure explanations. | Existing implementation retained; regression coverage required |  |
| R40 | Keep System Administrator functions permission-gated and secrets server-side. | Extended in 18.0.15 |  |
| R41 | Build adapter-based/provider-neutral integrations with explicit capabilities, tenant isolation, idempotency, audit trails, health/status, and safe failure behavior. | Extended in 18.0.15 | Integration code completed; live account setup deferred by Geoff. |
| R42 | Prefer integrations over rebuilding payroll, accounting/GL, reservations, enterprise procurement, or proprietary hardware. | Existing implementation retained; regression coverage required |  |
| R43 | Keep mobile and desktop navigation/functionality at parity. | Existing implementation retained; regression coverage required | Physical Android acceptance deferred by Geoff. |
| R44 | Strengthen PWA/install behavior, deep links/direct routes, accessibility, resilient loading/empty/error states, and offline/degraded-state messaging. | Existing implementation retained; regression coverage required | Physical native flows require deferred device acceptance. |
| R45 | Preserve current design direction unless a requested redesign specifically targets it. | Existing implementation retained; regression coverage required |  |
| R46 | Published Schedule Change Acknowledgment Evidence: material shift changes, delivery and explicit acknowledgment, permissions and audit history; no payroll penalties. | Extended in 18.0.15 |  |
| R47 | Review deprecated dependency/install-script/build warnings and identify actual security or compatibility issues before modernization. | Extended in 18.0.15 | Three upstream advisory packages remain explicitly triaged; no zero-vulnerability claim. |

Detailed source references: [matrix JSON](mobile-implementation-18-0-15-matrix.json). New tests include handler and UI regressions, actual Firestore rules, desktop/mobile business flows, runtime identity, recovery fencing and dependency contracts.

Configured integration status remains unknown in readiness until verified from its authoritative status API; local configuration alone cannot establish service health.
