# 86 Chaos 17.0.5

Release: Schedule Role Reconciliation and Release Gate Repair

Status: locally validated release candidate, NOT full Play Store certified.
The supplied 17.0.4 ZIP remains untouched. Its matching Git predecessor is
fef81f5f59754194102be17a45fcf60ac1bcd31e on testing.

## Findings and repairs

The supplied preflight stopped before tests because both deployed source hashes
were 6e4a3c4b002c0ed098de9e4474b4d732347c150cdaa5799ac5367b195049691e,
while the local manifest was
54acec0f7472f2bcf8dabb4a0c7b05413c678a358bcea7f6268f930d78ad9694.
All 825 local manifest files exactly matched both the uploaded ZIP and the
GitHub predecessor. Commit, testing branch, version, immutable deployment and
Firebase test project agreed. Vercel's stamp reported dirty:true. The old stamp
discarded its file list and dirty paths, so the supplied evidence cannot establish
which individual Vercel workspace changes produced the different hash. A claim
that the user simply configured the wrong deployment would be unsupported.

The repair binds the deployment manifest to Git's committed source tree and
independently rejects changed/missing build inputs (src, api, public, scripts,
package/lock and protected configurations) and extra untracked build inputs.
Platform-filtered non-runtime documentation cannot change the Git fingerprint.
Local certification still hashes actual tracked files, rejects dirty source,
refuses missing tracked files, and requires the correct commit and testing branch.
Text line endings are normalized consistently; binary assets retain byte hashes.
Generated directories, downloaded app/report ZIPs, build identity and environment
files are excluded. The expanded .gitignore prevents newly staged generated data.
No blanket index removal or source deletion is performed.

Preflight verifies protected hashes against local source, fetches both identities
from the immutable deployment, checks consistency with the discovery alias, and
reports its first concrete blocker. A production wrapper now actually executes
the mandatory source validator immediately after successful preflight. Its
regression runs the REAL preflight and REAL validator with fixture HTTP responses;
a wrong manifest starts zero tests. This transport fixture is not live deployment
certification. Missing mandatory/manual evidence and partial-run disqualification
remain enforced by the existing final collector.

Schedule findings:
- Copy Month (and Copy Week) dropped rosterRoleId and its snapshot. Copies now
  preserve the source shift's durable role fields across role renames.
- A whitespace snapshot hid a legitimate older role string. Fields are now
  trimmed before choosing a legacy name; unique current/history matches reconcile
  through the existing publication transaction.
- Client/server resolvers were separate implementations. Both now use one shared
  resolver with ID-first semantics and identical normalization.
- The client could omit an already-published legacy shift requiring role-ID repair
  while the server included it. The client now includes that normalization.
- An explicit scheduleRole/targetRole takes precedence over the employee's generic
  role on legacy records. Invalid explicit IDs never fall back to a name.
- Genuine missing/ambiguous roles remain blocked. The warning opens a review of
  specific employee/date/time/reason rows. A manager must explicitly select each
  role. The authenticated existing schedule endpoint saves only role metadata,
  revision and audit fields, checks exact prior content and role fields, rejects
  foreign tenants/stale records and active publication leases, and does not publish.
  The manager then taps Publish again. No direct Firestore editing is needed.

The two real shifts in the screenshot were not present as data records in the
attachments. Their IDs, saved role fields and configured role documents are not
visible in the screenshot. Consequently their exact individual classification
and actual production repair cannot be claimed. The confirmed source defects
above are repaired; the new review supplies the missing actionable detail if
those records still lack deterministic identity. No production data was modified.

Mobile microphone: replaces the 80px mobile bottom offset with 8px plus the
bottom safe area. The schedule has a reserved 72px-plus-safe-area voice strip
outside its scroll viewport, so the 56px touch target does not cover role labels,
shift cells or toolbar controls. Desktop/tablet geometry above 720px is unchanged.
Speech handling, permissions and microphone actions are unchanged.

## Validation actually executed

Counts below are per command; overlapping suites are NOT distinct additional tests.

| Command | Final result |
|---|---|
| npm ci --no-audit --no-fund --progress=false | PASS |
| npm run node:check | PASS |
| npm run lock:integrity | PASS |
| npm run validate:17.0.5 | PASS |
| npm run test:repair:17.0.5 | 15 PASS, 0 FAIL, 0 SKIP |
| npm run test:hostile:contracts | 49 PASS, 0 FAIL |
| npm run test:hostile:mutations | PASS; mutation report required by existing runner |
| npm run test:schedule-publish | 7 server + 8 client + 5 browser layout PASS |
| npm run test:mobile-voice-layout | 5 PASS, 0 FAIL |
| npm run test:pos-bridge | 54 PASS, 0 FAIL |
| npm run test:pos-bridge:emulator | 10 PASS, 0 FAIL |
| npm run test:schedule-publish:emulator | 12 PASS, 0 FAIL |
| npm run test:release:firebase | PASS: real Firestore/Storage rules, 10 POS and 12 schedule emulator tests |
| npm run test:release:recovery | 1 PASS, 0 FAIL |
| npm run test:release:scale | 5 PASS, 0 FAIL |
| npm run test:hostile | PASS |
| npm run test:server | 739 total: 734 PASS, 0 FAIL, 5 SKIP |
| npm run test:client -- --runInBand | 131 PASS, 0 FAIL; 20 suites |
| npm run syntax:api | PASS |
| npm run build | PASS; optimized production build |
| npm run test:play-store | BLOCKED: powershell executable absent in this Linux workspace |
| node scripts/verify-repository-safety.cjs | PASS |

Initial failures were retained in local logs and resolved: one incomplete employee
fixture, five stale release-version expectations, and the CRA CommonJS named-import
build incompatibility. The initial Storage rule check failed because the local
HTTP proxy closed the emulator-to-emulator Firestore lookup; it passed with proxy
variables removed for that local emulator process. No production rule was changed.
The first browser install through the CDN timed out; the same pinned browser was
installed from its upstream download and all five layout cases then passed.

The five broad-server skips require their emulator environment; their separate
emulator commands were executed. This does not make the full deployed gate pass.
A real Android Chrome/PWA check and the full Windows gate with the user's test
accounts remain required. No test-account passwords/admin credentials were supplied.
The real screenshot was inspected; no authenticated real-device workflow is claimed.

## Git and deployment

Source trees and required configs were checked before staging; generated files,
secrets, node_modules, test-results, reports, coverage and build output are excluded.
Protected firestore.rules, storage.rules, database.rules.json, firebase.json,
vercel.json and the project IDs/cron configuration remain unchanged.
The local testing commit is complete and clean, but it could not be pushed:
Git HTTPS had no authenticated username/credential, and the connected GitHub
create-tree API returned HTTP 403, Resource not accessible by integration.
No 17.0.5 deployment was created. origin/testing remains the predecessor
fef81f5f59754194102be17a45fcf60ac1bcd31e; local HEAD and origin/testing therefore
DO NOT match. The final local commit identity accompanies the ZIP in the delivery
message. The existing predecessor deployment was independently verified READY:
dpl_9gnJP8CbZ6qc3t8YKiGtEQG2UQLF, project prj_ObkHZiwik2abld9OkwUMbmJ9wN54,
https://86chaos-p1l26f67z-cheers-portal-s-projects.vercel.app . This is 17.0.4 evidence,
not a claim that 17.0.5 has been deployed or certified. This source report cannot contain its own final Git
commit hash without creating a new commit.

If installing the ZIP over the existing testing checkout, review source safety
before staging. Do not delete the repository or clear its index.

```powershell
git switch testing
npm run git:safety
git status
git add -A
node scripts/verify-repository-safety.cjs --staged
git diff --cached --stat
git diff --cached --name-status
git commit -m "Release 17.0.5: schedule publication and release-gate repair"
git push origin testing
git status
git rev-parse HEAD
git rev-parse origin/testing
```

Keep the existing test-account configuration. Set CHAOS_EXPECTED_VERSION to
17.0.5 wherever it already exists (process and .env.test.local must agree).
Use the existing testing alias; preflight resolves and verifies the immutable URL.
Wait until its deployment is READY for your exact commit before the full run.

```powershell
npm run test:play-store:failed
npm run test:play-store
```

Only the second, complete gate can certify this release. Failed-only, delta,
partial resume, isolated suites and the fixture preflight regression cannot.

## All changed or added source files

- .gitattributes
- .gitignore
- RELEASE_17_0_5.md
- RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1
- api/_pos-bridge-config.js
- api/_schedule-publish-core.cjs
- api/_schedule-publish-service.cjs
- api/_version.js
- api/customer-help-intelligence.test.cjs
- api/release-gate-execution-17-0-5.test.cjs
- api/release-gate-maturity-16-0-207.test.cjs
- api/release-gate-maturity-16-0-208.test.cjs
- api/release-gate-maturity-16-0-209.test.cjs
- api/release-gate-maturity-16-0-210.test.cjs
- api/repair-17-0-5.test.cjs
- api/schedule-publish-emulator-17-0-0.test.cjs
- api/schedule-publish.js
- package-lock.json
- package.json
- playwright.layout.config.cjs
- public/version.json
- scripts/86chaos-release-gate/preflight-and-start.cjs
- scripts/86chaos-release-gate/preflight-env.cjs
- scripts/86chaos-release-gate/source-identity.cjs
- scripts/stamp-build-identity.cjs
- scripts/validate-17-0-5.js
- scripts/verify-repository-safety.cjs
- src/App.js
- src/core/appCore.js
- src/core/customerHelpKnowledge.cjs
- src/core/customerHelpKnowledge.js
- src/core/rosterRoleIdentity.js
- src/core/rosterRoleIdentityCore.cjs
- src/core/schedulePdf.js
- src/features/schedule.jsx
- src/styles.css
- test-tools/certification/cost-performance-baselines.json
- test-tools/certification/groups.json
- test-tools/regressions/registry.json
- tests/layout/mobile-voice-17-0-5.spec.cjs
