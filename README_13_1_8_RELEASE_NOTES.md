# 86 Chaos 13.1.8 Invoice Scanner Progress Fix

## What changed

- Replaced the endless invoice scanner spinner with a progress bar.
- Firebase Storage upload now reports real upload percentage, uploaded MB, and total MB.
- AI extraction stage now shows a clear status instead of looking frozen.
- Client-side scan requests now time out cleanly instead of spinning forever.
- Server-side Gemini invoice scans now have a timeout and return a clear 504 error when the AI scan takes too long.
- Help Center and version files were updated to 13.1.8.

## Kitchen behavior

1. Choose an invoice PDF/photo.
2. Progress bar shows exact upload progress.
3. After upload, the scanner shows AI extraction status.
4. When complete, the Reconcile Invoice window opens.
5. Manager reviews and clicks Approve & Update Stock.

## Notes

The upload portion is exact progress. The AI extraction portion is server work, so the browser shows status and elapsed time until the scanner returns.
