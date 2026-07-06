# 86 Chaos 13.1.9 — Large Invoice Scanner Fix

This release fixes the invoice scanner timing out on larger PDFs/photos after the file upload completed.

## What changed

- The browser still uploads the invoice to Firebase Storage first, with exact upload progress.
- The backend now hands the stored invoice to Gemini using the Gemini Files API path instead of embedding the entire file as base64 in the model request.
- The invoice scan timeout is extended for larger multipage invoices.
- The UI progress bar now says when the scanner is in large-document AI processing so it does not look frozen.
- Scanner file cap was raised to 100MB in the app layer.
- Server function duration/memory settings were added for `/api/scan-invoice.js`.
- Help Center and version labels were updated to 13.1.9.

## Notes

The Firebase upload percent is true progress. The AI reading stage cannot report exact Gemini internals, so the app shows the stage and elapsed time while the model reads the document.
