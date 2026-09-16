import { deliverSchedulePdf } from './schedulePdfDelivery';

test('viewer success and popup-blocked download both preserve real PDF bytes and revoke the Blob URL', async () => {
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 49]); const revoked = []; const timers = []; let clicked = 0;
  const urlApi = { createObjectURL: blob => { expect(blob.type).toBe('application/pdf'); return 'blob:pdf'; }, revokeObjectURL: url => revoked.push(url) };
  const windowObject = { setTimeout: fn => { timers.push(fn); } };
  const documentObject = { body: { appendChild() {} }, createElement: () => ({ click() { clicked += 1; }, remove() {} }) };
  const viewer = { location: { replace(url) { expect(url).toBe('blob:pdf'); } } };
  const opened = deliverSchedulePdf(bytes, { viewer, filename: 'schedule.pdf', windowObject, documentObject, urlApi });
  expect(opened.method).toBe('viewer'); expect(clicked).toBe(0); timers.shift()(); expect(revoked).toEqual(['blob:pdf']);
  const downloaded = deliverSchedulePdf(bytes, { viewer: null, filename: 'schedule.pdf', windowObject, documentObject, urlApi });
  expect(downloaded.method).toBe('download'); expect(clicked).toBe(1); const buffer = await new Response(downloaded.blob).arrayBuffer(); expect(Array.from(new Uint8Array(buffer))).toEqual(Array.from(bytes)); timers.shift()(); expect(revoked).toEqual(['blob:pdf','blob:pdf']);
});

test('viewer navigation exceptions use download and thrown download errors immediately clean up', () => {
  const revoked = []; let clicked = 0; const urlApi = { createObjectURL: () => 'blob:pdf', revokeObjectURL: url => revoked.push(url) }; const windowObject = { setTimeout: fn => fn() };
  const viewer = { location: { replace() { throw new Error('blocked'); } }, close() {} };
  const goodDocument = { body: { appendChild() {} }, createElement: () => ({ click() { clicked += 1; }, remove() {} }) };
  expect(deliverSchedulePdf(new Uint8Array([1]), { viewer, filename: 'x.pdf', windowObject, documentObject: goodDocument, urlApi }).method).toBe('download'); expect(clicked).toBe(1); expect(revoked).toContain('blob:pdf');
  const badDocument = { body: { appendChild() {} }, createElement: () => ({ click() { throw new Error('download failed'); }, remove() {} }) };
  expect(() => deliverSchedulePdf(new Uint8Array([1]), { filename: 'x.pdf', windowObject, documentObject: badDocument, urlApi })).toThrow(/download failed/); expect(revoked.filter(value => value === 'blob:pdf').length).toBeGreaterThanOrEqual(2);
});

test('delivery helper contains no browser print or schedule write path', () => {
  const source = require('fs').readFileSync(require.resolve('./schedulePdfDelivery'), 'utf8');
  expect(source).not.toMatch(/window\.print|setDoc|updateDoc|deleteDoc|writeBatch|addDoc/);
});
