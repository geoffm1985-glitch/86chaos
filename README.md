# 86 Chaos

Version: 16.0.4

## 16.0.4 update

16.0.4 is a visual/menu cleanup build on top of 16.0.3. It keeps the recovered 16.0.1 feature set, the safer 86 Voice behavior, OpenAI diagnostics explanations, Gemini Manual improvements, backup watchdog work, and the organized main menu.

What changed:

- Removed the bright action color from the app shell and restored the copper look across the core theme, menu, buttons, borders, focus rings, scrollbars, and command panels.
- Tightened the main hamburger menu so menu items take less vertical space and the drawer is easier to scan on desktop and mobile.
- Changed the main menu drawer to behave as a true overlay: opening it locks the page behind it instead of letting the current page shift or get pushed around.
- Preserved the grouped main menu categories: Command, Kitchen Ops, Management, and System.
- Preserved the stable System Administrator layout/tools from the recovered app line.
- Kept the OpenAI diagnostics route, safer 86 Voice confirmation behavior, System Administrator search, Gemini Manual, backup watchdog, and other 16.0.x features.

## Deployment notes

- Redeploy on Vercel because frontend styling, version metadata, and the displayed API version changed.
- Add `OPENAI_API_KEY` to the Vercel environment where you want OpenAI diagnostics explanations to work.
- Optional: set `OPENAI_DIAGNOSTICS_MODEL` if you want a different OpenAI model. The default is `gpt-5-mini`.
- Firestore rules are unchanged.
- Storage rules are unchanged.
- No Firebase publishing is required for this build.

## Important QA focus

Test the main menu first on desktop and mobile. Confirm it opens over the current page, does not push the page down, keeps the copper styling, and still exposes every permitted feature. Then verify System Administrator, 86 Voice confirmation, and OpenAI diagnostics still work.
