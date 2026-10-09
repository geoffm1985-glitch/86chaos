const { test } = require('node:test');
const assert = require('node:assert/strict');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function setup(overrides = {}) {
  const { createNativeSpeechRecognition } = await import('../src/core/nativeSpeechClient.mjs');
  const handlers = new Map(), removed = [], calls = [];
  const plugin = {
    async addListener(name, callback) { handlers.set(name, callback); return { remove() { removed.push(name); } }; },
    async startSpeech(options) { calls.push(['start', options]); },
    async stopSpeech(options) { calls.push(['stop', options]); }, ...overrides
  };
  const rec = new (createNativeSpeechRecognition(plugin))();
  const events = [];
  rec.onresult = e => events.push({ text: e.results[0][0].transcript, final: e.results[0].isFinal });
  rec.onerror = e => events.push({ error: e.error });
  rec.onend = () => events.push({ ended: true });
  const emit = (name, data = {}) => handlers.get(name)?.({ sessionId: rec.sessionId, ...data });
  return { rec, events, calls, removed, emit };
}
test('native recognizer delivers partial and final transcripts in the existing Web Speech shape', async () => {
  const s = await setup(); s.rec.start(); await tick();
  assert.equal(s.calls[0][1].language, 'en-US');
  s.emit('speechResult', { text: 'open', isFinal: false });
  s.emit('speechResult', { text: 'open schedule', isFinal: true });
  s.emit('speechEnd'); s.emit('speechResult', { text: 'late command', isFinal: true });
  assert.deepEqual(s.events, [{text:'open',final:false},{text:'open schedule',final:true},{ended:true}]);
  assert.equal(s.removed.length, 4);
});
test('late callbacks from another session and after abort cannot commit a voice command', async () => {
  const s = await setup(); s.rec.start(); await tick();
  s.emit('speechResult', { sessionId: 'old-session', text: 'delete all', isFinal: true });
  s.rec.abort(); s.emit('speechResult', { text:'delete all',isFinal:true }); s.emit('speechEnd');
  assert.deepEqual(s.events, [{ended:true}]); assert.equal(s.calls.filter(row=>row[0]==='stop').length,1);
});
test('denied permission and missing recognizer finish once and release listeners', async () => {
  for (const code of ['not-allowed','service-not-allowed']) {
    const s = await setup({ async startSpeech() { throw Object.assign(new Error('Unavailable'), {code}); } });
    s.rec.start(); await tick(); s.emit('speechEnd');
    assert.deepEqual(s.events,[{error:code},{ended:true}]); assert.equal(s.removed.length,4);
  }
});
test('abort during permission prompt stops a service that finishes starting later', async () => {
  let resolve;
  const s = await setup({ startSpeech() { return new Promise(done=>{resolve=done;}); } });
  s.rec.start(); await tick(); s.rec.stop(); resolve(); await tick();
  assert.deepEqual(s.events,[{ended:true}]); assert.equal(s.calls.filter(row=>row[0]==='stop').length,2);
});
test('abort during listener registration removes the late handle without starting speech', async () => {
  let resolve, removed=0;
  const s=await setup({addListener(){return new Promise(done=>{resolve=done;});}});
  s.rec.start(); s.rec.abort(); resolve({remove(){removed++;}}); await tick();
  assert.equal(removed,1); assert.equal(s.calls.some(row=>row[0]==='start'),false);
});
