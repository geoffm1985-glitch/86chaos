# Yardmaster local Firebase bridge (17.0.57)

`yardmaster.firebase.json` is the schema-1 entry point Yardmaster reads at the
86 Chaos repository root. It reuses `firebase.json`, the existing rules/indexes
and Functions source, and all five emulators under `demo-86chaos`.

Install root dependencies, Functions dependencies and Chromium once:

```powershell
npm ci; npm --prefix functions ci; npx playwright install chromium
```

Java 21 must be available for the Firebase CLI. Select Emulator in Yardmaster;
Yardmaster owns emulator startup and teardown. Its `start:yardmaster` command
requires an explicit emulator target, translates the pinned target and service
ports into CRA environment variables, and starts the app at
`http://127.0.0.1:3000`. Repaired source reloads through CRA.

The local dev middleware applies a browser connection policy permitting only
the app and loopback services. `/api/firebase-target` returns 503 until a real
headless browser has loaded the bundled app, connected all five SDK clients and
passed fresh availability checks. Its successful response contains the actual
demo project, connected products and `blockLiveFirebase: true`. An unavailable
emulator clears readiness; no cloud fallback is selected. The observer requires
the installed Chromium browser and runs only in the Yardmaster local launcher.

Full and delta retain `test:play-store` and `test:play-store:delta`. The bridge's
Playwright command uses the complete Play Store Playwright inventory. Those
commands are opt-in and are not invoked by the focused regression runner.
The bridge deliberately omits optional `liveVerification`: Yardmaster's Both
mode with Verification Only continues to block until a separate genuine cloud
verification command is implemented and authorized.

Run only the focused regressions independently of Yardmaster:

```powershell
npm run test:firebase-emulator-bridge
```

This runs the four bridge/import Node regression files, starts the real five
local emulators, starts the local app, runs only spec 69 on desktop and Android
Chromium, then shuts the owned services down. The root bridge/schema case is
also included in the full release-gate inventory; its local browser case applies
only to emulator runs. The regression registry and critical inventory retain
both cases for future gate runs.

`npm start`, production builds, production Firebase identifiers and Firebase
rules keep their existing behavior. The Yardmaster middleware is not bundled
into the production application. Cloud-only verification limits from
`firebase-emulator-bridge-17.0.54.md` still apply.
