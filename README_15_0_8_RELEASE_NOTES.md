# 86 Chaos 15.0.8 Release Notes

## Scanner Auto Compression

15.0.8 adds automatic pre-upload compression for Menu Intelligence and Invoice Scanner files.

### Changes

- Menu scans now prepare/compress oversized photos before uploading to Firebase Storage.
- Invoice scans now use the same preparation/compression path.
- Large image files are converted in-browser to high-quality JPEG scan copies.
- Oversized PDFs get a best-effort compaction pass before upload.
- Progress bars now show a preparation/compression stage before upload progress begins.
- Storage metadata records original/uploaded sizes and compression method for support troubleshooting.
- The 20MB Storage/API scanner shield remains in place.

### Deployment

- Deploy through GitHub/Vercel.
- Vercel must install the new `pdf-lib` dependency from `package.json`.
- No Firestore rules changes.
- No Storage rules changes.
- No Vercel config changes.
- No new environment variables.

### Known limitation

PDF compression is best-effort. Exported/text PDFs may shrink, but scanned-image PDFs with huge embedded page images may still need to be split into smaller files.
