# 86 Chaos 15.0.0 Release Notes

## Kitchen Intelligence, Reminders, and Schedule Clarity

- Preserved the 14.0.10 push, schedule-alert, production Firebase Messaging, and multi-workspace staff-recipient repairs.
- Added smart prep matching so typed and voice prep commands update confident existing prep rows instead of creating duplicates.
- Expanded 86 Voice prep recognition so kitchen phrasing like "slice three tomato", "dice onions", "chop lettuce", and "3 pans tomatoes" becomes Prep instead of Help search.
- Added day-aware prep commands such as "prep tomatoes for Friday" and "slice three tomato tomorrow"; the app saves and opens Prep on that target day.
- Added Menu Intelligence for approved users: upload menu images/PDFs, scan with Gemini, review inventory matches, and save menu-to-inventory dependency links.
- Updated Menu Intelligence to use newer Gemini Flash model fallbacks instead of depending on the retired `gemini-1.5-flash` default.
- Added zero-stock menu impact panels and menu-impact text on 86 alerts when inventory items affect active menu items.
- Added private My Reminders with typed or mic creation, Firestore owner-only rules, and scheduled push delivery through `/api/dispatch-reminders`.
- Added time-aware schedule dimming: My Schedule and Full Schedule now gray out shifts after their end time passes, and Full Schedule dims completed day sections.
- Hardened invoice scanning so Gemini responses wrapped in code fences, leading text, or small JSON formatting mistakes do not automatically stop the scan.
- Hardened Menu Intelligence scanning with the same forgiving JSON parser used by invoice scans.
- Added Firestore and Storage rules for personal reminders, menu scans, menu dependencies, menu upload files, and multi-workspace storage matching.
- Updated the System Administrator Manual, Help Center release note, README, QA checklist, package version, public version file, and release guardrail to 15.0.0.

## Important behavior

Publish both `firestore.rules` and `storage.rules` to every Firebase project that will run this build. Do not paste `firebase.json` into the Firebase console rules editors; paste the actual rule-file contents.

Menu scanning requires `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` in Vercel. Reminder delivery requires `CRON_SECRET` and a Vercel plan that supports the configured production cron schedule.
