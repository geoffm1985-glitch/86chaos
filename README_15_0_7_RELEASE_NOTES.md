# 86 Chaos 15.0.7 Release Notes

## Smart Prep Voice Duplicate Prevention

15.0.7 fixes a voice prep matching issue where a spoken command could add a new Voice Station prep item even though the same task already existed on the current prep list or MASTER prep list.

### Changes

- 86 Voice smart prep now refreshes target-date and MASTER prep candidates on demand before saving.
- Matching no longer depends only on the limited live prep snapshot passed into the floating voice dock.
- Prep matching now prefers intentional day-specific prep rows first, MASTER rows second, and older voice-created duplicates last when matches score the same.
- Commands like `slice 3 tomatoes`, `dice 2 onions`, or `portion 4 burgers` should update the matching existing prep row instead of creating a duplicate when a confident match exists.

### Deployment

- Deploy through GitHub/Vercel.
- No Firestore rules changes.
- No Storage rules changes.
- No Vercel config changes.
- No new environment variables.

### Known cleanup

Existing duplicate Voice Station items created by older builds are not deleted automatically. Remove those manually after confirming the real prep row has the correct quantity.
