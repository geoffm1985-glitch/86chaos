# 86 Chaos 18.0.3 — Native Targeted Test Patch-Safety Repair

18.0.3 changes no mobile product behavior beyond release identity.

The targeted native bridge test previously retained escaped 18.0.1 literals after later version bumps. It now derives Android and iOS native identity expectations from the current package and native platform contract, preventing stale patch-number failures.

Only the targeted mobile workflow is authorized. No full Release Gate or full Play Store suite is run.
