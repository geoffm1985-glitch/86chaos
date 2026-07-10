# 86 Chaos 15.0.49 QA Checklist

## Automated checks completed

- [x] All Vercel API JavaScript files pass `node --check`.
- [x] All source JavaScript/JSX files parse with the TypeScript JSX parser.
- [x] All JSON files parse successfully.
- [x] Version strings agree across `package.json`, `functions/package.json`, `public/version.json`, and `src/core/appCore.js`.
- [x] Backend invoice and menu default limits are 40 and 10 pages.
- [x] Image page-count logic returns one page.
- [x] One-page PDF fixture returns one page in the page-count test harness.
- [x] Multi-page PDF fixture returns the correct total in the page-count test harness.
- [x] Unsafe/unreadable PDF fixture is blocked before reservation.
- [x] Non-exempt invoice request that would exceed 40 pages is blocked.
- [x] Non-exempt menu request that would exceed 10 pages is blocked.
- [x] Blocked requests do not consume pages.
- [x] Blocked events record `wouldHaveExceededLimit: true`.
- [x] Verified Master Admin request can process pages above the normal limit.
- [x] Master Admin bypass leaves normal customer usage unchanged and increments `exemptPagesProcessed`.
- [x] Master Admin event records `limitBypass: true`, `bypassReason: master_admin_testing`, and the correct over-limit flag.
- [x] Reusing an idempotency key does not double-count pages.
- [x] Pre-AI reservation cancellation restores the page and scan counters and removes the submitted event.
- [x] AI-called failure remains counted, changes the event to failed, and redacts sensitive error content.
- [x] Frontend zero-page Super Admin override remains zero rather than falling back to the default.
- [x] Frontend close-to-limit and reached-limit messages return the expected wording.
- [x] Backend and frontend invoice classifiers agree on food, non-food, review, and document fixtures.
- [x] Chicken wing, steakhouse salad, and buttermilk distributor rows are recovered into Stock Matcher even with incorrect AI row types.
- [x] Deli paper, nitrile gloves, sanitizer, and plastic cups are automatically separated as non-food.
- [x] Invoice total, tax, freight, address, and contact rows remain out of review.
- [x] The full invoice extraction audit remains intact.
- [x] Firestore rules contain explicit server-only `aiUsage` protection and exclude it from the generic fallback rule.
- [x] Health Dashboard route manifest includes `/api/ai-usage`.
- [x] ZIP integrity check passes.

## Manual testing required in `chaos-test-d1601`

### Page counting and enforcement

- [ ] Scan a one-page invoice PDF and confirm usage increases by 1.
- [ ] Scan a multi-page invoice PDF and confirm usage increases by its actual page count.
- [ ] Scan an invoice image and confirm usage increases by 1.
- [ ] Scan a menu image and confirm menu usage increases by 1.
- [ ] Set a testing workspace invoice limit below current usage and confirm a normal non-exempt user is blocked before Gemini runs.
- [ ] Set a testing workspace menu limit below current usage and confirm a normal non-exempt user is blocked before Gemini runs.
- [ ] Confirm the configured Master Admin can scan above each limit.
- [ ] Confirm the Master Admin event shows the testing bypass fields in System Administrator.
- [ ] Double-click or rapidly click the menu scan action and confirm only one reservation/event is created.
- [ ] Upload an invalid file and confirm no pages are consumed.
- [ ] Force a Gemini failure after submission and confirm pages remain consumed and the event is marked failed.

### Invoice classification

- [ ] Rescan the invoice that contained chicken wings, steakhouse salad, and buttermilk and confirm all appear in Stock Matcher.
- [ ] Confirm obvious non-food supplies appear under Non-food instead of Needs Review.
- [ ] Confirm tax, totals, freight, addresses, and contact details appear only in Raw Audit.
- [ ] Confirm an uncertain purchased item remains under Needs Review.
- [ ] Confirm Approve & Update Stock stays disabled until all food/product rows are matched or marked Add as New and Needs Review is empty.

### System Administrator

- [ ] Open AI Usage / Scan Limits on desktop and mobile.
- [ ] Confirm every workspace is listed even before its first scan of the month.
- [ ] Change invoice and menu limits as Super Admin and confirm the values persist.
- [ ] Confirm normal users have no control for bypassing or changing limits.
- [ ] Confirm recent events show completed, failed, blocked, and bypass records accurately.

## Deployment requirements

- [ ] Add/confirm `FIREBASE_TEST_SERVICE_ACCOUNT_KEY` in Vercel Preview.
- [ ] Add/confirm the production Firebase Admin credential in Vercel Production before production release.
- [ ] Add/confirm `MASTER_ADMIN_EMAIL` and/or `MASTER_ADMIN_EMAILS` in the relevant Vercel environments.
- [ ] Deploy 15.0.49 to the testing branch.
- [ ] Publish the included `firestore.rules` to `chaos-test-d1601`.
- [ ] Complete manual QA before promoting to production.
- [ ] Publish the same `firestore.rules` to production when 15.0.49 is promoted.

## Build limitation

The complete React production build could not be run in the artifact environment because dependency installation timed out before `react-scripts`, `firebase-admin`, and `pdf-lib` became available. This is recorded as an environment limitation, not reported as a successful build. Syntax, JSX parsing, JSON parsing, focused classifier tests, focused page-limit transaction tests, and ZIP validation were completed separately.
