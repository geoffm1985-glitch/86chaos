# 86 Chaos 18.0.0 — Native Mobile and Firebase Cost Foundation

## Baseline

18.0.0 starts from the exact READY Vercel deployment of testing 17.0.42:

- branch: `testing`
- version: `17.0.42`
- commit: `e35079bccabb967b5a637b8faa6f40b5f0af2e31`

The native work is isolated on the `mobile` branch. Testing, experimental, and production are not modified by this release line.

## Android and iPhone/iPad parity

Android and iOS are equal product targets. A mobile behavior is not complete until the applicable Android and iOS behavior has corresponding regression coverage, unless an explicit platform-specific exception is approved.

The shared Capacitor application identity is `com.chiltonappworks.chaos86`. Packaged assets come from the existing React `build` output; no remote production URL is embedded in the native configuration.

## Firebase cost policy

18.0.0 reuses the testing Firebase project `chaos-test-d1601`. It does not create a separate Firebase project or add a paid caching/database service.

The app already has persistent Firestore browser cache, shared listener reuse, hidden-page pause behavior, route listener cleanup, no-op write diagnostics, and low-cost RTDB presence. 18.0.0 adds native-runtime awareness so an installed Android/iOS app that is backgrounded shortens zero-subscriber Firestore listener retention to 15 seconds while preserving cached data for fast resume.

This is intentionally bounded rather than immediate. Very short app interruptions do not instantly force a full listener reconnect, while genuinely backgrounded sessions stop consuming live listener traffic far sooner than the normal adaptive web grace window.

## Native packaging status

Capacitor 8.5.2 is now installed for core, Android, iOS, and CLI. Both native projects have been generated from the same React build with Android package ID and iOS bundle ID `com.chiltonappworks.chaos86`. Android and iOS native release identities are aligned to 18.0.0 / build 180000.

The generated native projects intentionally do not commit copied React build output. Native builds must run the web build and Capacitor sync step before packaging. No signing key, Apple credential, Google Play credential, Firebase service account, or other secret belongs in Git.

## Distribution

The public marketing-site download foundation lives separately on the `download` branch of `86chaos-website`. Its Android and iPhone/iPad buttons remain disabled until real signed artifacts or store/TestFlight destinations exist.

## Tests added

- `api/mobile-native-foundation-18-0-0.test.cjs`
- `tests/86chaos-release-gate/58-native-mobile-cost-foundation.spec.cjs`
- `scripts/validate-18-0-0.js`

Real Android and iOS native-device certification remains mandatory before a public native release.
