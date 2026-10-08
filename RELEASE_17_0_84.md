# 86 Chaos 17.0.84 - Owned Full-Gate Fidelity Repair

The first owned 17.0.83 full gate completed Playwright execution and exposed four distinct certification failures: Ghost Request Off conflict selection failed on both Chromium projects, the desktop export/import audit fell back to the login surface, the stale-chunk test sampled the intentional one-shot reload between documents, and runtime coverage attempted to switch from Owner to System Administrator by clearing cookies even though Firebase Auth persisted the Owner session.

17.0.84 makes only narrow QA/certification repairs backed by that evidence:

- the disposable QA restaurant explicitly disables Request Off cutoff policy so the seeded next-day conflict remains selectable for the conflict/cancel workflow; production Request Off policy behavior is unchanged;
- the export/import audit may recover exactly one transient emulator login handoff, then fails closed if authentication drops again;
- the chunk-resilience test accepts either the visible recovery action or a healthy app after the designed one-shot navigation, while retaining the one-reload ceiling and fatal-blank protections;
- runtime coverage now uses the shipped Log Out flow, verifies the signed-out state survives reload, logs in the verified System Administrator account, and proves godmode is not permission-gated before scoring coverage;
- targeted Node, Play Store/release-gate Playwright, and independent Playwright regressions pin all four captured failure modes.

The saved fullFirstComplete checkpoint is false, so the next Yardmaster run must be RUN full.

No production push is authorized by this build.
