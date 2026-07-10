# 86 Chaos

Version: 16.0.3

## 16.0.3 update

16.0.3 is a recovery-and-reliability build based on the last stable 16.0.1 app line. It keeps the features we built before the Codex 16.0.2 regression, restores the organized System Administrator experience, and only carries forward the Codex-style main menu organization that was actually useful.

What changed:

- The main hamburger menu is now grouped into Command, Kitchen Ops, Management, and System sections while preserving all existing feature tabs and permissions.
- 86 Voice alerts are now safer: 86/out-of-stock phrases require confirmation before sending, never edit inventory, and only use very strong inventory matches automatically.
- Weak 86 item matches are treated as review-only instead of silently mapping to the wrong inventory row.
- System Administrator now has a search box for quickly finding admin tools like backups, MFA, users, push, cron, rules, Gemini, and diagnostics.
- Full System Diagnostics now has an OpenAI-powered structured explanation button that generates repair steps, verification steps, deploy/publish notes, and escalation criteria.
- Added the protected `/api/openai-diagnostics-explain` route for Super Admin-only diagnostics explanations.

## Deployment notes

- Redeploy on Vercel because frontend code, version metadata, `/api/voice-command`, `/api/health-checks`, `/api/security-diagnostics`, and the new `/api/openai-diagnostics-explain` route changed.
- Add `OPENAI_API_KEY` to the Vercel environment where you want OpenAI diagnostics explanations to work.
- Optional: set `OPENAI_DIAGNOSTICS_MODEL` if you want a different OpenAI model. The default is `gpt-5-mini`.
- Firestore rules are unchanged.
- Storage rules are unchanged.
- No new Firebase publishing is required for this build.

## Important QA focus

Test the main menu first on desktop and mobile, then confirm System Administrator still has the organized categories from 16.0.1. Test 86 Voice with exact, partial, and bad item names before service. Run Full System Diagnostics, then click Explain with OpenAI after adding the OpenAI key in Vercel.
