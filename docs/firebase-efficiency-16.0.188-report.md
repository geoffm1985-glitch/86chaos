# Firebase Efficiency 16.0.188 Before / After Report

All figures are application-level read/write indicators, not Firebase billing numbers.

| Area | 16.0.187 baseline | 16.0.188 candidate | Label |
|---|---:|---:|---|
| Presence connect mutations | 2 writes: active session + online statusSummary | 1 active-session write | MEASURED by source/test |
| Presence disconnect mutations | 1 session removal + 1 Last Seen summary | 1 session removal + 1 Last Seen summary | MEASURED by source/test |
| Two-device presence | online could be hidden by client freshness cutoff | online while any active status session exists | MEASURED by behavior test |
| Team quick tab bounce | 1 API fetch per mount risk | 0 repeat API fetch within 45s cache | MEASURED by helper test |
| Today max initial docs | 510 bounded snapshot docs | 319 bounded snapshot docs | MEASURED by demand plan |
| Today active listeners | 0 for Today summary datasets after 16.0.187 | 0 retained | MEASURED by source/test |
| Reminder idle requests over 10 minutes | 0 automatic 90s polling after 16.0.186 | 0 retained | MEASURED by existing tests |
| PAR two-digit typing | 0 writes while typing, 1 on commit | retained | MEASURED by existing tests |
| Current user permanent listener | 1 canonical listener after resolution | retained | MEASURED by existing tests |
| HR Overview | aggregate count calls, detail records gated | retained | MEASURED by existing tests |
| Menu initial dependency docs | possible App-level 500 dependency query | 0 App-level dependency docs; feature loads on demand | MEASURED by source/test |
| Menu page 2 scans | reread page 1 by increasing limit | 20 incremental reads via cursor page | MEASURED by pagination helper |
| Audit Log page 1 then 2 | 50 + 50 cursor pages after 16.0.187 | retained | MEASURED by existing tests |
| My Schedule legacy rescue | matching legacy row could truncate after 120 broad rows | identity merge/paged fixture sees legacy row beyond 120 | MEASURED by helper test |

Deferred: full Firebase billing impact and Vercel browser behavior are not measurable in the local sandbox.
