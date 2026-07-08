# QA Checklist - 86 Chaos 15.0.8

## Version

- [ ] Deploy the app and confirm `/version.json` reports `15.0.8`.
- [ ] Confirm the footer/version display reports `15.0.8`.
- [ ] Confirm Vercel installed `pdf-lib` from `package.json`.

## Menu Intelligence compression

- [ ] Open Menu Intelligence.
- [ ] Select a large JPG/PNG/WebP menu photo over 20MB.
- [ ] Click Scan Menu.
- [ ] Confirm the progress bar shows a preparation/compression stage.
- [ ] Confirm the app uploads the smaller compressed copy instead of immediately showing Menu Too Large.
- [ ] Confirm the AI scan still opens the review screen.
- [ ] Approve the menu scan and confirm the menu dependency links save normally.

## Invoice Scanner compression

- [ ] Open Inventory → Invoices.
- [ ] Select a large invoice photo over 20MB.
- [ ] Confirm the invoice progress bar shows compression before upload.
- [ ] Confirm the compressed file uploads and Reconcile Invoice opens.
- [ ] Approve the invoice and confirm inventory updates still work.

## PDF behavior

- [ ] Try a PDF slightly over 20MB.
- [ ] Confirm the app attempts PDF compaction before upload.
- [ ] If compaction gets the PDF under 20MB, confirm scan continues.
- [ ] If compaction cannot get the PDF under 20MB, confirm the user sees a clear split/export-fewer-pages message.

## Support metadata

- [ ] Confirm uploaded scan objects include metadata for original name, uploaded name, original bytes, uploaded bytes, compression method, and compressed true/false.

## Administrator Manual

- [ ] Open System Administrator → Administrator Manual.
- [ ] Search `15.0.8`.
- [ ] Confirm scanner auto-compression guidance is present.

## Regression

- [ ] Confirm ordinary small menu scans still upload without forced blocking.
- [ ] Confirm ordinary small invoice scans still upload without forced blocking.
- [ ] Confirm 15.0.7 voice prep matching still updates existing prep rows instead of creating duplicates.
- [ ] Confirm 15.0.6 Menu Intelligence fast delete still works.
- [ ] Confirm no 15.0.8 public Help Center release note appears.
