function pad(value) { return String(value).padStart(2, '0'); }
function fmt(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function clean(value = '') { return String(value).replace(/\s+/g, ' ').trim(); }
function crop(value, max = 165) { const text = clean(value); return text.length > max ? `${text.slice(0, max - 1)}…` : text; }

export default async function* nodeLiveTimer(source) {
  const iterator = source[Symbol.asyncIterator]();
  const active = new Map();
  let nextPromise = iterator.next();
  let lastTick = 0;
  while (true) {
    const result = await Promise.race([
      nextPromise.then(value => ({ kind: 'event', value })),
      new Promise(resolve => setTimeout(() => resolve({ kind: 'tick' }), 1000)),
    ]);
    if (result.kind === 'tick') {
      if (active.size) {
        const row = [...active.values()].sort((a, b) => a.startedAt - b.startedAt)[0];
        const now = Date.now();
        if (now - lastTick >= 1000) {
          yield `[RUNNING ${fmt(now - row.startedAt)}] [NODE] ${row.label}\n`;
          lastTick = now;
        }
      }
      continue;
    }
    const { value, done } = result.value;
    if (done) break;
    nextPromise = iterator.next();
    const type = value?.type || '';
    const data = value?.data || {};
    const key = `${data.file || ''}|${data.name || ''}|${data.nesting || 0}`;
    if (type === 'test:start') {
      const row = { label: crop(data.name || 'Unnamed node test'), startedAt: Date.now() };
      active.set(key, row);
      yield `START [NODE] ${row.label}\n`;
    } else if (type === 'test:pass' || type === 'test:fail') {
      const row = active.get(key) || { label: crop(data.name || 'Unnamed node test'), startedAt: Date.now() - Number(data.details?.duration_ms || 0) };
      active.delete(key);
      const status = type === 'test:pass' ? 'PASS' : 'FAIL';
      const duration = Number(data.details?.duration_ms || (Date.now() - row.startedAt));
      yield `${status} ${fmt(duration)} [NODE] ${row.label}\n`;
      if (type === 'test:fail' && data.details?.error?.message) yield `  ${crop(data.details.error.message, 1000)}\n`;
    } else if (type === 'test:diagnostic') {
      yield `  ${clean(data.message || '')}\n`;
    } else if (type === 'test:stderr' || type === 'test:stdout') {
      if (data.message) yield String(data.message);
    }
  }
}
