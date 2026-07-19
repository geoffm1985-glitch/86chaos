# 86 Chaos 15.0.77 Release Notes

## Auth Network Login Hotfix

This release is based on the uploaded production source ZIP `86chaos_15_0_76_event_push_reminder_delivery_fix_app_only(1).zip`.

### Fixed
- Fixed Firebase project selection on Vercel Preview/local hosts so preview builds default to the test Firebase project.
- Stopped the app from treating generic `REACT_APP_FIREBASE_PROJECT_ID` as a deployment-mode override. That generic variable can accidentally point a preview build at the wrong Firebase browser API key.
- Added login submit locking so repeated clicks cannot stack dozens of Firebase sign-in attempts.
- Added a 25-second login timeout instead of leaving the user staring at a dead button.
- Improved the displayed Firebase Auth error so the active Firebase project and browser host are visible when network/referrer problems happen.
- Synced the app, public version file, root package, and Functions package versions to `15.0.77`.
- Added deterministic Vercel install/build settings and a root package lockfile.

### Not Changed
- Firebase service-account-key handling was not changed.
- Firestore rules, Storage rules, API authorization, push/reminder logic, and production data structure were not changed in this narrow hotfix.

### Important Deployment Note
- Production custom domains still select production Firebase.
- Vercel Preview and localhost select test Firebase unless `REACT_APP_FIREBASE_DEPLOYMENT_MODE` or `REACT_APP_FIREBASE_ACTIVE_PROJECT_ID` explicitly overrides it.
