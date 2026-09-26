jest.setTimeout(15000);
import { PDFDocument } from 'pdf-lib';
import { buildMonthSchedulePrintModel } from './schedulePrintModel';
import { generateMonthSchedulePdf, PAGE_WIDTH, PAGE_HEIGHT, MIN_FONT_SIZE } from './schedulePdf';

const fs = require('fs');
const { spawnSync } = require('child_process');
const fontkit = require('@pdf-lib/fontkit');
const fontPaths = [
  '@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff','@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff',
  '@fontsource/noto-sans/files/noto-sans-latin-ext-400-normal.woff','@fontsource/noto-sans/files/noto-sans-latin-ext-700-normal.woff',
  '@fontsource/noto-sans/files/noto-sans-cyrillic-400-normal.woff','@fontsource/noto-sans/files/noto-sans-cyrillic-700-normal.woff',
  '@fontsource/noto-sans/files/noto-sans-greek-400-normal.woff','@fontsource/noto-sans/files/noto-sans-greek-700-normal.woff',
  '@fontsource/noto-sans/files/noto-sans-vietnamese-400-normal.woff','@fontsource/noto-sans/files/noto-sans-vietnamese-700-normal.woff',
  '@fontsource/noto-sans/files/noto-sans-devanagari-400-normal.woff','@fontsource/noto-sans/files/noto-sans-devanagari-700-normal.woff',
  '@fontsource/noto-sans-sc/files/noto-sans-sc-115-400-normal.woff','@fontsource/noto-sans-sc/files/noto-sans-sc-115-700-normal.woff'
];
const pdfOptions = { fontkit, fontAssets: fontPaths.map(path => new Uint8Array(fs.readFileSync(require.resolve(path)))) };

const makeModel = count => buildMonthSchedulePrintModel({
  monthStr: '2026-08', restaurantName: 'Cheers', roleFilter: 'All', prefiltered: true,
  shifts: Array.from({ length: count }, (_, index) => ({ date: '2026-08-03', published: true, dedupeKey: `s-${index}`, employeeName: `Employee ${index}`, role: 'Cook', startTime: '10:00', endTime: '18:00' }))
});

const extractPdfText = bytes => {
  const extractor = `
    import fs from 'node:fs';
    import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
    const data = new Uint8Array(fs.readFileSync(0));
    const loaded = await pdfjs.getDocument({ data, disableWorker: true, isEvalSupported: false }).promise;
    const text = [];
    for (let pageNumber = 1; pageNumber <= loaded.numPages; pageNumber += 1) {
      const content = await (await loaded.getPage(pageNumber)).getTextContent();
      text.push(...content.items.map(item => item.str));
    }
    process.stdout.write(JSON.stringify({ pages: loaded.numPages, text: text.join(' ') }));
  `;
  const extraction = spawnSync(process.execPath, ['--input-type=module', '-e', extractor], { cwd: process.cwd(), input: Buffer.from(bytes), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  expect(extraction.status).toBe(0);
  return JSON.parse(extraction.stdout);
};

test('generates a valid single-page US Letter landscape PDF that can be reopened', async () => {
  const bytes = await generateMonthSchedulePdf(makeModel(4), pdfOptions);
  expect(Array.from(bytes.slice(0, 5))).toEqual(Array.from(new TextEncoder().encode('%PDF-')));
  const loaded = await PDFDocument.load(bytes);
  expect(loaded.getPageCount()).toBe(1);
  const page = loaded.getPage(0);
  expect(page.getWidth()).toBe(PAGE_WIDTH);
  expect(page.getHeight()).toBe(PAGE_HEIGHT);
  expect(MIN_FONT_SIZE).toBeGreaterThanOrEqual(6.5);
});

test('a realistically dense day remains on the single Month calendar page', async () => {
  const bytes = await generateMonthSchedulePdf(makeModel(7), pdfOptions);
  const loaded = await PDFDocument.load(bytes);
  expect(loaded.getPageCount()).toBe(1);
});

test('impossible one-page density spills to deterministic detail pages without clipping shifts', async () => {
  const bytes = await generateMonthSchedulePdf(makeModel(75), pdfOptions);
  const extracted = extractPdfText(bytes);
  expect(extracted.pages).toBeGreaterThan(1);
  expect(extracted.text).toMatch(/detail page/i);
  expect(extracted.text).toContain('Employee 74');
  expect(extracted.text).toContain('Cook');
});

test('long and Unicode names remain on the single calendar page', async () => {
  const model = makeModel(1);
  model.cells.find(cell => cell.date === '2026-08-03').shifts[0].label = 'Zoë 李 With An Exceptionally Long Employee Name · 10:00 AM – 6:00 PM';
  const bytes = await generateMonthSchedulePdf(model, pdfOptions);
  const loaded = await PDFDocument.load(bytes);
  expect(loaded.getPageCount()).toBe(1);
  expect(loaded.getKeywords()).toContain('shift:s-0');
});

test('normal-density rendered PDF uses 12-hour time, omits role text, and stays on the month page', async () => {
  const model = buildMonthSchedulePrintModel({
    monthStr: '2026-08', restaurantName: 'Cheers', roleFilter: 'All', prefiltered: true,
    shifts: [{ date: '2026-08-03', published: true, dedupeKey: 's-0', employeeName: 'Zoë 李', role: 'Cook', startTime: '10:00', endTime: '18:00' }]
  });
  const bytes = await generateMonthSchedulePdf(model, pdfOptions);
  const extracted = extractPdfText(bytes);
  expect(extracted.pages).toBe(1);
  expect(extracted.text).toContain('Zoë');
  expect(extracted.text).toContain('李');
  expect(extracted.text).toContain('10:00 AM');
  expect(extracted.text).toContain('6:00 PM');
  expect(extracted.text).not.toContain('Cook');
  expect(extracted.text).not.toMatch(/detail page/i);
});


test('calendar cells wrap full shift text instead of ellipsizing employee or time', async () => {
  const model = buildMonthSchedulePrintModel({
    monthStr: '2026-08', restaurantName: 'Cheers', roleFilter: 'All', prefiltered: true,
    shifts: [
      { date: '2026-08-03', published: true, dedupeKey: 'full-1', employeeName: 'Geoff Test', role: 'Cook', startTime: '16:00', endTime: '21:00' },
      { date: '2026-08-03', published: true, dedupeKey: 'full-2', employeeName: 'Open Shift', role: 'Cook', startTime: '16:00', endTime: '21:00' },
      { date: '2026-08-03', published: true, dedupeKey: 'full-3', employeeName: 'Employee With A Longer Name', role: 'Cook', startTime: '15:15', endTime: '21:00' }
    ]
  });
  const bytes = await generateMonthSchedulePdf(model, pdfOptions);
  const extracted = extractPdfText(bytes);
  expect(extracted.pages).toBe(1);
  const normalizedText = extracted.text.replace(/\s+/g, ' ');
  expect(normalizedText).toContain('Geoff Test');
  expect(normalizedText).toContain('Open Shift');
  expect(normalizedText).toContain('Employee With A Longer Name');
  expect(normalizedText).toContain('4:00 PM');
  expect(normalizedText).toContain('9:00 PM');
  expect(normalizedText).toContain('3:15 PM');
  expect(extracted.text).not.toContain('…');
  expect(extracted.text).not.toContain('Cook');
});

test('same model generates deterministic bytes', async () => {
  const model = makeModel(7); const first = await generateMonthSchedulePdf(model, pdfOptions); const second = await generateMonthSchedulePdf(model, pdfOptions);
  expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
});

test('PDF generation is read-only and has no Firebase or schedule mutation dependency', () => {
  const fs = require('fs'); const source = fs.readFileSync(require.resolve('./schedulePdf'), 'utf8');
  expect(source).not.toMatch(/firebase|setDoc|updateDoc|deleteDoc|writeBatch|addDoc/i);
  expect(source).toMatch(/detail page/i);
  expect(source).toMatch(/detailLabel/);
});
