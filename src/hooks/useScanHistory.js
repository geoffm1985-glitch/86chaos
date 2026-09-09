import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, documentId, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db } from '../core/appCore';

export const scanHistoryQuery = (database, collectionName, restaurantId, cursor = '', pageSize = 20) => query(
  collection(database, collectionName), where('restaurantId', '==', restaurantId),
  ...(collectionName === 'invoices' ? [orderBy('processedAt', 'desc')] : [orderBy(documentId())]),
  ...(cursor ? [startAfter(cursor)] : []), limit(pageSize)
);

// History is a cursor-paged read, not an ever-growing live listener. Explicit
// approval/edit/delete refreshes are the only reason to request page one again.
export function useScanHistory(collectionName, restaurantId, viewerId, enabled = true) {
  const identity = `${collectionName}|${restaurantId || ''}|${viewerId || ''}`;
  const [state, setState] = useState({ identity: '', rows: [], cursor: '', hasMore: true, loading: false, error: '' });
  const generation = useRef(0); const busy = useRef(false);
  const load = useCallback(async (cursor = '', replace = false) => {
    if (!enabled || !restaurantId || (!replace && busy.current)) return;
    const active = generation.current; busy.current = true;
    setState(previous => ({ ...previous, identity, loading: true, error: '' }));
    try {
      const snap = await getDocs(scanHistoryQuery(db, collectionName, restaurantId, cursor));
      if (generation.current !== active) return;
      const incoming = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setState(previous => ({ identity, rows: [...new Map([...(replace ? [] : previous.rows), ...incoming].map(row => [row.id, row])).values()],
        cursor: snap.docs[snap.docs.length - 1] || cursor, hasMore: snap.docs.length === 20, loading: false, error: '' }));
    } catch (error) { if (generation.current === active) setState(previous => ({ ...previous, identity, loading: false, error: 'Scan history could not be loaded. Try again.' })); }
    finally { if (generation.current === active) busy.current = false; }
  }, [collectionName, restaurantId, viewerId, enabled, identity]);
  useEffect(() => { generation.current++; busy.current = false; setState({ identity, rows: [], cursor: '', hasMore: true, loading: false, error: '' }); load('', true);
    return () => { generation.current++; busy.current = false; }; }, [load, identity]);
  return { ...state, rows: state.identity === identity && enabled ? state.rows : [],
    loadMore: () => load(state.cursor), refresh: () => { generation.current++; busy.current = false; return load('', true); } };
}
