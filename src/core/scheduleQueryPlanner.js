import { getToday, getMonthStr, formatDate } from './appCore';

const addDays = (dateStr, amount) => {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return formatDate(d);
};
const getMonthBounds = (dateStr) => {
  const [year, month] = getMonthStr(dateStr).split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0);
  return { start, end: formatDate(endDate) };
};
export const getCanonicalScheduleUserId = (user = {}) => {
  const safeUser = user && typeof user === 'object' ? user : {};
  return safeUser.scheduleUserId || safeUser.employeeId || safeUser.rosterUserId || safeUser.userId || safeUser.authUid || safeUser.uid || safeUser.id || '';
}; // email is migration evidence only, not a durable query ID
export const canManageScheduleForPlanner = (user = {}) => Boolean(user?.isSuperAdmin || user?.isAdmin || user?.isOwner || user?.accountOwner || user?.workspaceOwner || user?.permissions?.schedule || user?.permissions?.team);

export function buildScheduleQueryPlan({ activeTabState = '', activeScheduleSubTab = 'my-schedule', appUser = {}, currentDate = getToday(), selectedMonth = '', visibleRange = null, wantsToday = false, messageRangeStart = '' } = {}) {
  const safeAppUser = appUser && typeof appUser === 'object' ? appUser : {};
  const today = getToday();
  const monthBounds = getMonthBounds(selectedMonth || currentDate);
  const scheduleWindowStart = visibleRange?.start || addDays(monthBounds.start, -14);
  const scheduleWindowEnd = visibleRange?.end || addDays(monthBounds.end, 60);
  const recentWindowStart = addDays(today, -30);
  const futureWindowEnd = addDays(today, 14);
  const todayOpsWindowEnd = addDays(today, 7);
  const isScheduleRoute = ['schedule', 'published', 'events'].includes(activeTabState);
  const scheduleUserId = getCanonicalScheduleUserId(safeAppUser);
  const authUserId = safeAppUser.authUid || safeAppUser.uid || safeAppUser.userId || safeAppUser.id || '';
  const canManageSchedule = canManageScheduleForPlanner(safeAppUser);
  const ownUserClause = scheduleUserId ? [['scheduleUserId', '==', scheduleUserId]] : [['scheduleUserId', '==', '__none__']];
  const plan = {
    shiftClauses: [['date','>=', today], ['date','<=', todayOpsWindowEnd]],
    shiftsEnabled: true,
    shiftLimit: 80,
    timeOffEnabled: true,
    timeOffClauses: authUserId ? [['userId', '==', authUserId]] : [['userId', '==', '__none__']],
    timeOffLimit: 40,
    timeOffHistoryEnabled: false,
    timeOffHistoryClauses: [],
    timeOffHistoryLimit: 40,
    eventsEnabled: wantsToday,
    eventEnabled: wantsToday,
    eventClauses: [['date', '>=', messageRangeStart || recentWindowStart], ['date', '<=', todayOpsWindowEnd]],
    eventLimit: 35,
    swapsEnabled: false,
    swapOrderByField: 'shiftDate',
    swapClauses: [['status', 'in', ['available','open']], ['shiftDate','>=', today]],
    swapLimit: 30,
    availabilityEnabled: false,
    needsAvailability: false,
    availabilityClauses: [],
    needsTemplates: false,
    needsCoverageTargets: false,
    needsRoles: false,
    needsRoster: false,
    canManageSchedule,
    activePunchClauses: scheduleUserId ? [['scheduleUserId','==', scheduleUserId], ['status','in',['clocked_in','on_break']]] : [['scheduleUserId','==','__none__']],
    activePunchLimit: 1
  };
  if (!isScheduleRoute) return plan;

  if (activeTabState === 'events') {
    return { ...plan, shiftsEnabled: false, shiftClauses: [], shiftLimit: 0, timeOffEnabled: false, timeOffClauses: [], timeOffLimit: 0, swapsEnabled: false, availabilityEnabled: false, eventEnabled: true, eventsEnabled: true, eventClauses: [['date','>=', monthBounds.start], ['date','<=', monthBounds.end]], eventLimit: 180, needsAvailability: false, needsTemplates: false, needsCoverageTargets: false, needsRoles: false, needsRoster: false };
  }

  if (activeScheduleSubTab === 'schedule-builder') {
    return { ...plan, shiftClauses: [['date','>=', scheduleWindowStart], ['date','<=', scheduleWindowEnd]], shiftLimit: 420, timeOffClauses: [['date','>=', scheduleWindowStart], ['date','<=', scheduleWindowEnd]], timeOffLimit: 180, eventEnabled: true, eventsEnabled: true, eventClauses: [['date','>=', scheduleWindowStart], ['date','<=', scheduleWindowEnd]], eventLimit: 500, availabilityEnabled: true, needsAvailability: true, availabilityClauses: [['date','>=', scheduleWindowStart], ['date','<=', scheduleWindowEnd]], needsTemplates: true, needsCoverageTargets: true, needsRoles: true, needsRoster: true };
  }
  if (['full-schedule','month-view'].includes(activeScheduleSubTab)) {
    return { ...plan, shiftClauses: [['date','>=', monthBounds.start], ['date','<=', monthBounds.end]], shiftLimit: 500, timeOffClauses: canManageSchedule ? [['date','>=', monthBounds.start], ['date','<=', monthBounds.end]] : (authUserId ? [['userId','==',authUserId], ['date','>=', monthBounds.start], ['date','<=', monthBounds.end]] : [['userId','==','__none__']]), timeOffLimit: canManageSchedule ? 120 : 40, eventEnabled: true, eventsEnabled: true, eventClauses: [['date','>=', monthBounds.start], ['date','<=', monthBounds.end]], eventLimit: 120, needsRoster: canManageSchedule };
  }
  if (activeScheduleSubTab === 'time-off') {
    const activeStatuses = ['pending', 'approved'];
    const terminalStatuses = ['denied', 'rejected', 'cancelled', 'canceled', 'processed', 'completed', 'archived'];
    return {
      ...plan,
      shiftClauses: canManageSchedule ? [['date','>=', recentWindowStart], ['date','<=', scheduleWindowEnd]] : [...ownUserClause, ['date','>=', recentWindowStart], ['date','<=', scheduleWindowEnd]],
      shiftLimit: canManageSchedule ? 250 : 80,
      timeOffClauses: canManageSchedule
        ? [['status','in',activeStatuses], ['date','>=', recentWindowStart]]
        : (authUserId ? [['userId','==',authUserId], ['status','in',activeStatuses], ['date','>=', recentWindowStart]] : [['userId','==','__none__']]),
      timeOffLimit: canManageSchedule ? 120 : 60,
      timeOffHistoryEnabled: true,
      timeOffHistoryClauses: canManageSchedule
        ? [['status','in',terminalStatuses]]
        : (authUserId ? [['userId','==',authUserId], ['status','in',terminalStatuses]] : [['userId','==','__none__']]),
      timeOffHistoryLimit: 40,
      eventEnabled: false,
      needsRoster: canManageSchedule
    };
  }
  if (activeScheduleSubTab === 'availability') {
    return { ...plan, shiftClauses: canManageSchedule ? [['date','>=', recentWindowStart], ['date','<=', futureWindowEnd]] : [...ownUserClause, ['date','>=', recentWindowStart], ['date','<=', futureWindowEnd]], shiftLimit: 80, timeOffClauses: authUserId ? [['userId','==',authUserId], ['date','>=', recentWindowStart], ['date','<=', futureWindowEnd]] : [['userId','==','__none__']], timeOffLimit: 30, eventEnabled: false, eventsEnabled: false, availabilityEnabled: true, needsAvailability: true, availabilityClauses: canManageSchedule ? [] : (scheduleUserId ? [['scheduleUserId','==', scheduleUserId]] : [['scheduleUserId','==','__none__']]), needsRoster: canManageSchedule };
  }
  if (activeScheduleSubTab === 'trade-board') {
    return { ...plan, shiftClauses: canManageSchedule ? [['date','>=', today], ['date','<=', futureWindowEnd]] : [...ownUserClause, ['date','>=', today], ['date','<=', scheduleWindowEnd]], shiftLimit: canManageSchedule ? 180 : 60, timeOffClauses: authUserId ? [['userId','==',authUserId], ['date','>=', recentWindowStart], ['date','<=', futureWindowEnd]] : [['userId','==','__none__']], timeOffLimit: 30, swapsEnabled: true, swapClauses: canManageSchedule ? [['status','in',['available','open']], ['shiftDate','>=', today]] : [['requesterUserId','==', authUserId || '__none__'], ['shiftDate','>=', today]], swapLimit: 80, eventEnabled: false, needsRoster: true };
  }
  return { ...plan, shiftClauses: scheduleUserId ? [...ownUserClause, ['date','>=', monthBounds.start], ['date','<=', monthBounds.end]] : [['date','>=', monthBounds.start], ['date','<=', monthBounds.end]], shiftLimit: 140, timeOffClauses: authUserId ? [['userId','==', authUserId], ['date','>=', monthBounds.start], ['date','<=', monthBounds.end]] : [['userId','==','__none__']], timeOffLimit: 60, swapsEnabled: true, swapClauses: authUserId ? [['requesterUserId','==', authUserId], ['shiftDate','>=', today]] : [['status','in',['available','open']]], swapLimit: 40, eventEnabled: false };
}
