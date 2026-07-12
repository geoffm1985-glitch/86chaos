# 86 Chaos — Version 15.0.61

Version **15.0.61** completes and hardens 86Voice Intelligent Voice Commands while preserving the existing React/Vite/Firebase/Vercel structure, 15.0.60 voice mark-done matching, 15.0.59 complete manual coverage, 15.0.58 website-claims hardening, 15.0.57 desktop polish, 15.0.56 restaurant-group push broadcasts, and the tier / Founder Beta / feature gate system.

## What changed in 15.0.61

- 86Voice now behaves more like a kitchen command assistant instead of a speech-to-text shortcut.
- Natural-language prep commands search existing prep rows first and update confident matches instead of duplicating.
- Natural-language task commands search existing daily/weekly/monthly task rows first and update confident matches instead of duplicating.
- Prep and task mark-done commands use centralized fuzzy matching and ask for review when a phrase is ambiguous.
- 86 alert commands support common out-of-stock wording, keep inventory counts unchanged, and show menu impact from approved dependency links when available.
- Menu impact questions such as “What does chicken breast affect?” can answer from approved Menu Intelligence links without posting a new alert.
- Status questions such as “What needs done?” and “What are we out of?” summarize permitted open work without exposing restricted areas.
- Personal, shared, and recurring reminder commands are connected to the existing reminder system and staff list, with permission checks for shared reminders.
- Safe recent voice actions can be undone when rollback is available.
- Voice result UI now shows what was heard, intent, matched item, confidence, confirmation state, result text, and undo availability.
- Voice actions and blocked attempts write audit logs where meaningful.
- Help Center, Complete App Training Manual, and Administrator Manual were updated with the new 86Voice behavior.

## Deployment notes

Deploy to the testing/Vercel preview side first. Confirm `/version.json` reports `15.0.61`, then test voice commands from the floating 86Voice button or by typing into the voice panel.

No Firebase rules changes are required for this release.
No new Vercel environment variables are required.
Keep the existing working server setup: `FIREBASE_SERVICE_ACCOUNT_KEY` as the full Firebase service account JSON and `CRON_SECRET` for cron routes.

## Safety notes

Voice commands must obey the same permissions and plan gates as tapping through the app. Voice cannot access locked screens, financial/wage/admin/owner-only data, integrations, or restricted actions unless the signed-in user could already do so normally.

86 alerts created by voice do not edit inventory quantity. Invoice scans, menu scans, payroll readiness, Daily Close signoff, financial reports, plan/billing changes, Firebase/security/admin settings, and integrations are never auto-approved by voice.
