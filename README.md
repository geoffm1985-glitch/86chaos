# 86 Chaos

Version: 15.0.43

86 Chaos is a restaurant/kitchen management web app built with React, Firebase Auth/Firestore/Storage, and Vercel API routes.

## 15.0.43 update

This build applies the new 86 Chaos marketing mockup-inspired app reskin. It keeps the existing application structure and behavior while making the live app feel closer to the generated product mockup: dark command-center shell, orange action accents, stronger card depth, cleaner side drawer, and more polished mobile surfaces.

## Deployment

- Redeploy the app through Vercel.
- `vercel.json` removes ignored function `memory` settings while keeping valid `maxDuration` and cron settings.
- Firestore rules are unchanged.
- Storage rules are unchanged.
- No new environment variables are required.

## Branding rule

86 Chaos branding is mandatory and must always remain visible. Restaurant/customer logos may appear beside 86 Chaos branding when configured, but they do not replace it.
