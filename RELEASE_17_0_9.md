# 86 Chaos 17.0.9

Release: Request Off Runtime and Release Gate Identity Repair

Status: implementation candidate. Full Play Store certification is still required on the exact deployed testing commit.

## Scope

- Repairs the 17.0.8 release-gate false failure where Vercel's temporary/workspace-normalized `vercel.json` bytes were compared to committed local source. On Vercel, protected configuration hashes now come from the committed `release-source-manifest.json`; local certification continues hashing actual local files.
- Hardens Schedule → Request Off rendering against malformed/legacy Firestore values by normalizing rows before the UI consumes them, including legacy date aliases and Firestore-like timestamp objects. Non-record values are dropped rather than allowed to collapse the whole schedule section.
- Moves the mobile 86Voice microphone to a 44px bottom offset, exactly halfway between the former 80px position and the 17.0.5 8px position. Schedule scroll clearance is increased to keep controls and rows above the dock.

## Evidence context

The 17.0.8 full gate stopped before Playwright because protected `vercel.json` evidence differed even though version, commit, branch, deployment and source manifest matched. Manual runtime evidence from the same deployed build showed repeated `/api/report-bug` calls around the Request Off workflow, with successful `/api/time-off-request` traffic in the same minute. The exact client exception is not recoverable from Vercel server logs, so 17.0.9 does not invent a stack trace; it hardens the correlated Request Off render boundary against malformed historical values and adds direct regression coverage.

## Certification policy for this release

Per user instruction, do not run failed-only or delta Play Store runners. After the exact testing deployment is READY, run only the complete gate:

```powershell
npm run test:play-store
```

Only that complete run can certify 17.0.9.
