# 86 Chaos

Version: 16.0.0

86 Chaos is a restaurant/kitchen management web app built with React, Firebase Auth/Firestore/Storage, and Vercel API routes.

## 16.0.0 update

This build is a full app-shell redesign to match the generated 86 Chaos command-center mockup much more closely. It changes the app from a simple drawer/header layout into a darker product-style console with a desktop left navigation rail, redesigned top command bar, mobile quick navigation strip, live operational summary cards, stronger glass panels, orange command accents, and a more cohesive device-mockup style across cards, inputs, buttons, tables, modals, and mobile surfaces.

The existing React/Firebase/Vercel structure is preserved. The app was not rebuilt sideways, and feature behavior remains wired through the existing components.

## Deployment

- Redeploy the app through Vercel.
- `vercel.json` still keeps valid `maxDuration` and cron settings.
- Firestore rules are unchanged.
- Storage rules are unchanged.
- No new environment variables are required.

## Branding rule

86 Chaos branding is mandatory and must always remain visible. Restaurant/customer logos may appear beside 86 Chaos branding when configured, but they do not replace it.
