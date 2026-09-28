# 86 Chaos 17.0.48

## Emergency Schedule Publish Permission Repair

17.0.48 is the passing-candidate successor to 17.0.47 and remains based on the production 17.0.33 source, not the newer testing feature line.

The application repair is unchanged: Schedule Publish no longer issues legacy `workspaceId`-only candidate queries that Firestore cannot authorize under the existing `shifts` rule. The two authoritative `restaurantId`-scoped reads remain, along with the fail-closed guarantee that no shifts are changed when candidate verification fails.

The first 17.0.47 targeted CI attempt proved the Node regression passed, then stopped before the Firestore test because the current Firebase CLI requires Java 21. 17.0.48 adds Java 21 setup to that testing-only targeted workflow and changes no additional restaurant behavior.

Verification remains limited to the emergency fix:
- source regression for the exact query contract;
- Firestore emulator proof for allowed tenant queries and denied legacy/cross-tenant queries;
- one Release Gate / Play Store spec on Chromium and mobile Chromium.
