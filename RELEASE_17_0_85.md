# 17.0.85 — Reviewed intelligence connections

Implemented on `testing` following Geoffrey's explicit “Implement” instruction for items 2, 3 and 4 of conversation `01a11a3f-9706-7173-ab80-f0679d56f5bc`. This authorization permits this implementation batch before the outstanding full certification; it does not waive certification or authorize a production/mobile release.

- Operational History consumes saved readiness categories, approved receiving quantities and classified error evidence. Managers explicitly save a daily readiness observation; private financial/system details are excluded.
- Smart Prep reads a bounded 112-day demand window. Daily Close totals are kept separate from item quantities. Authorized sales editors preview and match item-sales CSV rows, then explicitly approve a server-validated import. Stable source/line receipts prevent retries or changed dates from duplicating demand. Bulk/weight recipes require a separate serving conversion.
- Schedule Copilot compares recent same-weekday sales against configured role coverage. Evidence must be complete and fresh. Reviewed recommendations create unpublished drafts, retain availability/Request Off/role checks, respect known hour limits, and cannot overwrite existing published shifts.
- Repeated operational causes can open an evidence-linked HR onboarding checklist for manager review. No checklist is assigned until the existing HR form is submitted. Time Clock highlights long open or duplicate active punches for authorized manager review; it never edits punches or payroll.
- Purchasing verification exercises actual invoice approval, case/partial/catch-weight receiving, inventory cost and quantity, reviewed recipe yield, and downstream menu cost/margin, with duplicate, failure, cross-workspace and rollback checks.

Coverage includes new Node business/API tests, React review-component tests, transactional purchasing/costing tests, a real loopback Firestore emulator test, and desktop/mobile Playwright checks wired into targeted testing and the full Release Gate. Exact executed results are recorded in `docs/feature-status.json`.

Operational source coverage remains bounded: historical prep/waste/maintenance and alerts use the existing loaded sources; a complete 180-day archive is not implied. Clock review covers verified loaded punches from the last 14 days. Forecasts are conservative local calculations, not a trained predictive model. POS processing remains staged. Scheduled briefing prompts were not available to edit.

Full Play Store certification remains pending on this changed source. The previous 17.0.84 full run cannot certify 17.0.85; missing real-device/signing/push/POS/printer evidence remains required.
