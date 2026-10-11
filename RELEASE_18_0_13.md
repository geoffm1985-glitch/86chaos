# 86 Chaos 18.0.13 production mobile preview

The downloadable APK uses production Firebase `cheers-34b8d`, production native registrations, origin `app.86chaos.com`, the production API and the matching mobile branch API for its four updated routes. Testing website deployments must never change the APK target.

The local production builder overrides inherited testing or emulator settings, verifies sealed source, and checks packaged Firebase resources, native target metadata, API origins, 16 KB alignment and retained signing identity. The former testing APK command refuses execution. Android versionCode is 180013.

Automated mutation tests continue on isolated local Firebase emulators. This downloadable preview is not Play Store certification; physical device acceptance remains separate.
