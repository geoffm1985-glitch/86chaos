# 86 Chaos

Current Version: 15.0.43 - Safer Voice and OpenAI Diagnostics

## 15.0.43 focus

This release builds on the stable 15.0.42 base without changing the app shell or adopting the discarded 16.0.x redesign.

### Included changes
- Voice commands such as `86 salmon` and `we're out of chicken` are treated as high-risk alert requests, never inventory edits.
- Exact or very strong 86 matches require confirmation before an alert is written or a push is sent.
- Weak or ambiguous 86 matches show a choose-item review. No candidate means no alert.
- The selected inventory item is fetched and verified again immediately before the confirmed alert is created.
- Existing smart prep behavior remains: multiple prep items are supported and matching prep tasks have their quantities adjusted instead of being duplicated.
- Added Super Admin-only `/api/openai-diagnostics-explain` using OpenAI for structured diagnostics repair guidance.
- Diagnostics are redacted in the frontend and again on the server before being sent to OpenAI.
- Added System Administrator search across tools, sections, common actions, and Administrator Manual articles on desktop and mobile.
- Changed the large Event Calendar top heading from the current month/date to `Event Calendar`; the existing month controls remain.
- Preserved the Gemini Administrator Manual assistant, finish-reason tracking, auto-continuation, dangling-ending detection, and Continue Gemini Answer behavior from 15.0.42.

### Environment variables
Required for OpenAI diagnostics:
- `OPENAI_API_KEY`

Recommended:
- `OPENAI_DIAGNOSTICS_MODEL=gpt-5-mini`

Existing Gemini Manual variables remain:
- `GEMINI_API_KEY`
- Optional `GEMINI_MODEL`

When `OPENAI_API_KEY` is missing, the Health Dashboard shows a configuration message and the app remains usable.

### Separate deployment / publishing
- Vercel redeploy required because frontend code, API routes, function configuration, and version metadata changed.
- Add `OPENAI_API_KEY` and optionally `OPENAI_DIAGNOSTICS_MODEL` separately to Preview and Production Vercel environments.
- No Firestore rules changes.
- No Storage rules changes.
- No Firebase Console change is required for this release.

### Quick validation
1. Deploy to the testing branch and confirm `/version.json` reports `15.0.43`.
2. Test exact, strong, ambiguous, and unknown voice 86 phrases. Confirm none edit inventory.
3. Open System Administrator > Health Dashboard and run health/full diagnostics.
4. Select `Explain with OpenAI`; confirm structured guidance appears or a clear missing-key message appears.
5. Search System Administrator for `backup`, `MFA`, `OpenAI`, and a manual article on desktop and mobile.
6. Open Event Calendar and confirm the large heading reads `Event Calendar` while month navigation still works.
7. Ask the Gemini Administrator Manual a long troubleshooting question and verify continuation protection still works.

## Notes
- 86 Chaos branding remains mandatory and cannot be hidden or replaced.
- Customer restaurant logos may appear beside 86 Chaos branding, but not instead of it.
- Help Center remains public-facing and generic. Security and System Administrator internals remain in the Administrator Manual.
