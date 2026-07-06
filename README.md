# 86 Chaos

Current build: 13.1.26

## 13.1.26 focus

- Makes Firebase blocked-preview login errors actionable instead of dumping a vague warning.
- Explains why login, push-token repair, and owner-only Settings tabs can fail on an unapproved Vercel preview URL.
- Shows the exact domain and exact referrer pattern to add when testing preview deployments.
- Keeps production login behavior unchanged.

## Deploy notes

Deploy through GitHub/Vercel as usual. No Firestore rules, Storage rules, Vercel config, or API route changes are required for this version. If testing from a Vercel preview URL, add that preview domain to Firebase Auth authorized domains and add the matching `https://preview-domain/*` referrer to the Google Cloud API key restrictions.
