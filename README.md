# 86 Chaos

Current build: 13.1.25

## 13.1.25 focus

- Restores platform Super Admin recognition for the Geoffrm account alias across frontend settings, Firestore rules, and Vercel API routes.
- Keeps Settings → Workspace and Settings → Integrations visible to the account owner and platform Super Admin, while still hidden from normal non-owner admins.
- Makes Firebase referrer/authorized-domain login failures readable instead of dumping the raw Firebase error.
- Keeps push notification testing tied to same-account multi-device tokens from the active production workspace.

## Deploy notes

Deploy through GitHub/Vercel as usual. Publish the included `firestore.rules` in Firebase for the Super Admin bootstrap email update.
