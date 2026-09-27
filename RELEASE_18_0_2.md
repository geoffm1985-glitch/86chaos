# 86 Chaos 18.0.2 — Native Targeted Test Fidelity Repair

18.0.2 is a mobile-branch test-fidelity patch. It preserves the 18.0.1 native API bridge and Firebase testing-only behavior.

The previous targeted test referenced `pkg.version` in a scope where `pkg` had not been declared. This patch fixes that test defect and aligns Android/iOS/native release identities to 18.0.2 / build 180002.

Only targeted mobile tests are authorized for this branch. The full Release Gate is not part of this run.
