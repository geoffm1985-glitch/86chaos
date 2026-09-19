const { buildAuditScheduleFixture, isoDate, addDays, startOfWeekMonday } = require('./math-oracle.cjs');

function buildFakeRestaurantProfile({ restaurantId = '', runId = '', anchorDate = new Date() } = {}) {
  const today = new Date(anchorDate);
  const todayStr = isoDate(today);
  const tomorrowStr = isoDate(addDays(today, 1));
  const fixture = buildAuditScheduleFixture(today);
  const currentWeekStart = fixture.currentWeekStart;
  const currentWeekEnd = isoDate(addDays(new Date(`${currentWeekStart}T12:00:00`), 6));
  const invalidAllenKeys = new Set(
    (fixture.expected?.invalid || [])
      .filter(row => row.employeeName === 'Allen QA')
      .map(row => `${row.date}|${row.startTime}|${row.endTime}`)
  );
  const validAllenCurrentWeekShifts = (fixture.shifts || []).filter(row => {
    if (row.employeeName !== 'Allen QA') return false;
    if (row.date < currentWeekStart || row.date > currentWeekEnd) return false;
    return !invalidAllenKeys.has(`${row.date}|${row.startTime}|${row.endTime}`);
  });
  const candidateDates = [...new Set(validAllenCurrentWeekShifts.map(row => row.date))]
    .filter(date => date !== tomorrowStr);
  const allenPartialRequestDate = candidateDates.find(date => date >= todayStr) || candidateDates[candidateDates.length - 1] || '';
  if (!allenPartialRequestDate) {
    throw new Error('QA fixture requires a valid Allen QA shift date distinct from Sara QA conflict date.');
  }
  const tag = { qaOwned: true, qaRunId: runId, createdBy: '86chaos-full-audit', createdAt: new Date().toISOString() };
  const QA_WORKSPACE_NAME = process.env.CHAOS_QA_WORKSPACE_NAME || `86 Chaos Release Gate QA ${runId}`;

  const users = [
    { idKey: 'owner', name: 'Quincy Owner QA', email: `owner.qa.${runId}@86chaos.test`, role: 'Owner', isAdmin: true, isOwner: true, wage: 35, permissions: { schedule: true, inventory: true, financials: true, team: true, events: true } },
    { idKey: 'manager', name: 'Mara Manager QA', email: `manager.qa.${runId}@86chaos.test`, role: 'Manager', isAdmin: true, wage: 25, permissions: { schedule: true, inventory: true, team: true, events: true } },
    { idKey: 'allen', name: 'Allen QA', email: `allen.qa.${runId}@86chaos.test`, role: 'Line Cook', wage: 18, permissions: {} },
    { idKey: 'chuck', name: 'Chuck QA', email: `chuck.qa.${runId}@86chaos.test`, role: 'Bartender', wage: 12, permissions: {} },
    { idKey: 'lani', name: 'Lani QA', email: `lani.qa.${runId}@86chaos.test`, role: 'Closing Cook', wage: 19, permissions: {} },
    { idKey: 'sara', name: 'Sara QA', email: `sara.qa.${runId}@86chaos.test`, role: 'Server', wage: 8, permissions: {} },
    { idKey: 'dish', name: 'Drew Dish QA', email: `dish.qa.${runId}@86chaos.test`, role: 'Dishwasher', wage: 14, permissions: {} },
  ].map(u => ({ ...u, restaurantId, isActive: true, passwordStored: false, ...tag }));

  const userIdByFixture = {
    'qa-allen': 'allen',
    'qa-chuck': 'chuck',
    'qa-lani': 'lani',
  };
  const shifts = fixture.shifts.map((s, index) => ({
    restaurantId,
    employeeKey: userIdByFixture[s.employeeId] || s.employeeId,
    employeeName: s.employeeName,
    role: s.role,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    isPublished: true,
    source: '86chaos-full-audit-seed',
    qaExpectedValid: !fixture.expected.invalid.some(inv => inv.employeeName === s.employeeName && inv.date === s.date && inv.startTime === s.startTime && inv.endTime === s.endTime),
    qaIndex: index,
    ...tag,
  }));

  const timeOffRequests = [
    { restaurantId, userKey: 'allen', employeeName: 'Allen QA', userName: 'Allen QA', date: allenPartialRequestDate, requestDate: allenPartialRequestDate, startTime: '12p', endTime: '4p', partialDay: true, status: 'approved', reason: 'QA partial request-off visible time check', requestedAt: new Date().toISOString(), ...tag },
    { restaurantId, userKey: 'sara', employeeName: 'Sara QA', userName: 'Sara QA', date: tomorrowStr, requestDate: tomorrowStr, allDay: true, status: 'pending', reason: 'QA full day request-off warning check', requestedAt: new Date().toISOString(), ...tag },
  ];

  const events = [
    { restaurantId, type: 'special_event', title: 'QA Private Party - Staff Up', date: todayStr, time: '18:00', startTime: '18:00', endTime: '21:00', expectedStaffImpact: 3, notes: 'QA event should show on Schedule Builder event row.', addedBy: 'Full Audit', ...tag },
    { restaurantId, type: 'special_event', title: 'QA Fish Fry Rush', date: tomorrowStr, time: '17:00', startTime: '17:00', endTime: '20:00', expectedStaffImpact: 2, notes: 'QA repeat/staffing pressure event.', addedBy: 'Full Audit', ...tag },
    { restaurantId, type: 'note', title: 'QA 86 Salmon message', date: new Date().toISOString(), isImportant: true, author: 'Full Audit', messageCategory: '86 Alert', replies: [], ...tag },
  ];

  const timePunches = [
    { restaurantId, employeeKey: 'allen', employeeName: 'Allen QA', date: todayStr, clockInTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0).toISOString(), clockOutTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0).toISOString(), status: 'complete', ...tag },
    { restaurantId, employeeKey: 'chuck', employeeName: 'Chuck QA', date: todayStr, clockInTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).toISOString(), status: 'clocked_in', ...tag },
  ];

  const vendors = [
    { key: 'sysco', restaurantId, name: 'QA Sysco Vendor', rep: 'Victor Vendor', phone: '555-0101', cutOffDays: ['Monday', 'Thursday'], cutOffTime: '16:00', ...tag },
    { key: 'produce', restaurantId, name: 'QA Local Produce', rep: 'Paula Produce', phone: '555-0102', cutOffDays: ['Tuesday', 'Friday'], cutOffTime: '14:00', ...tag },
  ];

  const inventoryItems = [
    { restaurantId, name: 'QA Fry Oil', category: 'Supplies', unit: 'jug', parLevel: 8, currentStock: 2, quantity: 2, price: 38, vendorKey: 'sysco', pfgCode: 'QA-OIL', belowPar: true, ...tag },
    { restaurantId, name: 'QA Salmon Portion', category: 'Seafood', unit: 'each', parLevel: 24, currentStock: 0, quantity: 0, price: 4.25, vendorKey: 'sysco', is86: true, ...tag },
    { restaurantId, name: 'QA Romaine', category: 'Produce', unit: 'case', parLevel: 5, currentStock: 3, quantity: 3, price: 22, vendorKey: 'produce', ...tag },
    { restaurantId, name: 'QA Burger Bun', category: 'Dry Goods', unit: 'dozen', parLevel: 10, currentStock: 12, quantity: 12, price: 3.5, vendorKey: 'sysco', ...tag },
  ];

  const recipes = [
    { restaurantId, title: 'QA Salmon BLT', name: 'QA Salmon BLT', category: 'Entree', prepTime: '12 mins', yieldAmt: '1 plate', ingredients: 'QA Salmon Portion x 1\nQA Romaine x 0.05 case\nQA Burger Bun x 1', instructions: 'Cook salmon. Build BLT. Serve.', cost: 6.5, menuPrice: 18, ...tag },
    { restaurantId, title: 'QA Burger Prep', name: 'QA Burger Prep', category: 'Prep', prepTime: '30 mins', yieldAmt: '24 patties', ingredients: 'Ground Beef\nSalt\nPepper', instructions: 'Mix, portion, press.', ...tag },
  ];

  const menuDependencies = [
    { restaurantId, menuItemName: 'QA Salmon BLT', inventoryItemName: 'QA Salmon Portion', dependencyName: 'QA Salmon Portion', itemName: 'QA Salmon BLT', status: 'blocked', source: '86chaos-full-audit', ...tag },
    { restaurantId, menuItemName: 'QA House Salad', inventoryItemName: 'QA Romaine', dependencyName: 'QA Romaine', itemName: 'QA House Salad', status: 'available', source: '86chaos-full-audit', ...tag },
  ];

  const prepItems = [
    { restaurantId, date: todayStr, text: 'QA Dice onions 4 qt', station: 'Prep Table', isCompleted: false, qty: 1, assignedRole: 'Prep Cook', ...tag },
    { restaurantId, date: todayStr, text: 'QA Portion burger patties', station: 'Grill', isCompleted: true, qty: 24, completedAt: new Date().toISOString(), ...tag },
  ];

  const tasks = [
    { restaurantId, title: 'QA Dump hood oil pan', category: 'Cleaning', frequency: 'daily', completions: {}, assignedRole: 'Closing Cook', ...tag },
    { restaurantId, title: 'QA Deep clean ovens', category: 'Cleaning', frequency: 'monthly', targetDate: '1', completions: {}, ...tag },
  ];

  const maintenanceLogs = [
    { restaurantId, equipment: 'QA Fryer #2', issue: 'Pilot light keeps going out', urgency: 'Critical', status: 'Reported', reportedAt: new Date().toISOString(), reportedBy: 'Full Audit', ...tag },
    { restaurantId, equipment: 'QA Ice Machine', issue: 'Slow leak near drain', urgency: 'High', status: 'Pending Parts', reportedAt: new Date().toISOString(), reportedBy: 'Full Audit', ...tag },
  ];

  const pmSchedules = [
    { restaurantId, title: 'QA Degrease hood filters', equipment: 'Hood', frequencyDays: 7, lastCompleted: isoDate(addDays(today, -8)), ...tag },
    { restaurantId, title: 'QA Descale dishwasher', equipment: 'Dish Machine', frequencyDays: 14, lastCompleted: isoDate(addDays(today, -4)), ...tag },
  ];

  const sales = Array.from({ length: 14 }).map((_, i) => {
    const date = isoDate(addDays(today, -i));
    const grossSales = i % 5 === 0 ? 9200 : 4200 + (i * 137);
    return { restaurantId, date, grossSales, netSales: grossSales * 0.92, tax: grossSales * 0.055, tips: grossSales * 0.18, discounts: i % 3 === 0 ? 45 : 0, guestCount: 90 + i, ticketCount: 45 + i, laborCost: grossSales * 0.23, source: 'full-audit-seed', ...tag };
  });

  const financialExpenses = [
    { restaurantId, date: todayStr, category: 'Food', vendor: 'QA Sysco Vendor', amount: 775.44, notes: 'QA invoice/expense check', ...tag },
    { restaurantId, date: todayStr, category: 'Repairs', vendor: 'QA Hobart', amount: 240.0, notes: 'QA maintenance cost check', ...tag },
  ];

  const restaurantAdminAlerts = [
    { restaurantId, area: 'inventory', title: 'QA Salmon 86 Alert', detail: 'QA Salmon Portion is at zero stock.', severity: 'high', status: 'open', messageCategory: '86 Alert', inventoryItemName: 'QA Salmon Portion', ...tag },
    { restaurantId, area: 'maintenance', title: 'QA Critical Fryer Maintenance', detail: 'Fryer #2 needs service.', severity: 'critical', status: 'open', ...tag },
  ];

  const reminders = [
    { restaurantId, title: 'QA Call Sysco before cutoff', text: 'QA Call Sysco before cutoff', dueAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 30).toISOString(), recurrence: 'daily', audience: 'manager', ...tag },
    { restaurantId, title: 'QA Monthly hood paperwork', text: 'QA Monthly hood paperwork', recurrence: 'monthly', audience: 'owner', ...tag },
  ];

  const availabilityRecords = [
    { restaurantId, userKey: 'allen', employeeName: 'Allen QA', dayOfWeek: 'Friday', availableFrom: '10a', availableTo: '3p', notes: 'QA availability partial-day display check', ...tag },
  ];

  const scheduleTemplates = [
    { restaurantId, name: 'QA Fish Fry Template', description: 'QA Friday staffing template', rows: [
      { dayIndex: 5, role: 'Line Cook', startTime: '15:00', endTime: '22:00', count: 3 },
      { dayIndex: 5, role: 'Server', startTime: '16:00', endTime: '22:00', count: 4 },
      { dayIndex: 5, role: 'Bartender', startTime: '16:00', endTime: '23:00', count: 2 },
    ], ...tag },
  ];

  const scheduleCoverageTargets = [
    { restaurantId, dayIndex: 5, role: 'Line Cook', startTime: '16:00', endTime: '22:00', count: 3, ...tag },
    { restaurantId, dayIndex: 5, role: 'Server', startTime: '16:00', endTime: '22:00', count: 4, ...tag },
    // Tuesday has two seeded Chuck QA 10a-4p bartender shifts; target 1 gives a deterministic over-coverage warning.
    { restaurantId, dayIndex: 2, role: 'Bartender', startTime: '10a', endTime: '4p', count: 1, ...tag },
  ];

  return {
    restaurant: { restaurantId, name: QA_WORKSPACE_NAME, timezone: 'America/Chicago', type: 'Bar & Grill', scheduleStyle: 'biweekly', payrollWeekStart: 'Monday', systemSettings: { overtime: 40, enableTargets: true, targetLaborPct: 23 }, ...tag },
    collections: {
      users, vendors, inventoryItems, recipes, menuDependencies, shifts, timeOffRequests, events, timePunches, prepItems, tasks, maintenanceLogs, pmSchedules, sales, financialExpenses, restaurantAdminAlerts, personalReminders: reminders, availabilityRecords, scheduleTemplates, scheduleCoverageTargets,
    },
    expectations: {
      fixture,
      mustAppearInScheduleBuilder: ['Allen QA', 'Chuck QA', 'Lani QA', 'QA Private Party - Staff Up'],
      invalidShiftLabels: ['10p', '3p'],
      crossModule: {
        inventoryZeroItem: 'QA Salmon Portion',
        alertTitle: 'QA Salmon 86 Alert',
        menuItem: 'QA Salmon BLT',
        maintenanceTitle: 'QA Critical Fryer Maintenance',
      },
    },
  };
}

module.exports = { buildFakeRestaurantProfile };
