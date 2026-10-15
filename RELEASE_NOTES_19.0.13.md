# 86 Chaos 19.0.13 — Phase 1 informational-dialog validation repair

The local browser suite exposed a race between the explicit welcome-tour Skip handler and its generic modal-close helper. The helper now freezes the original modal and control identity, verifies removal of that original modal, and reevaluates any remaining dialogs. A pending close cannot target a replacement scheduling confirmation. Blocked controls and unknown action failures remain fatal.

Five actual Chromium regressions cover concurrent dismissal, ordinary closure, replacement confirmation protection, a blocked original control and unknown errors after closure. Scoped preflight passed 121 Node checks, 21 React tests and the real Firestore integrity scenario, with isolated emulator shutdown. All existing scheduling, persistence and warning assertions remain unchanged.

19.0.12 passed deployed targeted validation but failed local helper cases. This candidate requires fresh exact-source deployed/local targeted and canonical delta acceptance. APK packaging retains production Firebase, destinations and signing; native backend/device acceptance remains pending. Testing web/API stays isolated. No production deployment, GitHub Actions, Phase 2 advancement or full gate is authorized by this release.
