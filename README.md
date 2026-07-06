# 86 Chaos

Current build: 13.1.18

## 13.1.18 focus
- Fixed live user presence so online users can reliably appear in System Administrator → Live Users.
- Updated Firestore rules to allow safe self-updates for presence heartbeat fields only.
- Added stronger last-seen parsing for string dates and Firestore timestamp values.
- Expanded Administrator Manual instructions so every System Administrator section explains what it does and when to use it.
- Help Center release notes stay generic and do not expose administrator implementation details.

## Notes carried forward
- 13.1.17 admin operations, backup countdown, diagnostics, and privacy policy updates remain in place.
- 13.1.16 schedule rescue rows remain editable in Schedule Builder before republishing.
- 13.1.10 invoice scanner filtering remains in place: only purchased product rows can be imported into inventory.
- The large-document scanner path, Firebase upload progress bar, and longer invoice timeout from 13.1.9 remain in place.
- Message Board newest-first sort and like button from 13.1.7 remain in place.
- Voice navigation/help search from 13.1.6 remains in place.
- Schedule Copilot/Builder role linking from 13.1.5 remains in place.
