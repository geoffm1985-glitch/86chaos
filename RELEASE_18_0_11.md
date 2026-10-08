# 18.0.11 production mobile preview

The Android microphone now uses the web app's 44px bottom spacing inside the already inset native content area. Android no longer adds the system-bar safe area twice. Browser and iOS safe-area behavior is preserved.

The packaged app connects to the production Firebase project `cheers-34b8d` and `https://app.86chaos.com` APIs. Matching Android and iOS Firebase app registrations use `com.chiltonappworks.chaos86`. Auth, Firestore, Storage, Realtime Database presence, Functions, and native FCM tokens use production. Automated mutation checks continue to use local Firebase emulators; local browser tests retain the existing testing-host isolation.

Install over 18.0.10 with the retained preview signing key. Sign in using the same production account used on the web app. Testing accounts and testing data are separate and are not migrated. Actions in this preview affect live production data.

This remains a preview APK, with automated coverage only. Real-device notification delivery and Apple provisioning remain separate acceptance checks.
