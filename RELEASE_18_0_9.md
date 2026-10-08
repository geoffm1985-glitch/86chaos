# 86 Chaos 18.0.9

Fixes the Android preview notification repair failure reported on a signed-in phone. Native Android and iOS sessions now use their notification permission and native FCM registration APIs, rather than requiring the browser Notification API. Device tokens are saved through the existing authenticated self-repair endpoint and refreshed when the native SDK rotates them. Denied permission points to phone notification settings; missing native support and registration failures report their actual cause. Notification taps open only routes on the packaged app origin, and foreground notifications appear in the app.

Both native clients are registered only in the existing chaos-test-d1601 Firebase project. The Android package includes the testing Google Services configuration, FCM receiver/service, notification icon, and alert channel. iOS includes its testing Firebase configuration, APNs callbacks and entitlement; Apple distribution still requires provisioning and an APNs credential in Firebase.

The native bridge uses @capacitor-firebase/messaging 8.5.2 without loading its optional web implementation. Its optional Firebase peer is overridden to the existing web Firebase version, preserving the production-derived web SDK and emulator rules dependencies. Web notifications continue through the existing web messaging path.

Coverage executes the actual App repair handlers with Android/iOS native bridge responses, including no browser Notification API, denied permission, refreshed token, missing plugin, empty/stalled registration, secure-save failure, and signed-out/demo guards. Browser checks cover the native bridge permission/token lifecycle on Android Chromium and iPhone WebKit. Physical push delivery remains a device acceptance check.
