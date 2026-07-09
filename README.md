# 86 Chaos

Version: 16.0.2

86 Chaos is a restaurant/kitchen management web app built with React, Firebase Auth/Firestore/Storage, and Vercel API routes.

## 16.0.2 Update

This build applies the controlled command-center design-system upgrade. It keeps the existing application structure and behavior while moving the live app toward a premium restaurant operations cockpit: dark glass panels, orange/gold action accents, stronger visual hierarchy, improved drawer organization, polished reusable controls, and better mobile touch targets.

## Preserved

- Existing React/Firebase/Vercel structure.
- Existing API routes, Firebase rules, Storage rules, and Vercel config.
- Existing tab IDs, tab labels, route behavior, permission gates, and feature behavior.
- Existing drawer-based mobile navigation.
- System Administrator access through the existing `godmode` tab.

## Deployment

- Redeploy the app through the existing Vercel workflow.
- `public/version.json` is set to `16.0.2`.
- Firestore rules are unchanged from the 15.0.43 harness.
- Storage rules are unchanged from the 15.0.43 harness.
- No new environment variables are required.

## Branding Rule

86 Chaos branding is mandatory and must always remain visible. Restaurant/customer logos may appear beside 86 Chaos branding when configured, but they do not replace it.
