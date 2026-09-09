'use strict';
// Transactional test double: staged writes commit only after every read and
// validation succeeds. No Firebase project or network is used by these tests.
function fakeFirestore(seed = {}) {
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const records = new Map(Object.entries(clone(seed))); const reads = []; const writes = []; let serial = 0;
  const snapshot = ref => ({ id: ref.id, ref, exists: records.has(ref.path), data: () => clone(records.get(ref.path)) });
  function ref(path) { return { path, id: path.split('/').at(-1), collection: name => query(`${path}/${name}`), get: async () => { reads.push(path); return snapshot(ref(path)); }, set: async (data, options) => { records.set(path, options?.merge ? { ...records.get(path), ...clone(data) } : clone(data)); writes.push(path); } }; }
  function query(path, constraints = {}) {
    return { doc: id => ref(`${path}/${id || `auto_${++serial}`}`),
      where: (field, op, value) => query(path, { ...constraints, filters: [...(constraints.filters || []), [field, op, value]] }),
      orderBy: field => query(path, { ...constraints, order: field }),
      limit: count => query(path, { ...constraints, limit: count }),
      startAfter: cursor => query(path, { ...constraints, cursor: cursor.id || cursor }),
      get: async () => {
        reads.push({ path, constraints });
        let rows = [...records.keys()].filter(key => key.startsWith(`${path}/`) && key.slice(path.length + 1).indexOf('/') === -1).sort().map(key => snapshot(ref(key)));
        rows = rows.filter(row => (constraints.filters || []).every(([field, op, value]) => { if (op !== '==') throw new Error('Unsupported test query operator'); return row.data()[field] === value; }));
        if (constraints.cursor) rows = rows.filter(row => row.id > constraints.cursor);
        if (constraints.limit) rows = rows.slice(0, constraints.limit);
        return { docs: rows, size: rows.length, empty: rows.length === 0 };
      }
    };
  }
  return { records, reads, writes, collection: query, getAll: (...refs) => Promise.all(refs.map(row => row.get())),
    runTransaction: async callback => {
      const pending = []; let writing = false;
      const tx = { get: async target => { if (writing) throw new Error('Transaction read after write'); return target.get(); },
        set: (target, data, options) => { writing = true; pending.push(() => { records.set(target.path, options?.merge ? { ...records.get(target.path), ...clone(data) } : clone(data)); writes.push(target.path); }); },
        update: (target, data) => { writing = true; pending.push(() => { if (!records.has(target.path)) throw new Error('Missing update document'); records.set(target.path, { ...records.get(target.path), ...clone(data) }); writes.push(target.path); }); },
        delete: target => { writing = true; pending.push(() => { records.delete(target.path); writes.push(target.path); }); }
      };
      const result = await callback(tx); pending.forEach(apply => apply()); return result;
    }
  };
}
module.exports = { fakeFirestore };
