import { buildMonthSchedulePrintModel } from './schedulePrintModel';

const shift = (overrides = {}) => ({ date: '2026-08-03', published: true, deleted: false, role: 'Cook', isMine: false, employeeName: 'Alex Cook', startTime: '10:00', endTime: '18:00', label: 'Alex Cook · 10:00-18:00 · Cook', dedupeKey: 'a', ...overrides });

test('Month print model applies selected month, published semantics, role and ME filters', () => {
  const rows = [shift(), shift({ dedupeKey: 'b', role: 'Dish', employeeName: 'Dee', isMine: true }), shift({ dedupeKey: 'c', date: '2026-09-01' }), shift({ dedupeKey: 'd', published: false }), shift({ dedupeKey: 'e', deleted: true })];
  const cooks = buildMonthSchedulePrintModel({ monthStr: '2026-08', roleFilter: 'Cook', shifts: rows });
  expect(cooks.visibleShifts).toHaveLength(1); expect(cooks.visibleShifts[0].employeeName).toBe('Alex Cook');
  const mine = buildMonthSchedulePrintModel({ monthStr: '2026-08', roleFilter: 'ME', shifts: rows });
  expect(mine.visibleShifts).toHaveLength(1); expect(mine.visibleShifts[0].employeeName).toBe('Dee');
});

test('model deduplicates and sorts by date, role, time, then employee', () => {
  const model = buildMonthSchedulePrintModel({ monthStr: '2026-08', shifts: [shift({ dedupeKey: 'same' }), shift({ dedupeKey: 'same' }), shift({ dedupeKey: 'z', date: '2026-08-02', employeeName: 'Zed' })] });
  expect(model.visibleShifts).toHaveLength(2); expect(model.visibleShifts[0].date).toBe('2026-08-02');
});

test('empty and six-row months produce complete deterministic cells', () => {
  const model = buildMonthSchedulePrintModel({ monthStr: '2026-08', restaurantName: 'Cheers', shifts: [] });
  expect(model.weekCount).toBe(6); expect(model.cells).toHaveLength(42); expect(model.cells.filter(cell => cell.inMonth)).toHaveLength(31); expect(model.shiftCount).toBe(0); expect(model.restaurantName).toBe('Cheers');
});

test('long names, roles, times, and dense days are retained in the pure model', () => {
  const rows = Array.from({ length: 30 }, (_, index) => shift({ dedupeKey: `dense-${index}`, employeeName: `Employee With A Deliberately Long Name ${index}`, role: 'Lead Line Cook', startTime: `1${index % 10}:00`, label: `Employee With A Deliberately Long Name ${index} · 10:00-18:00 · Lead Line Cook` }));
  const model = buildMonthSchedulePrintModel({ monthStr: '2026-08', shifts: rows });
  const day = model.cells.find(cell => cell.date === '2026-08-03');
  expect(day.shifts).toHaveLength(30); expect(day.shifts[0].label).toMatch(/Deliberately Long Name/); expect(day.shifts[0].role).toBe('Lead Line Cook');
});

test('full identity, time, and role survive misleading labels and duplicates without IDs', () => {
  const base = { date: '2026-08-04', published: true, employeeName: 'Zoë 李', role: 'Lead Cook', startTime: '09:00', endTime: '17:30', label: 'short' };
  const model = buildMonthSchedulePrintModel({ monthStr: '2026-08', shifts: [base, { ...base }] });
  const day = model.cells.find(cell => cell.date === '2026-08-04');
  expect(day.shifts).toHaveLength(1); expect(day.shifts[0].label).toBe('Zoë 李 · 09:00 – 17:30 · Lead Cook');
});

test('invalid month fails before any output is produced', () => {
  expect(() => buildMonthSchedulePrintModel({ monthStr: 'August 2026', shifts: [] })).toThrow(/valid schedule month/i);
});
