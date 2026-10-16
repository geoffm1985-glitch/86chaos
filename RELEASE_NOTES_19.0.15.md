# 86 Chaos 19.0.15 — nonlocking authoritative schedule reads

Schedule ID/week verification now uses read-only Firestore transactions, preserving a consistent snapshot without taking mutation-blocking read/write locks. Atomic editing, concurrency guards, tenant/privacy boundaries and browser assertions remain unchanged. Real Firestore controls reproduced blocking before repair; new regressions verify concurrent writes and consistent reader revisions.

19.0.14 passed deployed targeted validation but local validation timed out in three Edge workflows. Original failures and cleanup proofs are preserved. Fresh scoped preflight, signed production-Firebase APK, exact testing deployment, local/deployed targeted and canonical delta acceptance remain required. Native backend/device acceptance is deferred; no production deployment or full gate.
