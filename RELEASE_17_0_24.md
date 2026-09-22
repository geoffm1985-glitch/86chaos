# 86 Chaos 17.0.24

## Schedule Builder Clear Month

17.0.24 adds only the requested Schedule Builder bulk-clear action. An authorized Schedule Builder user can press **Clear Month**, review a destructive confirmation that names the displayed month and the exact saved shift count, and then remove every saved shift record for that restaurant/month. Both draft and published shifts are included.

The operation does not delete events, Request Off records, availability, staff, templates, presets, or any other restaurant data. Before deleting, the browser reloads saved shifts for the restaurant from Firestore using the canonical tenant `restaurantId` identity. After deletion it reloads the month again, retries any records that remain once, and reports a failure instead of silently claiming a partial clear.

The control remains inside the existing Schedule Builder permission boundary. No new route or permission grant was introduced. Assignment, Copy Month, and Publish are temporarily disabled while a month clear is running to avoid overlapping schedule writes.

The 17.0.23 Request Off cutoff/blackout policy and all unrelated application behavior are preserved.
