import { deliverSchedulePdf, shouldPreferSchedulePdfFileDelivery } from './schedulePdfDelivery';

function makeDownloadEnvironment({ openResult = null, mobile = false } = {}) {
  const revoked = [];
  const timers = [];
  const opened = [];
  const links = [];
  const urlApi = {
    createObjectURL: blob => {
      expect(blob.type).toBe('application/pdf');
      return `blob:pdf-${links.length + opened.length + 1}`;
    },
    revokeObjectURL: url => revoked.push(url)
  };
  const windowObject = {
    Blob,
    File: typeof File !== 'undefined' ? File : null,
    navigator: { maxTouchPoints: mobile ? 5 : 0 },
    matchMedia: query => ({ matches: mobile && query === '(pointer: coarse)' }),
    setTimeout: fn => { timers.push(fn); return timers.length; },
    open: (url, target) => { opened.push({ url, target }); return openResult; }
  };
  const documentObject = {
    body: { appendChild(link) { links.push(link); } },
    createElement: () => ({ href: '', download: '', rel: '', clickCalled: 0, click() { this.clickCalled += 1; }, remove() {} })
  };
  return { revoked, timers, opened, links, urlApi, windowObject, documentObject };
}

test('mobile/coarse-pointer delivery never opens about:blank and downloads a real PDF', async () => {
  const env = makeDownloadEnvironment({ mobile: true });
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 49]);
  const result = await deliverSchedulePdf(bytes, { filename: 'schedule.pdf', ...env });
  expect(result.method).toBe('download');
  expect(env.opened).toEqual([]);
  expect(env.links).toHaveLength(1);
  expect(env.links[0].download).toBe('schedule.pdf');
  expect(env.links[0].href).toMatch(/^blob:pdf-/);
  expect(env.links[0].clickCalled).toBe(1);
  expect(result.blob.type).toBe('application/pdf');
  expect(env.revoked).toEqual([]);
  env.timers[0]();
  expect(env.revoked).toEqual([result.url]);
});

test('supported mobile Web Share receives a PDF File and does not open or download', async () => {
  const env = makeDownloadEnvironment({ mobile: true });
  class FakeFile {
    constructor(parts, name, options) { this.parts = parts; this.name = name; this.type = options.type; }
  }
  const shared = [];
  env.windowObject.File = FakeFile;
  env.windowObject.navigator.canShare = payload => Array.isArray(payload.files) && payload.files[0]?.type === 'application/pdf';
  env.windowObject.navigator.share = async payload => { shared.push(payload); };
  const result = await deliverSchedulePdf(new Uint8Array([1, 2, 3]), { filename: 'schedule.pdf', ...env, FileCtor: FakeFile, navigatorObject: env.windowObject.navigator });
  expect(result.method).toBe('share');
  expect(shared).toHaveLength(1);
  expect(shared[0].files[0].name).toBe('schedule.pdf');
  expect(shared[0].files[0].type).toBe('application/pdf');
  expect(env.opened).toEqual([]);
  expect(env.links).toEqual([]);
});

test('share cancellation is not followed by a duplicate download, while other share failures fall back', async () => {
  class FakeFile { constructor(parts, name, options) { this.name = name; this.type = options.type; } }
  const cancelledEnv = makeDownloadEnvironment({ mobile: true });
  cancelledEnv.windowObject.navigator.canShare = () => true;
  cancelledEnv.windowObject.navigator.share = async () => { const error = new Error('cancelled'); error.name = 'AbortError'; throw error; };
  const cancelled = await deliverSchedulePdf(new Uint8Array([1]), { filename: 'x.pdf', ...cancelledEnv, FileCtor: FakeFile, navigatorObject: cancelledEnv.windowObject.navigator });
  expect(cancelled.method).toBe('share-cancelled');
  expect(cancelledEnv.links).toEqual([]);

  const failedEnv = makeDownloadEnvironment({ mobile: true });
  failedEnv.windowObject.navigator.canShare = () => true;
  failedEnv.windowObject.navigator.share = async () => { throw new Error('share unavailable'); };
  const failed = await deliverSchedulePdf(new Uint8Array([1]), { filename: 'x.pdf', ...failedEnv, FileCtor: FakeFile, navigatorObject: failedEnv.windowObject.navigator });
  expect(failed.method).toBe('download');
  expect(failedEnv.links).toHaveLength(1);
  expect(failedEnv.opened).toEqual([]);
});

test('desktop opens the generated Blob URL directly and popup blocking falls back to download', async () => {
  const viewer = {};
  const openedEnv = makeDownloadEnvironment({ openResult: viewer });
  const opened = await deliverSchedulePdf(new Uint8Array([1]), { filename: 'schedule.pdf', ...openedEnv });
  expect(opened.method).toBe('viewer');
  expect(openedEnv.opened).toHaveLength(1);
  expect(openedEnv.opened[0].url).toMatch(/^blob:pdf-/);
  expect(openedEnv.opened[0].url).not.toBe('about:blank');
  expect(openedEnv.opened[0].target).toBe('_blank');
  expect(openedEnv.links).toEqual([]);

  const blockedEnv = makeDownloadEnvironment({ openResult: null });
  const blocked = await deliverSchedulePdf(new Uint8Array([1]), { filename: 'schedule.pdf', ...blockedEnv });
  expect(blocked.method).toBe('download');
  expect(blockedEnv.opened).toHaveLength(1);
  expect(blockedEnv.opened[0].url).toMatch(/^blob:pdf-/);
  expect(blockedEnv.links).toHaveLength(1);
});

test('mobile/PWA preference uses capability signals rather than user-agent text alone', () => {
  expect(shouldPreferSchedulePdfFileDelivery({ windowObject: { matchMedia: () => ({ matches: false }) }, navigatorObject: { userAgentData: { mobile: true } } })).toBe(true);
  expect(shouldPreferSchedulePdfFileDelivery({ windowObject: { matchMedia: query => ({ matches: query === '(display-mode: standalone)' }) }, navigatorObject: {} })).toBe(true);
  expect(shouldPreferSchedulePdfFileDelivery({ windowObject: { matchMedia: query => ({ matches: query === '(pointer: coarse)' }) }, navigatorObject: { maxTouchPoints: 2 } })).toBe(true);
  expect(shouldPreferSchedulePdfFileDelivery({ windowObject: { matchMedia: () => ({ matches: false }) }, navigatorObject: { maxTouchPoints: 0 } })).toBe(false);
});

test('delivery helper contains no about:blank, location.replace, browser print, or schedule write path', () => {
  const source = require('fs').readFileSync(require.resolve('./schedulePdfDelivery'), 'utf8');
  expect(source).not.toMatch(/about:blank|location\.replace|window\.print|setDoc|updateDoc|deleteDoc|writeBatch|addDoc/);
});
