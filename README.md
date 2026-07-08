# 86 Chaos

Current version: 15.0.7

## 15.0.7 focus

This build keeps the 15.0.6 Menu Intelligence fast-delete work intact, then tightens 86 Voice smart prep matching so spoken prep quantities update existing prep tasks instead of creating duplicate Voice Station rows when the task is already on the prep list.

## What changed

- 86 Voice now does an on-demand prep match refresh before saving a smart prep command.
- The matcher checks the target prep date and MASTER prep tasks from Firestore at command time instead of relying only on the small live snapshot used by the voice dock.
- Matching tie-breakers now prefer intentional day-specific prep rows first, then MASTER prep tasks, then older voice-created duplicates.
- A command like “slice 3 tomatoes” should update the existing “slice tomato” prep row when it exists instead of adding another “Slice Tomato” under Voice Station.
- Public Help Center release notes were not added for this build.
- The internal Administrator Manual includes 15.0.7 smart prep duplicate-prevention guidance.

## Deployment steps

1. Deploy the updated app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.7` after deploy.
3. Open Prep & Tasks and make sure an existing MASTER task like `slice tomato` is visible.
4. Use 86 Voice or typed voice command text such as `slice 3 tomatoes`.
5. Confirm the existing prep row quantity updates instead of creating a new Voice Station duplicate.
6. Run the 15.0.7 QA checklist before handing it to staff.

## Separate publishing required

- Firestore rules: no new changes from 15.0.5.
- Storage rules: no new changes from 15.0.5.
- Vercel/API routes: deploy the updated app code.
- New environment variables: none.

## Notes

- This fix adds a small on-demand Firestore read only when a voice prep command is actually run. It avoids constant listeners and keeps the low-read 15.0.5 presence approach intact.
- Existing duplicate Voice Station prep rows from earlier builds are not automatically deleted. Delete those manually after confirming the real prep row has the right quantity.
