# 86 Chaos 15.0.10 Release Notes

## 86 Menu Impact Alerts

This release makes 86 alerts smarter and more useful during service.

### Changes

- 86 Voice can now resolve spoken menu shorthand through Menu Intelligence.
- If someone says “86 burger,” the app can match the correct inventory product, such as beef patties, when approved menu links support that relationship.
- 86 alert Message Board posts now include unavailable menu items from Menu Intelligence.
- 86 alerts now include inventory match details when the spoken item differs from the matched inventory product.
- Voice-created 86 alerts are flagged for Manager Brief and Kitchen Command Center without creating duplicate records.
- Today Command Center has been renamed to Manager Brief in the menu.
- Ops Command Center has been renamed to Kitchen Command Center in the menu.
- Help Center includes this release note.
- Administrator Manual includes 15.0.10 deployment, QA, and support guidance.

## Deployment notes

- Firestore rules: no new changes.
- Storage rules: no new changes.
- Vercel/API routes: deploy updated app code.
- New environment variables: none.
