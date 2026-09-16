export function deliverSchedulePdf(bytes, { viewer = null, filename, windowObject = window, documentObject = document, urlApi = URL } = {}) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = urlApi.createObjectURL(blob); let cleanupScheduled = false;
  const scheduleCleanup = delay => { cleanupScheduled = true; windowObject.setTimeout(() => urlApi.revokeObjectURL(url), delay); };
  const download = () => {
    const link = documentObject.createElement('a');
    try { link.href = url; link.download = filename; documentObject.body.appendChild(link); link.click(); }
    finally { try { link.remove(); } catch (_) {} }
  };
  try {
    if (viewer) {
      try { viewer.location.replace(url); scheduleCleanup(60000); return { method: 'viewer', blob }; }
      catch (_) { try { viewer.close(); } catch (_) {} }
    }
    download(); scheduleCleanup(1000); return { method: 'download', blob };
  } catch (error) {
    if (!cleanupScheduled) urlApi.revokeObjectURL(url);
    throw error;
  }
}
