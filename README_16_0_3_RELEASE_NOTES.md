# 86 Chaos 16.0.3 Release Notes

## AI Reliability and Menu Recovery

This release is based on the last stable 16.0.1 app line and avoids carrying forward the Codex 16.0.2 feature regression. The only Codex UI idea retained is the better main-menu organization.

### Changes

- Main menu now groups tools into Command, Kitchen Ops, Management, and System.
- Existing tabs, permissions, workspace switching, Help Center update dots, demo mode protections, and 86 Chaos branding are preserved.
- 86 Voice alerts now require confirmation before sending.
- 86 Voice never edits inventory stock.
- 86 Voice uses only exact or very strong inventory matches automatically; weak matches are shown as review-only.
- System Administrator now includes a search field for finding tools faster.
- Full System Diagnostics can now be explained by OpenAI using structured repair steps.
- Added `/api/openai-diagnostics-explain` for Super Admin-only structured diagnostics explanations.
- Health Checks now lists the OpenAI diagnostics explanation route.
- Security Diagnostics now reports whether OpenAI diagnostics env vars are present.

### Deploy / publish separately

- Vercel redeploy required.
- Add `OPENAI_API_KEY` to Vercel to enable OpenAI diagnostics explanations.
- Optional: add `OPENAI_DIAGNOSTICS_MODEL` to override the default diagnostics model.
- Firestore rules unchanged.
- Storage rules unchanged.
- No Firebase rules publish required.
