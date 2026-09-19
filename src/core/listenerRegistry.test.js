import { makeLiveCollectionKey, makeLiveDocumentKey } from './appCore';

describe('listener registry identity', () => {
  test('same query with different diagnostic labels still hashes once', () => {
    const base = { coll: 'tasks', restId: 'r1', whereClauses: [['isCompleted','==',false]], orderByField: 'date', orderDirection: 'asc', limitCount: 50, viewerUid:'u1' };
    expect(makeLiveCollectionKey({ ...base, debugLabel: 'a' })).toBe(makeLiveCollectionKey({ ...base, debugLabel: 'b' }));
  });
  test('equivalent where-clause order shares one query identity', () => {
    const a = makeLiveCollectionKey({ coll:'shifts', restId:'r1', viewerUid:'u1', whereClauses:[['date','>=','2026-07-01'],['scheduleUserId','==','u1']] });
    const b = makeLiveCollectionKey({ coll:'shifts', restId:'r1', viewerUid:'u1', whereClauses:[['scheduleUserId','==','u1'],['date','>=','2026-07-01']] });
    expect(a).toBe(b);
  });
  test('different restaurants, viewers, and document ids are isolated', () => {
    expect(makeLiveCollectionKey({ coll:'tasks', restId:'r1', viewerUid:'u1' })).not.toBe(makeLiveCollectionKey({ coll:'tasks', restId:'r2', viewerUid:'u1' }));
    expect(makeLiveCollectionKey({ coll:'tasks', restId:'r1', viewerUid:'u1' })).not.toBe(makeLiveCollectionKey({ coll:'tasks', restId:'r1', viewerUid:'u2' }));
    expect(makeLiveDocumentKey({ coll:'users', docId:'u1', viewerUid:'u1' })).not.toBe(makeLiveDocumentKey({ coll:'users', docId:'u2', viewerUid:'u1' }));
  });
});
