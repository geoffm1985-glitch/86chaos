# 86 Chaos

Current build: 13.1.20

## 13.1.20 focus

This build tightens the employee Time Clock button state so punch actions flip immediately without requiring an app refresh.

- Clock In now shows a short in-progress state, saves the punch, and immediately changes to Clock Out for the employee.
- Clock Out now immediately changes back to Clock In after the employee confirms/finalizes the punch-out.
- The active-punch listener now avoids a fragile status-filter query and filters active punches client-side, reducing Firestore index/rule surprises for regular employees.
- Optimistic state guards prevent stale live snapshots from briefly undoing the button flip after a punch action.

## Deploy notes

Deploy through the normal GitHub → Vercel flow. No API route, Firestore rules, or Storage rules changes are required for this version.
