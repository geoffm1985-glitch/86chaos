# 86 Chaos 18.0.12 Android preview

Mobile includes the complete testing branch through 17.0.86, commit a69e646e048664b874ec6d260c4fa864f1e99aea. It retains the installed app ID, production Firebase accounts and preview signing certificate so the new APK can upgrade 18.0.11.

Schedule PDFs use Android's document picker to save actual PDF bytes. CSV/JSON/manual exports use that same path. Reports, calendars, login sheets and the training manual use Android printing. 86Voice uses the Android recognition service with runtime microphone permission, partial/final transcript handling, session isolation and cancellation. Location permissions enable geofenced clock-in. Device reminders have a native notification plugin, and reminder sharing opens Android's chooser. Native API uploads preserve multipart file bytes.

The four API routes changed since production 17.0.84 use the matching mobile branch backend, which verifies the same production Firebase ID tokens. Other APIs retain app.86chaos.com. The testing and main website deployments are not promoted by this mobile release. No service credentials or protection bypass tokens are embedded in the APK.

The mobile CI gate runs preserved foundation checks, imported feature regressions, Firebase emulator checks, PDF/voice client tests, Chromium/WebKit checks, and actual Android instrumentation. Android instrumentation uses a deterministic recognition service installed only in the test APK; it verifies the real speech binding and bridge but does not certify acoustic accuracy on physical devices. APK publication requires a ready production credential configuration and matching backend version, a source identity match, native plugin verification and the retained signing certificate.

Physical-device microphone/audio accuracy, vendor document providers, camera hardware and closed-app notifications still require device validation. This remains a downloadable preview, not Play Store certification.
