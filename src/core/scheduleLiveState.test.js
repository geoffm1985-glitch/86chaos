import { renderHook, act } from '@testing-library/react';
import { onSnapshot, getDocsFromServer } from 'firebase/firestore';
import { useLiveCollectionState, clearTenantListenerCache } from './appCore';
jest.mock('firebase/firestore', () => ({ ...jest.requireActual('firebase/firestore'), onSnapshot: jest.fn(() => jest.fn()), getDocsFromServer:jest.fn() }));
const snapshot=(rows=[])=>({docs:rows.map(row=>({id:row.id,data:()=>row})),docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}});
beforeEach(()=>jest.useFakeTimers());
afterEach(() => { clearTenantListenerCache({all:true}); jest.clearAllTimers();jest.useRealTimers();jest.clearAllMocks(); });
test('schedule data resolves after a server listener callback and stays resolved on rerender', () => {
  const {result, rerender}=renderHook(()=>useLiveCollectionState('scheduleTemplates','normal',{enabled:true,limitCount:120,requireServerSnapshot:true}));
  expect(result.current.resolved).toBe(false);
  act(()=>onSnapshot.mock.calls[0][2](snapshot([{id:'template'}])));
  expect(result.current.data).toHaveLength(1);expect(result.current.resolved).toBe(true);
  rerender(); expect(result.current.resolved).toBe(true);
  act(()=>jest.advanceTimersByTime(10000));expect(getDocsFromServer).not.toHaveBeenCalled();
});
test('stalled stream recovers readiness from a successful server read, including empty collections',async()=>{
  getDocsFromServer.mockResolvedValue(snapshot());
  const {result}=renderHook(()=>useLiveCollectionState('roles','stalled',{requireServerSnapshot:true}));
  await act(async()=>{jest.advanceTimersByTime(10000);await Promise.resolve();});
  expect(getDocsFromServer).toHaveBeenCalledTimes(1);expect(result.current.resolved).toBe(true);expect(result.current.stale).toBe(false);expect(result.current.error).toBeNull();
});
test('cached-only data cannot certify readiness before independent server verification',async()=>{
  getDocsFromServer.mockResolvedValue(snapshot([{id:'verified'}]));
  const {result}=renderHook(()=>useLiveCollectionState('shifts','cached',{requireServerSnapshot:true}));
  act(()=>onSnapshot.mock.calls[0][2]({...snapshot([{id:'cached'}]),metadata:{fromCache:true}}));
  expect(result.current.stale).toBe(true);
  await act(async()=>{jest.advanceTimersByTime(10000);await Promise.resolve();});
  expect(result.current.stale).toBe(false);expect(result.current.data[0].id).toBe('verified');
});
test('failed or hanging server reads become explicit errors and retry preserves shared consumers',async()=>{
  getDocsFromServer.mockImplementation(()=>new Promise(()=>{}));
  const a=renderHook(()=>useLiveCollectionState('roles','retry',{requireServerSnapshot:true}));
  const b=renderHook(()=>useLiveCollectionState('roles','retry',{requireServerSnapshot:true}));
  await act(async()=>{jest.advanceTimersByTime(10000);await Promise.resolve();});
  await act(async()=>{jest.advanceTimersByTime(15000);await Promise.resolve();});
  expect(a.result.current.error).toMatch(/timed out/);expect(b.result.current.stale).toBe(true);
  act(()=>a.result.current.retry());
  expect(onSnapshot).toHaveBeenCalledTimes(2);
  act(()=>onSnapshot.mock.calls[1][2](snapshot([{id:'recovered'}])));
  expect(a.result.current.stale).toBe(false);expect(b.result.current.data[0].id).toBe('recovered');
});
test('late server response from an unmounted workspace cannot replace a new workspace',async()=>{
  let finish;getDocsFromServer.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const {result,rerender}=renderHook(({rest})=>useLiveCollectionState('roles',rest,{requireServerSnapshot:true}),{initialProps:{rest:'old'}});
  await act(async()=>{jest.advanceTimersByTime(10000);await Promise.resolve();});
  rerender({rest:'new'});
  await act(async()=>{finish(snapshot([{id:'old-secret'}]));await Promise.resolve();});
  expect(result.current.data).toEqual([]);expect(result.current.resolved).toBe(false);
});

test('server recovery cannot certify pending local writes',async()=>{
  getDocsFromServer.mockResolvedValue({...snapshot([{id:'pending'}]),metadata:{fromCache:false,hasPendingWrites:true}});
  const {result}=renderHook(()=>useLiveCollectionState('roles','pending',{requireServerSnapshot:true}));
  await act(async()=>{jest.advanceTimersByTime(10000);await Promise.resolve();});
  expect(result.current.stale).toBe(true);expect(result.current.error).toMatch(/unverified local changes/);
});
