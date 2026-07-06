# 86 Chaos

Current build: 13.1.9

## 13.1.9 focus

Large invoice scanner fix:

- Firebase upload progress remains exact.
- Large invoice PDFs/photos are handed to Gemini through the large-file scanner path instead of huge inline payloads.
- Scanner timeout was extended for multipage invoices.
- Progress bar now shows upload, AI file processing, and reconcile stages.
