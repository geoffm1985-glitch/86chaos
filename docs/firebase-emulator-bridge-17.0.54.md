# 86 Chaos 17.0.54 Firebase Emulator Bridge

## Yardmaster target interface

LIVE remains the normal default. Yardmaster selects local Firebase by launching 86 Chaos with:

`REACT_APP_86CHAOS_FIREBASE_TARGET=emulator`

Emulator project: `demo-86chaos`. Default host: `127.0.0.1`.

Optional host: `REACT_APP_86CHAOS_FIREBASE_EMULATOR_HOST=127.0.0.1`.

Optional ports: Firestore 8080, Authentication 9099, Functions 5001, Realtime Database 9000, Storage 9199. The Firebase Emulator UI uses port 4000.

## Supported locally

Firestore, Firebase Authentication, Firebase Functions, Realtime Database and Cloud Storage use official Firebase emulators. Existing Firestore, Storage and RTDB rules plus Firestore indexes remain authoritative.

## Fail closed

EMULATOR mode uses `demo-86chaos`, refuses non-loopback hosts, connects before app rendering, and does not fall back to `chaos-test-d1601` or `cheers-34b8d`.

## Live verification still required

FCM push delivery, App Check enforcement, MFA fidelity, Google Cloud IAM, Vercel deployment identity/configuration, native Firestore backup Google APIs, cloud networking, non-emulated Google services and third-party APIs remain LIVE verification items.
