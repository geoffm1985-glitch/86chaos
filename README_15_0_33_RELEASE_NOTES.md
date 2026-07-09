# 86 Chaos 15.0.33 Release Notes

## Deployment Syntax Hotfix
- Fixed the Vercel build failure from 15.0.32.
- The build was failing in `src/features/management.jsx` with: `Adjacent JSX elements must be wrapped in an enclosing tag`.
- The cause was an unclosed JSX wrapper in the System Administrator Manual support console section.
- Added the missing wrapper close and confirmed the React/JSX parse check passes.

## Preserved from 15.0.32
- AI-style System Administrator support console.
- Expanded administrator troubleshooting playbooks and manual search.
- Account deletion request review controls.
- Recovery-code secret enforcement.
- Super Admin and production-hardening work.

## Deployment
- Vercel redeploy required.
- No new Vercel environment variables.
- No Firestore rule changes.
- No Storage rule changes.
- Confirm `/version.json` reports `15.0.33` after deployment.
