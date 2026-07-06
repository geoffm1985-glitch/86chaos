# 86 Chaos

Current build: 13.1.21

## 13.1.21 focus

This build fixes the employee Time Clock loading labels so punch actions no longer briefly show the opposite action.

- Clock In now keeps the green Clock In button showing `CLOCKING IN...` until the punch-in save finishes, then switches to Clock Out.
- Clock Out now keeps the red Clock Out button showing `CLOCKING OUT...` until the punch-out save finishes, then switches to Clock In.
- The active-punch listener and optimistic button flip from 13.1.20 remain intact.
- The legacy schedule component received the same defensive label fix for consistency.

## Deploy notes

Deploy through the normal GitHub → Vercel flow. No API route, Firestore rules, Storage rules, or Vercel env changes are required for this version.
