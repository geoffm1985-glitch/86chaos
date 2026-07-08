# 86 Chaos

Current version: 15.0.8

## 15.0.8 focus

This build keeps the 15.0.7 voice prep matching fix intact, then adds automatic scan-file compression for Menu Intelligence and Invoice Scanner uploads.

## What changed

- Menu Intelligence now automatically prepares large files before upload instead of immediately blocking oversized photos.
- Invoice Scanner now uses the same automatic pre-upload compression path.
- Large JPG/PNG/WebP/BMP photos are compressed in the browser into a smaller high-quality JPEG scan copy before Firebase Storage upload.
- Oversized PDFs get a best-effort in-browser compaction pass before upload.
- Scan progress now includes the file preparation/compression stage before the Firebase upload stage.
- Upload metadata now records the original file name, uploaded file name, original size, uploaded size, and compression method.
- The 20MB backend and Storage safety limit stays in place to protect Vercel memory and scanner reliability.
- The internal Administrator Manual includes 15.0.8 scanner-compression guidance.
- No public Help Center release note was added for this build.

## Deployment steps

1. Deploy the updated app through GitHub/Vercel.
2. Confirm Vercel installs the new `pdf-lib` dependency from `package.json`.
3. Confirm `/version.json` reports `15.0.8` after deploy.
4. Test Menu Intelligence with a large phone photo and confirm compression runs before upload.
5. Test Invoice Scanner with a large phone photo and confirm compression runs before upload.
6. Test an oversized PDF and confirm it either compacts under 20MB or gives a clear split/export-fewer-pages message.
7. Run the 15.0.8 QA checklist before handing it to staff.

## Separate publishing required

- Firestore rules: no new changes from 15.0.5.
- Storage rules: no new changes from 15.0.5.
- Vercel/API routes: deploy the updated app code.
- New environment variables: none.

## Notes

- Automatic photo compression should cover the common restaurant problem: giant phone camera images.
- PDF compression is best-effort. Scanned-image PDFs may still need to be split because the page images inside them cannot always be safely downsampled in-browser.
- The app still refuses files that remain over 20MB after compression/compaction.
