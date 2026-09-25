# 86 Chaos 17.0.11

Release: Schedule Builder Runtime Repair

Status: targeted production repair; full Play Store certification was intentionally not run.

## Repair

Schedule Builder received raw `events` collection rows and synchronously called string methods on `special_event.date` during render. Legacy rows with null, missing, ISO, JavaScript `Date`, Firestore `Timestamp`, or serialized timestamp values could therefore throw before the route rendered and trigger the section recovery screen.

17.0.11 adds a browser-native ESM normalization boundary inside the Schedule Builder component. It derives a canonical `YYYY-MM-DD` view value without changing Firestore data, omits only special-event rows that have no valid renderable date, filters non-record input rows, and makes event sorting/reminder display scalar-safe. Existing Request Off and roster-role normalization is reused for those builder inputs, and both browser entry points are implemented as native ESM so production bundling cannot turn CommonJS server/test helpers into static asset URLs. No schema or data migration is introduced.

The repair does not add CommonJS browser bridges, globals, asset-URL module shims, or shared parent-route dependencies. Schedule publishing, canonical schedule writes, Schedule Tools periods, Month Schedule PDF generation, mobile PDF delivery, schedule printing, Shift4/POS foundations, Firebase/Auth/App Check/MFA boundaries, and unrelated product areas remain unchanged.
