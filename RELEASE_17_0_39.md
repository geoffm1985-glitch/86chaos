# 86 Chaos 17.0.39

This is one combined testing release. It includes the stale capability-test repair, certification hardening, security and Firebase diagnostics, and the restaurant-intelligence feature batch. It is not a repair-only release.

## Release integrity

- Capability-retention tests validate capabilities, not a frozen historical patch version.
- Exact current version remains enforced by the current-release validator and build/deployment identity endpoints.
- Certification rejects stale source, deployment, run artifacts, or uncertain Firebase environment identity.
- Full-gate truth requires Playwright to start and finish; retries, timeouts, interruption, and Windows exit codes are recorded distinctly.

## Security and robustness

- Security Center reports MFA, App Check, rules, permission, environment, credential, OAuth-state, backup, and deployment-identity posture without secret values.
- Tokens, passwords, API keys, authorization/cookie material, OAuth credentials, service-account values, and private keys are redacted.
- Firebase observability is aggregate-only and reports listener reuse, duplicate/abandoned listeners, read amplification, repeated fallbacks, writes, no-op avoidance, RTDB/presence state, and route cleanup.
- Backup state is healthy only with fresh verified evidence. Failed, stale, unverified, and unknown remain explicit. Restore is never automatic.

## Restaurant intelligence

- Manager Brief and Restaurant Readiness share one deterministic needs-attention engine with stable IDs, evidence, freshness, completeness, confidence, permissions, and review actions.
- Restaurant Readiness covers Inventory, Prep, Staffing, Maintenance, Food Safety, Financial, Operations, and System.
- The connected graph relates menu, recipe, ingredient, inventory, vendor/product, invoice/receiving, current cost, yield, par, allergen, substitutions, case packs, and 86 risk while reporting missing links.
- Smart Prep distinguishes a predicted zero from insufficient evidence and requires human review.
- PO/receiving/invoice reconciliation handles exact matches, partials, backorders, substitutions, catch weight, split cases, price/quantity variance, missing receiving, low confidence, and duplicate suspicion without automatic payment, ordering, accounting posting, or ambiguous inventory mutation.
- Operational History derives bounded, tenant-filtered trends and training opportunities from existing operating evidence.

## Test coverage

New current-release targeted suites cover release identity, stale evidence, Playwright truth, redaction, permissions, backup states, listener lifecycle/cost, needs-attention, Readiness 2.0, graph relationships, Smart Prep, purchasing reconciliation, and Operational History. New full-gate browser specs 48–52 exercise the deployed authenticated UI, role boundaries, desktop/mobile behavior, deep links, diagnostics, and route cleanup.
