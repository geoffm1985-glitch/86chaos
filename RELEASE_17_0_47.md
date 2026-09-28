# 86 Chaos 17.0.47

## Emergency Schedule Publish Permission Repair

This is a production-baseline emergency hotfix. It starts from the production 17.0.33 source and does not carry forward the newer testing-branch feature line.

The Schedule Builder publish review was issuing four authoritative candidate queries per selected day. Two used the canonical `restaurantId` tenant field and two legacy fallbacks used only `workspaceId`. The current Firestore `shifts` read rule authorizes tenant reads through `resource.data.restaurantId`, so a normal owner or manager cannot prove authorization for a `workspaceId`-only collection query. Firestore therefore rejects that fallback query with `Missing or insufficient permissions`, stopping publication before any shift changes are made.

17.0.47 removes only those two rules-incompatible legacy fallback reads. The canonical `restaurantId + date` and `restaurantId + scheduleDateKey` authoritative queries remain, as does the existing fail-closed behavior that makes zero shift changes if candidate verification fails.

Targeted coverage added for this repair only:
- Node source regression proving the publish helper contains only the two authorized tenant-scoped reads.
- Firestore-emulator regression proving those two queries succeed for the tenant manager while the former `workspaceId`-only query is denied.
- Release Gate / Play Store regression for the exact query/rules contract.

No production branch changes are made by this candidate. It is staged to the `testing` branch for verification first.
