# 86 Chaos

Current build: 13.1.19

## 13.1.19 focus
- Reorganized the System Administrator tab into cleaner professional groups: Overview, Customer Operations, Support & Safety, and Reference.
- Fixed Live Activity / Recent Activity visibility by tightening heartbeat display logic and adding clearer Firestore-rule error feedback.
- Repaired push-notification enrollment so already-approved browsers resync their FCM token on login.
- Updated Firestore rules so users can safely save their own presence and push-token fields, while protected admin fields stay locked down.
- Changed microphone phrases like “86 ranch” and “we’re out of fries” to send an important 86 alert instead of editing inventory.
- Split review stamp wording so creating a stamp and viewing stamps are no longer confused.
- Changed full-system lockout wording to show a maintenance screen instead of subscription language.
