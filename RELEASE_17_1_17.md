# 86 Chaos 17.1.17 - Footer Version and Experimental Certification Repair

## Scope

17.1.17 is a narrow follow-up to 17.1.16.

- Shows **Version 17.1.17 • © 2026 Chilton App Works LLC** together at the bottom of the application.
- Keeps that footer identity reachable on desktop and mobile.
- Adds permanent Node release-gate coverage and Play Store browser coverage for the footer.
- Makes the existing full Play Store runner branch-aware so an exact immutable Vercel deployment from `experimental` can be certified without changing the default `testing` behavior.
- Preserves all 17.1.16 navigation, logo, desktop-fit, 86Voice, PWA naming, Firebase test-boundary, and workflow behavior.

## Certification policy

The full Play Store gate remains `npm run test:play-store`. Full certification still refuses production and requires exact source, commit, branch, Vercel deployment, testing Firebase, and protected-configuration identity.
