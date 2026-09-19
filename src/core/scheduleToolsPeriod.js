import './scheduleToolsPeriod.shared';

const scheduleToolsPeriod = (typeof globalThis !== 'undefined' && globalThis.__86ChaosScheduleToolsPeriodShared) || {};

export const deriveScheduleToolsPeriod = scheduleToolsPeriod.deriveScheduleToolsPeriod;
export const deriveScheduleToolsCopyWeek = scheduleToolsPeriod.deriveScheduleToolsCopyWeek;
export const filterScheduleToolsRecords = scheduleToolsPeriod.filterScheduleToolsRecords;
export const recurringDatesForWeekday = scheduleToolsPeriod.recurringDatesForWeekday;
export const assessScheduleToolsCompleteness = scheduleToolsPeriod.assessScheduleToolsCompleteness;

export default scheduleToolsPeriod;

