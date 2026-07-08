# 86 Chaos

Current version: 15.0.10

## 15.0.10 focus

15.0.10 improves 86 Voice alerts and command-center naming.

## What changed

- 86 Voice can use Menu Intelligence links to resolve spoken menu shorthand to the right inventory product.
- Example: saying “86 burger” can match an inventory item like `BEEF GR PTY` when approved menu links point burgers to that product.
- 86 alert Message Board posts now include unavailable menu items from Menu Intelligence.
- The same 86 alert is flagged for Manager Brief and Kitchen Command Center without creating duplicate alert records.
- The side menu now says **Manager Brief** instead of Today Command Center.
- The side menu now says **Kitchen Command Center** instead of Ops Command Center.
- Help Center includes 15.0.10 release notes.
- Administrator Manual includes 15.0.10 setup, QA, and support guidance.

## Deployment notes

1. Deploy the app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.10` after deploy.
3. Test 86 Voice with a phrase like `86 burger` in a workspace with approved Menu Intelligence links.
4. Confirm the Message Board post includes the inventory match and unavailable menu items.
5. Confirm Manager Brief and Kitchen Command Center show the important alert.
6. Run the 15.0.10 QA checklist before handing it to staff.

## Separate publishing required

- Firestore rules: no new changes from 15.0.9.
- Storage rules: no new changes from 15.0.9.
- Vercel/API routes: deploy the updated app code.
- New environment variables: none.
