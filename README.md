# 86 Chaos

Current version: 15.0.4

86 Chaos is a restaurant/kitchen management web app built with React, Vite-compatible structure, Firebase, and Vercel serverless API routes.

## 15.0.4 focus

This build keeps the 15.0.3 bulk notification cleanup intact, then improves Menu Intelligence so menu scan approvals are safer and easier to manage:

- Scan Menu now shows a real upload progress bar, AI scan status, percent, and elapsed timer instead of a plain spinner.
- Approve Reviewed Menu Links now locks while saving and shows one approval progress bar with saved-link counts so users cannot accidentally click it multiple times.
- Recent Menu Scans now have edit and delete controls.
- Editing a scan lets approved users rename the scan, edit menu items, edit ingredient-to-inventory matches, add links, remove links, and save the revised menu impact data.
- Deleting a scan removes the approved menu-impact dependency links tied to that scan and deletes the scan summary record. The original uploaded file stays in secure storage.
- Firestore rules, Storage rules, Vercel config, API routes, and environment variables are unchanged from 15.0.3.

## Deploy steps

1. Deploy the app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.4` after deploy.
3. Upload a menu and confirm Scan Menu shows progress, percent, and elapsed time.
4. Approve a reviewed menu scan and confirm the approve button cannot be clicked repeatedly while it saves.
5. Edit and delete a recent menu scan from Menu Intelligence.
6. Run the 15.0.4 QA checklist before handing it to staff.

## Required separate publishes

- Firestore rules: no new changes from 15.0.3.
- Storage rules: no new changes from 15.0.3.
- Vercel deploy/API routes: yes, deploy the updated app code.
- New environment variables: no.

## Branding rule

86 Chaos branding is mandatory and must always remain visible. Restaurant/customer logos may display beside it, but cannot replace or hide 86 Chaos branding.
