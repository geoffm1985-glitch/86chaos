# 86 Chaos 18.0.1 — Installable Native API Bridge Preview

18.0.1 advances the isolated `mobile` branch from the tested 18.0.0 native foundation.

## Why this patch exists

A packaged Capacitor app serves its React assets from an internal device server. Relative calls such as `/api/whoami` would otherwise hit that internal asset server instead of the 86 Chaos Vercel API.

18.0.1 keeps packaged assets local but routes only same-origin `/api/*` traffic through CapacitorHttp to `https://testing.86chaos.com`. Firebase browser SDK traffic is not intercepted, so the native WebView retains the authorized testing origin and the existing testing Firebase project.

## Platforms

The same bridge is used on Android and iPhone/iPad. Android is version 18.0.1 / 180001 and iOS is marketing version 18.0.1 / build 180001.

## Android website preview

The mobile targeted workflow can create a prerelease APK only when an intentional commit contains `[android-preview]`. Its preview debug signing key is cached privately in GitHub Actions so later preview APKs can update the existing preview installation. This is not the future Google Play production signing identity.

No new paid service or Firebase project is introduced.
