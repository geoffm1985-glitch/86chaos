# 86 Chaos 15.0.12 QA Checklist

## Version

- [ ] Deploy the app.
- [ ] Confirm `/version.json` shows `15.0.12`.

## Help Center Menu Intelligence article

- [ ] Open Help Center.
- [ ] Search `Menu Intelligence` and confirm **Using Menu Intelligence** appears.
- [ ] Search `intelligent menu` and confirm the same article appears.
- [ ] Search `scan menu`, `approve reviewed menu links`, `burger`, and `86 impact` and confirm useful results appear.
- [ ] Confirm the article explains upload, compression/scan progress, AI review, ingredient matching, approval, edit, delete, and 86 menu-impact behavior.
- [ ] Confirm the article is public-facing and does not mention System Administrator, Forensics, backups, Firestore rules, security internals, or sensitive admin tools.

## Menu Intelligence workflow wording

- [ ] Confirm the article tells managers to review AI suggestions before approval.
- [ ] Confirm the article explains matching kitchen shorthand like burger or patty to real inventory names like `BEEF GR PTY`.
- [ ] Confirm the article explains how to fix missing menu impact by editing links in Recent Menu Scans.

## Administrator Manual

- [ ] Open System Administrator → Administrator Manual.
- [ ] Search `15.0.12` and confirm the new admin guidance appears.
- [ ] Confirm the deployment checklist says rules, Storage, API routes, and env vars are unchanged.

## Deployment notes

- [ ] Firestore rules: no new 15.0.12 changes.
- [ ] Storage rules: no new 15.0.12 changes.
- [ ] Vercel/API routes: deploy updated app code.
- [ ] New environment variables: none.
