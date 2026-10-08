# 86 Chaos 17.0.54

## Precision Firebase Emulator Bridge

This testing release adds an explicit fail-closed Firebase runtime target.

- LIVE remains the default and keeps existing behavior.
- EMULATOR uses demo project `demo-86chaos`.
- Firestore, Auth, Functions, RTDB and Storage use official local emulators.
- Browser startup verifies the local services and never silently falls back to live Firebase.
- Release-gate Firebase clients, fixture seed/cleanup, Admin SDK, presence and secondary tenant Auth share the same target.
- Existing Firebase security rules and indexes remain in force.
- FCM, App Check, MFA fidelity, IAM, Vercel identity and other cloud-only boundaries remain LIVE verification.
- Production is not deployed by this release.
