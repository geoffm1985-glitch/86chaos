import { makeLiveCollectionKey, meaningfulPayloadChanged, payloadContainsFirestoreSentinel, shouldSkipSafeWrite } from './appCore';

describe('safe write/no-op support', () => {
  test('debug labels are not part of live query identity', () => {
    const a = makeLiveCollectionKey({ coll: 'inventoryItems', restId: 'r1', whereClauses: [['status','==','active']], orderByField: 'name', orderDirection: 'asc', limitCount: 20 });
    const b = makeLiveCollectionKey({ coll: 'inventoryItems', restId: 'r1', whereClauses: [['status','==','active']], orderByField: 'name', orderDirection: 'asc', limitCount: 20 });
    expect(a).toBe(b);
  });
  test('different limits remain different listener identities', () => {
    expect(makeLiveCollectionKey({ coll: 'inventoryItems', restId: 'r1', limitCount: 20 })).not.toBe(makeLiveCollectionKey({ coll: 'inventoryItems', restId: 'r1', limitCount: 30 }));
  });
  test('unchanged merge update is skipped while full replacement is not', () => {
    const before = { restaurantId:'r1', title:'Same', oldField:'must be removed', updatedAt:'old' };
    expect(shouldSkipSafeWrite({ action:'update', before, data:{ title:'Same', updatedAt:'new' } })).toBe(true);
    expect(shouldSkipSafeWrite({ action:'set', merge:true, before, data:{ title:'Same' } })).toBe(true);
    expect(shouldSkipSafeWrite({ action:'set', merge:false, before, data:{ restaurantId:'r1', title:'Same' } })).toBe(false);
  });
  test('metadata-only changes are ignored but business values remain meaningful', () => {
    expect(meaningfulPayloadChanged({ title:'A', updatedAt:'old' }, { title:'A', updatedAt:'new' })).toBe(false);
    expect(meaningfulPayloadChanged({ title:'A' }, { title:'B' })).toBe(true);
  });
  test('Firestore operation sentinels are never treated as no-op payloads', () => {
    const fakeSentinel = { _methodName:'arrayUnion' };
    expect(payloadContainsFirestoreSentinel({ members:fakeSentinel })).toBe(true);
    expect(shouldSkipSafeWrite({ action:'update', before:{ members:[] }, data:{ members:fakeSentinel } })).toBe(false);
  });
});
