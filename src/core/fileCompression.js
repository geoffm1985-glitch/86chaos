const MB = 1024 * 1024;

export const DEFAULT_SCAN_MAX_BYTES = 20 * MB;
export const DEFAULT_IMAGE_TARGET_BYTES = 8 * MB;

export const formatScannerBytes = (bytes = 0) => {
  const safeBytes = Math.max(0, Number(bytes) || 0);
  if (safeBytes >= MB) return `${(safeBytes / MB).toFixed(1)}MB`;
  if (safeBytes >= 1024) return `${Math.round(safeBytes / 1024)}KB`;
  return `${safeBytes}B`;
};

export const isPdfFile = (file = {}) => {
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  return type === 'application/pdf' || name.endsWith('.pdf');
};

export const isCompressibleImageFile = (file = {}) => {
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  return type.startsWith('image/') || /\.(jpe?g|png|webp|bmp)$/i.test(name);
};

const withSuffix = (name = 'scan', suffix = 'compressed', ext = '') => {
  const cleanExt = ext ? `.${String(ext).replace(/^\./, '')}` : '';
  const base = String(name || 'scan').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 70) || 'scan';
  return `${base}_${suffix}${cleanExt}`;
};

const loadImageFromFile = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    resolve(img);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('This image could not be opened for automatic compression. Try JPG/PNG, or use fewer pages.'));
  };
  img.src = url;
});

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('The browser could not create a compressed scan file.'));
  }, type, quality);
});

const makeImageAttempt = async (image, originalName, maxDimension, quality) => {
  const width = Number(image.naturalWidth || image.width || 0);
  const height = Number(image.naturalHeight || image.height || 0);
  if (!width || !height) throw new Error('This image has no readable dimensions.');
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  return new File([blob], withSuffix(originalName, 'compressed', 'jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now()
  });
};

export async function compressImageForScan(file, options = {}) {
  const {
    maxBytes = DEFAULT_SCAN_MAX_BYTES,
    targetBytes = DEFAULT_IMAGE_TARGET_BYTES,
    maxDimension = 2600,
    label = 'Scan file',
    onProgress = null
  } = options;

  const target = Math.min(Math.max(1 * MB, Number(targetBytes) || DEFAULT_IMAGE_TARGET_BYTES), maxBytes);
  onProgress?.({ phase: 'compress', percent: 6, label: `Preparing ${label}`, detail: `Compressing photo from ${formatScannerBytes(file.size)} for faster scanning.` });
  const image = await loadImageFromFile(file);

  const dimensionSteps = Array.from(new Set([maxDimension, 2400, 2100, 1800, 1500, 1200].filter(v => v > 0)));
  const qualitySteps = [0.86, 0.8, 0.74, 0.68, 0.62, 0.56];
  let best = null;
  let attempt = 0;
  const totalAttempts = dimensionSteps.length * qualitySteps.length;

  for (const dim of dimensionSteps) {
    for (const quality of qualitySteps) {
      attempt += 1;
      onProgress?.({
        phase: 'compress',
        percent: Math.min(38, 8 + Math.round((attempt / totalAttempts) * 30)),
        label: `Compressing ${label}`,
        detail: `Optimizing photo quality ${Math.round(quality * 100)}%, max side ${dim}px.`
      });
      const candidate = await makeImageAttempt(image, file.name, dim, quality);
      if (!best || candidate.size < best.size) best = candidate;
      if (candidate.size <= target) return candidate;
      if (candidate.size <= maxBytes && file.size > maxBytes) return candidate;
    }
  }

  if (best && best.size <= maxBytes) return best;
  throw new Error(`${label} is still over ${formatScannerBytes(maxBytes)} after automatic photo compression. Try cropping the image, changing camera quality to standard, or splitting the scan.`);
}

export async function compactPdfForScan(file, options = {}) {
  const {
    maxBytes = DEFAULT_SCAN_MAX_BYTES,
    label = 'PDF',
    onProgress = null
  } = options;

  onProgress?.({ phase: 'compress', percent: 6, label: `Preparing ${label}`, detail: `Trying automatic PDF compaction from ${formatScannerBytes(file.size)}.` });
  try {
    const { PDFDocument } = await import('pdf-lib');
    onProgress?.({ phase: 'compress', percent: 14, label: `Compacting ${label}`, detail: 'Reading PDF structure.' });
    const originalBytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true, updateMetadata: false });
    onProgress?.({ phase: 'compress', percent: 26, label: `Compacting ${label}`, detail: 'Re-saving PDF with object stream compression.' });
    const compactBytes = await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 });
    const compactFile = new File([compactBytes], withSuffix(file.name, 'compressed', 'pdf'), {
      type: 'application/pdf',
      lastModified: Date.now()
    });

    if (compactFile.size < file.size && compactFile.size <= maxBytes) return compactFile;
    if (file.size <= maxBytes) return file;

    throw new Error(`${label} could not be automatically compacted under ${formatScannerBytes(maxBytes)}. Split the PDF or export fewer pages. Scanned-image PDFs often need to be split because the pictures inside the PDF cannot be safely downsampled in-browser.`);
  } catch (err) {
    if (file.size <= maxBytes) return file;
    if (/could not be automatically compacted/i.test(err?.message || '')) throw err;
    throw new Error(`${label} could not be automatically compressed in this browser. Split the PDF or export fewer pages.`);
  }
}

export async function prepareScannerUploadFile(file, options = {}) {
  const {
    maxBytes = DEFAULT_SCAN_MAX_BYTES,
    imageCompressAboveBytes = 6 * MB,
    targetImageBytes = DEFAULT_IMAGE_TARGET_BYTES,
    maxImageDimension = 2600,
    label = 'scan file',
    onProgress = null
  } = options;

  if (!file) throw new Error('Choose a file to scan first.');
  const original = {
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream'
  };

  let preparedFile = file;
  let compression = {
    wasCompressed: false,
    method: 'none',
    originalName: original.name,
    originalSize: original.size,
    compressedName: file.name,
    compressedSize: file.size,
    note: ''
  };

  if (isCompressibleImageFile(file) && (file.size > maxBytes || file.size >= imageCompressAboveBytes)) {
    preparedFile = await compressImageForScan(file, {
      maxBytes,
      targetBytes: targetImageBytes,
      maxDimension: maxImageDimension,
      label,
      onProgress
    });
    if (preparedFile.size < file.size) {
      compression = {
        wasCompressed: true,
        method: 'image-canvas-jpeg',
        originalName: original.name,
        originalSize: original.size,
        compressedName: preparedFile.name,
        compressedSize: preparedFile.size,
        note: `Compressed photo from ${formatScannerBytes(file.size)} to ${formatScannerBytes(preparedFile.size)}.`
      };
    } else {
      preparedFile = file;
    }
  } else if (isPdfFile(file) && file.size > maxBytes) {
    preparedFile = await compactPdfForScan(file, { maxBytes, label, onProgress });
    if (preparedFile.size < file.size) {
      compression = {
        wasCompressed: true,
        method: 'pdf-object-stream-compaction',
        originalName: original.name,
        originalSize: original.size,
        compressedName: preparedFile.name,
        compressedSize: preparedFile.size,
        note: `Compacted PDF from ${formatScannerBytes(file.size)} to ${formatScannerBytes(preparedFile.size)}.`
      };
    }
  }

  if (preparedFile.size > maxBytes) {
    throw new Error(`${label} is over ${formatScannerBytes(maxBytes)}. Split it into smaller files or upload fewer pages.`);
  }

  onProgress?.({ phase: 'compress', percent: 40, label: `${label} ready`, detail: compression.wasCompressed ? compression.note : `${label} is already under the scanner limit.` });

  return {
    file: preparedFile,
    original,
    compression,
    wasCompressed: compression.wasCompressed,
    displaySizeBefore: formatScannerBytes(original.size),
    displaySizeAfter: formatScannerBytes(preparedFile.size)
  };
}
