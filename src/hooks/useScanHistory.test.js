import { act, renderHook, waitFor } from '@testing-library/react';
import { getDocs, startAfter, limit, orderBy } from 'firebase/firestore';
import { useScanHistory } from './useScanHistory';
jest.mock('../core/appCore', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn((db, name) => ({ name })), documentId: () => '__name__', query: jest.fn((...args) => args),
  getDocs: jest.fn(), where: jest.fn((...args) => ({ where: args })), orderBy: jest.fn((...args) => ({ order: args })), limit: jest.fn(count => ({ limit: count })), startAfter: jest.fn(cursor => ({ cursor })) }));
const page = (prefix, count) => ({ docs: Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, data: () => ({ restaurantId: prefix, processedAt: '2026-09-08' }) })) });
beforeEach(() => jest.clearAllMocks());
test('Load more advances a real document cursor and keeps the same page limit', async () => {
  const first = page('a', 20); getDocs.mockResolvedValueOnce(first).mockResolvedValueOnce(page('b', 2));
  const { result } = renderHook(() => useScanHistory('invoices', 'r', 'u'));
  await waitFor(() => expect(result.current.rows).toHaveLength(20));
  await act(async () => { await result.current.loadMore(); });
  expect(startAfter).toHaveBeenCalledWith(first.docs[19]); expect(result.current.rows).toHaveLength(22);
  expect(limit.mock.calls.map(args => args[0])).toEqual([20, 20]); expect(getDocs).toHaveBeenCalledTimes(2); expect(orderBy).toHaveBeenCalledWith('processedAt', 'desc');
});
test('late reads cannot leak the previous workspace into the current view', async () => {
  let resolveOld; getDocs.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(page('new', 1));
  const { result, rerender } = renderHook(({ restaurantId }) => useScanHistory('invoices', restaurantId, 'u'), { initialProps: { restaurantId: 'old' } });
  rerender({ restaurantId: 'new' }); await waitFor(() => expect(result.current.rows[0]?.restaurantId).toBe('new'));
  await act(async () => { resolveOld(page('old', 20)); }); expect(result.current.rows).toHaveLength(1); expect(result.current.rows[0].restaurantId).toBe('new');
});
test('disabled history performs no reads and exposes no stale rows', () => {
  const { result } = renderHook(() => useScanHistory('invoices', 'r', 'u', false)); expect(getDocs).not.toHaveBeenCalled(); expect(result.current.rows).toEqual([]);
});
