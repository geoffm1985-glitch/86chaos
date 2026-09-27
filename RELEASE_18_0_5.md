# 86 Chaos 18.0.5 — Native Targeted Version-Fidelity Repair

18.0.5 preserves the 18.0.4 native system-bar and Android launcher-branding implementation unchanged.

The 18.0.4 targeted browser run exposed stale patch-number assertions in the mobile Playwright specs. Those specs now compare the deployed version with the current package version and remain valid across future 18.0.x patch bumps.

Only targeted mobile tests are authorized. No full Release Gate or full Play Store suite is run.
