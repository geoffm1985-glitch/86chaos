# 86 Chaos 17.0.82 — Failed+New Lineage Fidelity Repair

This build repairs the two remaining failures reported by the 17.0.81 failed+new rerun while preserving the completed full-gate failure lineage.

The repairs are deliberately limited to certification/test code:

- The historical 17.0.77 server-certification Playwright test now checks the exact escaped `saveLanguagePreference(page, 'es')` assertion text that exists inside the nested Node regression source. The previous matcher treated nested regex source text as if it were executable syntax and therefore failed even though the underlying Spanish regression remained intact.
- The Request Off identity regression now uses the QA seed's calendar anchor for its conflict assertion. In the 2026-10-04 seed, `currentWeekStart` is 2026-09-28 while Allen QA's approved conflict is 2026-10-03. Freezing Schedule Builder at 2026-09-28 correctly opens the September monthly publishing window and cannot display the October conflict. Coverage-warning tests retain the September week anchor because their seeded over-coverage evidence lives there.
- Production scheduling, Request Off matching, Firestore queries, and warning generation are unchanged.
- Adds targeted Node, Play Store/release-gate Playwright, and independent Playwright regression coverage for both exact failed+new failures.

The saved fullFirstComplete checkpoint and failure lineage remain intact. This build is intended for the next Yardmaster failed+new/delta rerun, not an automatic production deployment.

No production push is authorized by this build.
