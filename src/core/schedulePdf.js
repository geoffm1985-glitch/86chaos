const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN = 24;
const GRID_SIDE_MARGIN = 8;
const GRID_BOTTOM_MARGIN = 12;
const MIN_FONT_SIZE = 6.5;
const FONT_SUBSETS = Object.freeze(['latin', 'latin-ext', 'cyrillic', 'greek', 'vietnamese', 'devanagari', 'cjk-common-115']);

const graphemes = value => {
  const text = String(value == null ? '' : value);
  if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(row => row.segment);
  return Array.from(text);
};

async function bundledFontAssets() {
  const modules = await Promise.all([
    import('@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'), import('@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff'),
    import('@fontsource/noto-sans/files/noto-sans-latin-ext-400-normal.woff'), import('@fontsource/noto-sans/files/noto-sans-latin-ext-700-normal.woff'),
    import('@fontsource/noto-sans/files/noto-sans-cyrillic-400-normal.woff'), import('@fontsource/noto-sans/files/noto-sans-cyrillic-700-normal.woff'),
    import('@fontsource/noto-sans/files/noto-sans-greek-400-normal.woff'), import('@fontsource/noto-sans/files/noto-sans-greek-700-normal.woff'),
    import('@fontsource/noto-sans/files/noto-sans-vietnamese-400-normal.woff'), import('@fontsource/noto-sans/files/noto-sans-vietnamese-700-normal.woff'),
    import('@fontsource/noto-sans/files/noto-sans-devanagari-400-normal.woff'), import('@fontsource/noto-sans/files/noto-sans-devanagari-700-normal.woff'),
    import('@fontsource/noto-sans-sc/files/noto-sans-sc-115-400-normal.woff'), import('@fontsource/noto-sans-sc/files/noto-sans-sc-115-700-normal.woff')
  ]);
  const urls = modules.map(module => module.default || module);
  return Promise.all(urls.map(async url => {
    const response = await fetch(url); if (!response.ok) throw new Error('The bundled schedule font could not be loaded.'); return new Uint8Array(await response.arrayBuffer());
  }));
}

async function embedFontFamilies(document, options = {}) {
  const fontkitModule = options.fontkit || await import('@pdf-lib/fontkit');
  document.registerFontkit(fontkitModule.default || fontkitModule);
  const assets = options.fontAssets || await bundledFontAssets();
  if (!Array.isArray(assets) || assets.length !== FONT_SUBSETS.length * 2) throw new Error('The schedule PDF Unicode font set is incomplete.');
  const regular = []; const bold = [];
  for (let index = 0; index < assets.length; index += 2) {
    regular.push(await document.embedFont(assets[index], { subset: true }));
    bold.push(await document.embedFont(assets[index + 1], { subset: true }));
  }
  const coverage = family => family.map(font => new Set(font.getCharacterSet()));
  return { regular, bold, regularCoverage: coverage(regular), boldCoverage: coverage(bold) };
}

function selectFont(fonts, coverage, segment) {
  const codePoints = Array.from(segment).map(char => char.codePointAt(0)).filter(code => !/\s/u.test(String.fromCodePoint(code)));
  const index = coverage.findIndex(set => codePoints.every(code => set.has(code)));
  if (index < 0) {
    const code = codePoints[0] || 0;
    throw new Error(`The bundled schedule font cannot render Unicode character U+${code.toString(16).toUpperCase().padStart(4, '0')}. No shift was omitted; install a supported font subset before printing.`);
  }
  return fonts[index];
}
function textRuns(fontFamily, value, bold = false) {
  const fonts = bold ? fontFamily.bold : fontFamily.regular; const coverage = bold ? fontFamily.boldCoverage : fontFamily.regularCoverage;
  const runs = [];
  for (const segment of graphemes(value)) {
    const font = /^\s+$/u.test(segment) && runs.length ? runs[runs.length - 1].font : selectFont(fonts, coverage, segment);
    const previous = runs[runs.length - 1];
    if (previous?.font === font) previous.text += segment; else runs.push({ font, text: segment });
  }
  return runs;
}
const widthOfRuns = (runs, size) => runs.reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.text, size), 0);
const measureText = (fontFamily, value, size, bold = false) => widthOfRuns(textRuns(fontFamily, value, bold), size);
function drawRuns(page, fontFamily, value, { x, y, size, color, bold = false }) {
  let cursor = x;
  for (const run of textRuns(fontFamily, value, bold)) { page.drawText(run.text, { x: cursor, y, size, font: run.font, color }); cursor += run.font.widthOfTextAtSize(run.text, size); }
  return cursor;
}
function fitText(fontFamily, value, size, width, bold = false) {
  const source = String(value == null ? '' : value); if (measureText(fontFamily, source, size, bold) <= width) return source;
  const suffix = '…'; const pieces = graphemes(source); let result = '';
  for (const piece of pieces) { if (measureText(fontFamily, `${result}${piece}${suffix}`, size, bold) > width) break; result += piece; }
  return `${result}${suffix}`;
}
function wrapText(fontFamily, value, size, width, bold = false) {
  const source = String(value == null ? '' : value);
  const output = [];
  for (const paragraph of source.split('\n')) {
    const words = paragraph.match(/\S+\s*/gu) || [''];
    let line = '';
    for (const wordWithSpace of words) {
      const word = wordWithSpace.trimEnd();
      const separator = line ? ' ' : '';
      const candidate = `${line}${separator}${word}`;
      if (!line || measureText(fontFamily, candidate, size, bold) <= width) {
        line = candidate;
        continue;
      }
      output.push(line);
      if (measureText(fontFamily, word, size, bold) <= width) {
        line = word;
        continue;
      }
      let fragment = '';
      for (const piece of graphemes(word)) {
        const fragmentCandidate = `${fragment}${piece}`;
        if (!fragment || measureText(fontFamily, fragmentCandidate, size, bold) <= width) fragment = fragmentCandidate;
        else { output.push(fragment); fragment = piece; }
      }
      line = fragment;
    }
    if (line || !output.length) output.push(line);
  }
  return output;
}

function compactShiftLabel(shift) {
  const employeeName = String(shift?.employeeName || 'Open Shift').trim();
  const timeLabel = String(shift?.timeLabel || '').trim().replace(/\s+([–-])\s+/gu, '$1');
  return [employeeName, timeLabel].filter(Boolean).join(' · ');
}

export async function generateMonthSchedulePdf(model, options = {}) {
  if (!model || model.page?.width !== PAGE_WIDTH || model.page?.height !== PAGE_HEIGHT) throw new Error('The Month Schedule PDF model is invalid.');
  const pdfLib = options.pdfLib || await import('pdf-lib'); const { PDFDocument, rgb } = pdfLib;
  const document = await PDFDocument.create(); const fonts = await embedFontFamilies(document, options);
  document.setTitle(`86 Chaos Schedule ${model.monthTitle}`); document.setAuthor('86 Chaos'); document.setCreator('86 Chaos'); document.setProducer('86 Chaos 17.0.24');
  document.setKeywords(['86 Chaos', 'schedule', ...model.visibleShifts.map(shift => `shift:${shift.dedupeKey}`)]);
  const fixedDate = new Date('2000-01-01T00:00:00.000Z'); document.setCreationDate(fixedDate); document.setModificationDate(fixedDate);
  const black = rgb(0, 0, 0); const gray = rgb(0.94, 0.95, 0.96); const light = rgb(0.98, 0.98, 0.98); const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const title = [model.restaurantName, '86 Chaos Schedule', model.monthTitle, model.roleFilter !== 'All' ? model.roleFilter : ''].filter(Boolean).join(' · ');
  drawRuns(page, fonts, fitText(fonts, title, 15, PAGE_WIDTH - MARGIN * 2, true), { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 15, size: 15, bold: true, color: black });
  drawRuns(page, fonts, `${model.shiftCount} published shift${model.shiftCount === 1 ? '' : 's'} · Review-only PDF`, { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 29, size: 8, color: black });
  const gridTop = PAGE_HEIGHT - MARGIN - 42; const weekdayHeight = 18; const gridWidth = PAGE_WIDTH - GRID_SIDE_MARGIN * 2; const columnWidth = gridWidth / 7; const rowHeight = (gridTop - GRID_BOTTOM_MARGIN - weekdayHeight) / model.weekCount;
  model.weekdayHeadings.forEach((day, index) => {
    const x = GRID_SIDE_MARGIN + index * columnWidth; page.drawRectangle({ x, y: gridTop - weekdayHeight, width: columnWidth, height: weekdayHeight, color: gray, borderColor: black, borderWidth: 0.7 });
    drawRuns(page, fonts, day, { x: x + columnWidth / 2 - measureText(fonts, day, 9, true) / 2, y: gridTop - 12.5, size: 9, bold: true, color: black });
  });
  model.cells.forEach(cell => {
    const x = GRID_SIDE_MARGIN + cell.weekdayIndex * columnWidth; const y = gridTop - weekdayHeight - (cell.weekIndex + 1) * rowHeight;
    page.drawRectangle({ x, y, width: columnWidth, height: rowHeight, color: cell.inMonth ? undefined : light, borderColor: black, borderWidth: 0.7 });
    if (!cell.inMonth) return;
    drawRuns(page, fonts, String(cell.dayNumber), { x: x + columnWidth - 13, y: y + rowHeight - 11, size: 9, bold: true, color: black });

    if (!cell.shifts.length) return;
    const contentHeight = Math.max(0, rowHeight - 24);
    const textWidth = columnWidth - 7;
    const candidateSizes = [8, 7.5, 7, MIN_FONT_SIZE];
    let layout = null;

    for (const fontSize of candidateSizes) {
      const lineHeight = fontSize + 0.75;
      const shiftGap = 0.5;
      const entries = cell.shifts.map(shift => {
        const fullLabel = String(shift.label || '').trim();
        const compactLabel = compactShiftLabel(shift);
        let lines;
        if (measureText(fonts, fullLabel, fontSize) <= textWidth) {
          lines = [fullLabel];
        } else if (measureText(fonts, compactLabel, fontSize) <= textWidth) {
          lines = [compactLabel];
        } else {
          const nameLines = wrapText(fonts, shift.employeeName || 'Open Shift', fontSize, textWidth);
          const timeLines = shift.timeLabel ? wrapText(fonts, shift.timeLabel, fontSize, textWidth) : [];
          lines = [...nameLines, ...timeLines].filter(Boolean);
        }
        return { shift, lines };
      });
      const lineCount = entries.reduce((sum, entry) => sum + entry.lines.length, 0);
      const requiredHeight = lineCount * lineHeight + Math.max(0, entries.length - 1) * shiftGap;
      if (requiredHeight <= contentHeight + 0.01) {
        layout = { fontSize, lineHeight, shiftGap, entries };
        break;
      }
    }

    if (!layout) {
      throw new Error(`The Month Schedule PDF cannot fit all ${cell.shifts.length} shifts for ${cell.date} on one calendar page without hiding shift text. Reduce the visible schedule density or print a filtered month.`);
    }

    let cursorY = y + rowHeight - 23;
    layout.entries.forEach((entry, entryIndex) => {
      entry.lines.forEach(line => {
        drawRuns(page, fonts, line, { x: x + 3, y: cursorY, size: layout.fontSize, color: black });
        cursorY -= layout.lineHeight;
      });
      if (entryIndex < layout.entries.length - 1) cursorY -= layout.shiftGap;
    });
  });
  return document.save({ useObjectStreams: false, addDefaultPage: false });
}

export { PAGE_WIDTH, PAGE_HEIGHT, MIN_FONT_SIZE, FONT_SUBSETS, graphemes, wrapText, measureText, fitText };
