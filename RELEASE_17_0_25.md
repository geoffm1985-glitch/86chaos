# 86 Chaos 17.0.25

## Schedule Surface Runtime Recovery and Firebase Auth Gate Repair

17.0.25 repairs two confirmed 17.0.24 failures without changing Firebase projects, credentials, permissions, or production data.

### Runtime repair

- Schedule Builder and Request Off now normalize legacy/restored roster, shift, event, availability, and Request Off data before those surfaces sort or render it.
- Non-string legacy names, roles, times, dates, identity fields, and availability windows are converted to safe display/runtime values instead of reaching string operations that can throw during render.
- Schedule Builder receives sanitized props even when its parent has older mixed-shape data, and Request Off independently repeats the safety boundary rather than trusting callers.
- Unsafe direct roster-name comparators in the schedule workbench were replaced with string-safe comparisons.

### Release-gate repair

- The release gate no longer sends Playwright browsers to the random immutable Vercel hostname that Firebase Auth rejects by HTTP referrer policy.
- Certification still pins the exact immutable Vercel deployment URL and deployment ID.
- Before Playwright starts, preflight verifies that the approved stable testing alias resolves to the same deployment ID, source manifest, and application version as the immutable candidate.
- After that proof, browser/API tests use the stable testing alias so Firebase Auth sees the approved referrer. A stale or mismatched alias fails once before Playwright instead of generating hundreds of cascading login failures.

### Certification

17.0.25 is repaired but not certified here. Full certification still requires the complete deployed `npm run test:play-store` gate under Node 24 against the exact testing candidate.
