# 86 Chaos 18.0.10

Android now uses a transparent, borderless 86 Chaos foreground on a dark adaptive launcher background. The logo occupies more of the visible launcher icon, and the phone supplies the outer shape. Android 7 retains branded legacy fallback resources. The generated foreground preserves the existing copper/silver wordmark and removes the embedded frame and surrounding padding.

The two GitHub alerts on native Firebase SDK configuration were investigated against the live testing project. These are Firebase-generated client keys with Firebase-related API restrictions, not administrator credentials. Anonymous private Firestore reads were denied, and Android/iOS Firebase Installations registration remained functional. No key rotation, source hiding, or authorization relaxation was needed.

The native notification integration and complete production 17.0.84 baseline remain included. This is a preview using the testing Firebase project. Launcher presentation on the Samsung device remains a physical-device acceptance check after installation.

This release also corrects preview signing retention. Earlier builds cached a path that did not contain AGP's generated key, and their ephemeral signing keys were lost after each CI job. A new stable preview key is stored as an encrypted GitHub Actions secret, explicitly selected by Gradle, and checked against the compiled APK certificate. Installing over an earlier preview therefore requires one uninstall/reinstall; subsequent previews can retain the new signing identity. Sync pending changes before uninstalling because uninstall removes local app data. This key is for previews and is separate from future Google Play production signing.
