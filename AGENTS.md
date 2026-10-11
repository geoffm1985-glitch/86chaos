# Standing user instructions

## Local testing and GitHub Actions

- Always run tests and release gates locally on Geoff's computer.
- Always run Playwright and Play Store tests in a visible PowerShell window. Never run these tests in a hidden window or background scheduled task.
- Never use GitHub Actions unless Geoff explicitly authorizes GitHub Actions, including dispatches, reruns, and indirect triggers from pushes.
- Inspect workflow triggers before pushing. A general request to test, build an APK, publish a release, or push code does not authorize GitHub Actions.
- If local tooling is missing or execution is blocked, work toward a local solution instead of substituting GitHub Actions.

## APK Firebase target

- Every APK built or published for Geoff must use production Firebase project `cheers-34b8d`, production native Firebase registrations, and production API destinations.
- Testing website work never authorizes switching an APK to testing Firebase. Never publish a testing-Firebase APK.
- Verify the actual packaged Firebase resources, origin, API destinations, release version and retained signing certificate before publishing.
