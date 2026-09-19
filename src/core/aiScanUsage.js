import { PDFDocument } from 'pdf-lib';

export const DEFAULT_INVOICE_AI_PAGE_LIMIT = 40;
export const DEFAULT_MENU_AI_PAGE_LIMIT = 10;

export const createAiScanIdempotencyKey = (scanType, restaurantId) => {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${scanType || 'scan'}:${restaurantId || 'workspace'}:${random}`;
};

export const resolveClientScanPageCount = async (filesOrFile) => {
  const files = Array.isArray(filesOrFile) ? filesOrFile : [filesOrFile];
  const cleanFiles = files.filter(Boolean);
  if (!cleanFiles.length) throw new Error('Choose an image or PDF first.');

  let pages = 0;
  for (const file of cleanFiles) {
    const type = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    if (type.startsWith('image/')) {
      pages += 1;
      continue;
    }
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      try {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true });
        const count = pdf.getPageCount();
        if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error('Unsafe PDF page count.');
        pages += count;
      } catch (_) {
        const error = new Error('The PDF page count could not be verified safely. Split, repair, or re-export the PDF before scanning.');
        error.code = 'AI_PDF_PAGE_COUNT_REQUIRED';
        throw error;
      }
      continue;
    }
    throw new Error('AI scans must use a supported image or PDF file.');
  }
  return pages;
};

export const normalizeAiUsage = (usage = {}, scanType = 'invoice') => {
  const isMenu = scanType === 'menu';
  const usedRaw = Number(isMenu ? usage.menuPagesUsed : usage.invoicePagesUsed);
  const limitRaw = Number(isMenu ? usage.menuPagesLimit : usage.invoicePagesLimit);
  const processedRaw = Number(isMenu ? usage.menuPagesProcessed : usage.invoicePagesProcessed);
  const bypassRaw = Number(isMenu ? usage.menuBypassPagesProcessed : usage.invoiceBypassPagesProcessed);
  const used = Number.isFinite(usedRaw) && usedRaw >= 0 ? usedRaw : 0;
  const processed = Number.isFinite(processedRaw) && processedRaw >= 0 ? Math.max(used, processedRaw) : used;
  const bypass = Number.isFinite(bypassRaw) && bypassRaw >= 0 ? bypassRaw : Math.max(0, processed - used);
  const limit = Number.isFinite(limitRaw) && limitRaw >= 0
    ? limitRaw
    : (isMenu ? DEFAULT_MENU_AI_PAGE_LIMIT : DEFAULT_INVOICE_AI_PAGE_LIMIT);
  return {
    used,
    processed,
    bypass,
    limit,
    remaining: Math.max(0, limit - used),
    reached: used >= limit
  };
};

export const aiPageLimitMessage = (scanType, usage, requestedPages = 0) => {
  const label = scanType === 'menu' ? 'menu' : 'invoice';
  const normalized = normalizeAiUsage(usage, scanType);
  if (normalized.reached) return `This restaurant has used all ${label} AI pages for this month.`;
  if (requestedPages > normalized.remaining) return `This ${label} needs ${requestedPages} AI pages, but only ${normalized.remaining} remain this month.`;
  if (normalized.remaining <= 3) return `Only ${normalized.remaining} ${label} AI page${normalized.remaining === 1 ? '' : 's'} left this month.`;
  return '';
};
