# Native Firebase client configuration

`android/app/google-services.json` and `ios/App/App/GoogleService-Info.plist` are Firebase client SDK configuration for production project `cheers-34b8d`. Their API keys identify the client project; they are not service-account keys, Admin credentials, or user authentication tokens. The SDK configuration is included in the compiled app and is intentionally public.

Google permits this configuration in source when the keys are restricted to Firebase-related APIs. The production Android and iOS keys were verified to have API restrictions, including the Firebase Installations and FCM Registration APIs required by native messaging, and to exclude the Generative Language API. Never reuse a Firebase client key for a non-Firebase API or add that API to its allowlist. Use a separate appropriately protected credential for such services.

Data authorization remains enforced by Firebase Security Rules and authenticated server endpoints. Possession of a client key must not grant access to another user's or restaurant's data. Native messaging uses its platform configuration; browser authentication and data access use a separate browser key. Deleting the native configuration would break native registration without removing the key from already distributed apps or Git history.

Android application restrictions must use the certificate of the actual distributed APK, and future Google Play signing may use a different identity from preview signing. Never substitute a local debug certificate for the retained CI preview certificate. API restrictions and app restrictions must preserve legitimate Android and iOS registration.

Reference: https://firebase.google.com/docs/projects/api-keys
