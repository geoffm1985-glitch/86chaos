# Local testing APK

Keep the mobile branch's default production configuration intact. The testing
build recipe temporarily overlays Android Firebase, the local WebView hostname,
and the app label, and restores the source files even when the build fails.
Both native API destinations and browser Firebase are fixed to testing for this
build. The output is labeled **86 Chaos Testing**.

Run locally in a visible PowerShell window from a clean, committed mobile branch:

```powershell
$env:ANDROID_HOME = 'C:\path\to\android-sdk'
$env:JAVA_HOME = 'C:\path\to\jdk-21'
$env:CHAOS_PREVIEW_KEYSTORE = 'C:\path\to\retained-preview.keystore'
node scripts/build-testing-apk.cjs
python scripts/verify-native-push-apk.py .cache/testing-apk/86Chaos-18.0.12-testing-preview.apk --testing
```

Before publishing, verify the APK with Android's `apksigner verify --print-certs`
and compare its certificate with the retained preview key. Keep the APK and its
SHA-256 file together. Publish as a new GitHub prerelease targeting the exact
mobile commit, using a distinct testing tag; never replace a previous APK.

The build runs Android compilation, JVM unit tests, lint, ZIP alignment and 64-bit ELF LOAD/RELRO alignment checks locally. Run `python scripts/test_apk_elf_alignment.py` to exercise the binary checker regression cases. Run the
mobile foundation unit checks and browser checks in visible PowerShell too.
Browser bridge checks do not replace physical-device verification of the APK.

Use `[skip actions] [build-only]` on pushed commits. Inspect workflow triggers
before every push; GitHub Actions is not part of this local build procedure.
