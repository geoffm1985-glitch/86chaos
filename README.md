# 86 Chaos

Current Version: 15.0.35 - Administrator Layout Polish

## 15.0.35 focus
This build polishes the System Administrator layout so support work is easier on desktop and less cramped on mobile.

## Included
- Desktop System Administrator navigation moved to the left side.
- Mobile System Administrator navigation is collapsible.
- Command Deck / signal information board moved to the top.
- Information board remains collapsible.
- Administrator Manual includes a 15.0.35 layout article.

## Deploy notes
- Deploy the full ZIP through the normal GitHub/Vercel flow.
- Confirm `/version.json` reports `15.0.35`.
- No Firestore rules changes.
- No Storage rules changes.
- No new Vercel environment variables.

## QA
Use `QA_15_0_35_CHECKLIST.md` for the current test pass.
