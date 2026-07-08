# 86 Chaos 15.0.4 Release Notes

## Menu Intelligence approval and scan management polish

This release fixes the double-click trap in Menu Intelligence approvals and replaces the Scan Menu spinner with visible progress and timing. It also adds edit/delete controls for approved menu scans.

## What changed

- Replaced the Scan Menu loading spinner with a progress bar, percent display, status text, and elapsed timer.
- Menu file uploads now use Firebase resumable upload progress so the upload stage reflects real transferred bytes.
- The AI-reading stage now shows clear scanner status and elapsed time while Gemini reads the stored menu file.
- Approve Reviewed Menu Links now disables while saving and shows a progress bar with saved-link counts.
- Added click protection so repeated approval clicks cannot create duplicate approved menu links.
- Added Edit controls on Recent Menu Scans. Approved users can rename a scan, edit menu item names/categories/descriptions, adjust ingredient inventory matches, add links, and remove links.
- Added Delete controls on Recent Menu Scans. Deleting a scan removes the scan summary and approved menu-impact dependency links tied to that scan.
- Updated README, version files, Help Center wording, Administrator Manual, and QA checklist for 15.0.4.

## Deployment notes

- Deploy the app through Vercel so the updated Menu Intelligence frontend is live.
- Firestore rules are unchanged from 15.0.3.
- Storage rules are unchanged from 15.0.3.
- Vercel config and API routes are unchanged from 15.0.3.
- No new environment variables are required.
