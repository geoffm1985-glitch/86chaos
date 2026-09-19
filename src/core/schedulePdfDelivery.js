const PDF_MIME_TYPE = 'application/pdf';
const BLOB_CLEANUP_DELAY_MS = 60000;

function isAbortError(error) {
  return String(error?.name || '') === 'AbortError';
}

export function shouldPreferSchedulePdfFileDelivery({ windowObject = window, navigatorObject = windowObject?.navigator } = {}) {
  if (navigatorObject?.userAgentData?.mobile === true) return true;
  if (navigatorObject?.standalone === true) return true;
  try {
    if (windowObject?.matchMedia?.('(display-mode: standalone)')?.matches) return true;
  } catch (_) {}
  try {
    if (Number(navigatorObject?.maxTouchPoints || 0) > 0 && windowObject?.matchMedia?.('(pointer: coarse)')?.matches) return true;
  } catch (_) {}
  return false;
}

function createPdfFile(blob, filename, FileCtor) {
  if (typeof FileCtor !== 'function') return null;
  try { return new FileCtor([blob], filename, { type: PDF_MIME_TYPE }); }
  catch (_) { return null; }
}

function scheduleRevoke(url, { windowObject, urlApi }) {
  windowObject.setTimeout(() => {
    try { urlApi.revokeObjectURL(url); } catch (_) {}
  }, BLOB_CLEANUP_DELAY_MS);
}

function downloadBlob(blob, filename, { windowObject, documentObject, urlApi }) {
  const url = urlApi.createObjectURL(blob);
  const link = documentObject.createElement('a');
  let delivered = false;
  try {
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    documentObject.body.appendChild(link);
    link.click();
    delivered = true;
    scheduleRevoke(url, { windowObject, urlApi });
    return { method: 'download', blob, url };
  } finally {
    try { link.remove(); } catch (_) {}
    if (!delivered) {
      try { urlApi.revokeObjectURL(url); } catch (_) {}
    }
  }
}

async function trySharePdf(blob, filename, { navigatorObject, FileCtor }) {
  if (typeof navigatorObject?.share !== 'function' || typeof navigatorObject?.canShare !== 'function') return null;
  const file = createPdfFile(blob, filename, FileCtor);
  if (!file) return null;
  let supported = false;
  try { supported = navigatorObject.canShare({ files: [file] }) === true; }
  catch (_) { supported = false; }
  if (!supported) return null;
  try {
    await navigatorObject.share({ files: [file], title: '86 Chaos Schedule' });
    return { method: 'share', blob, file };
  } catch (error) {
    if (isAbortError(error)) return { method: 'share-cancelled', blob, file };
    return null;
  }
}

export async function deliverSchedulePdf(bytes, {
  filename,
  windowObject = window,
  documentObject = document,
  urlApi = URL,
  navigatorObject = windowObject?.navigator,
  FileCtor = windowObject?.File || (typeof File !== 'undefined' ? File : null),
  BlobCtor = windowObject?.Blob || Blob,
  preferFileDelivery
} = {}) {
  if (!filename) throw new Error('A PDF filename is required.');
  const blob = new BlobCtor([bytes], { type: PDF_MIME_TYPE });
  const fileDelivery = typeof preferFileDelivery === 'boolean'
    ? preferFileDelivery
    : shouldPreferSchedulePdfFileDelivery({ windowObject, navigatorObject });

  if (fileDelivery) {
    const shared = await trySharePdf(blob, filename, { navigatorObject, FileCtor });
    if (shared) return shared;
    return downloadBlob(blob, filename, { windowObject, documentObject, urlApi });
  }

  const url = urlApi.createObjectURL(blob);
  let viewer = null;
  try {
    viewer = typeof windowObject?.open === 'function' ? windowObject.open(url, '_blank') : null;
  } catch (_) {
    viewer = null;
  }
  if (viewer) {
    scheduleRevoke(url, { windowObject, urlApi });
    return { method: 'viewer', blob, url };
  }

  try { urlApi.revokeObjectURL(url); } catch (_) {}
  return downloadBlob(blob, filename, { windowObject, documentObject, urlApi });
}
