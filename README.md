# 86 Chaos

Current build: 13.1.13

## 13.1.13 focus
- Added System Administrator → Forensics → Emergency Schedule Rescue.
- Reinjects the uploaded Cheers Chilton July 2026 schedule for restaurant ID `cheers_chilton_01`.
- Deletes only existing July 2026 shifts for that restaurant, downloads a backup JSON, then imports 113 published shifts from the PDF schedule.
- Requires typing `REINJECT JULY` before the button runs.

## Notes carried forward
- 13.1.10 invoice scanner filtering remains in place: only purchased product rows can be imported into inventory.
- The large-document scanner path, Firebase upload progress bar, and longer invoice timeout from 13.1.9 remain in place.
- Message Board newest-first sort and like button from 13.1.7 remain in place.
- Voice navigation/help search from 13.1.6 remains in place.
- Schedule Copilot/Builder role linking from 13.1.5 remains in place.
