const previousTarget=process.env.REACT_APP_86CHAOS_FIREBASE_TARGET;
let verify;
beforeEach(()=>{
 jest.resetModules();process.env.REACT_APP_86CHAOS_FIREBASE_TARGET='emulator';
 global.fetch=jest.fn();verify=require('./firebaseTarget').verifyFirebaseEmulatorAvailability;
});
afterEach(()=>{delete global.fetch;if(previousTarget===undefined)delete process.env.REACT_APP_86CHAOS_FIREBASE_TARGET;else process.env.REACT_APP_86CHAOS_FIREBASE_TARGET=previousTarget;});
test('a transient Storage transport failure retries locally before completing readiness',async()=>{
 let storageAttempts=0;fetch.mockImplementation(url=>url.includes(':9199/') && ++storageAttempts===1 ? Promise.reject(new Error('signal is aborted without reason')) : Promise.resolve({}));
 const pending=verify();const result=await pending;
 expect(result.ok).toBe(true);expect(result.services).toHaveLength(5);expect(storageAttempts).toBe(2);
 expect(fetch.mock.calls.every(([url])=>url.startsWith('http://127.0.0.1:'))).toBe(true);
 expect(fetch.mock.calls.find(([url])=>url.includes(':9199/'))[0]).toContain('?maxResults=1');
});
test('an unavailable Storage service exhausts its bounded retry budget and fails closed',async()=>{
 let storageAttempts=0;fetch.mockImplementation(url=>{if(url.includes(':9199/')){storageAttempts++;return Promise.reject(new Error('connection refused'));}return Promise.resolve({});});
 const outcome=verify().then(()=>null,error=>error);const error=await outcome;
 expect(error.message).toMatch(/Storage emulator is unavailable/);expect(error.message).toMatch(/will not fall back to live Firebase/);expect(storageAttempts).toBe(3);
});
