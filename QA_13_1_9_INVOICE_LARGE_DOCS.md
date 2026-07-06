# QA — 13.1.9 Large Invoice Scanner

## Basic scan

1. Open Inventory → Manage.
2. Click Scan Invoice (PDF/Photo).
3. Upload a normal invoice PDF.
4. Confirm the progress bar shows upload percent.
5. Confirm the status changes to large-document AI processing.
6. Confirm Reconcile Invoice opens.

## The document that previously timed out

1. Upload the exact PDF/photo that previously reached 100% then timed out.
2. Leave the page open.
3. Confirm it does not stop at the old timeout.
4. Confirm the Reconcile Invoice window opens.
5. Confirm rows, totals, vendor info, and warnings appear.

## Large file behavior

1. Upload a larger multi-page PDF under 100MB.
2. Confirm upload progress shows MB uploaded / total MB.
3. Confirm the app stays responsive while the AI stage runs.
4. Confirm a clear error appears if Gemini rejects the file.
5. Confirm the scanner controls unlock after success or error.

## Regression checks

1. Upload a photo invoice.
2. Upload a PDF invoice.
3. Confirm approving invoice still saves invoice history.
4. Confirm approving invoice still updates stock.
5. Confirm Help Center search finds invoice scanner progress / large documents.
