import './scheduleWarningControls.shared';

const scheduleWarningControls = (typeof globalThis !== 'undefined' && globalThis.__86ChaosScheduleWarningControlsShared) || {};

export const SUBJECT_ID_FIELDS = scheduleWarningControls.SUBJECT_ID_FIELDS;
export const SUBJECT_NAME_FIELDS = scheduleWarningControls.SUBJECT_NAME_FIELDS;
export const SUBJECT_EMAIL_FIELDS = scheduleWarningControls.SUBJECT_EMAIL_FIELDS;
export const cleanText = scheduleWarningControls.cleanText;
export const normalizeToken = scheduleWarningControls.normalizeToken;
export const requestSubjectTokens = scheduleWarningControls.requestSubjectTokens;
export const requestSubjectLabel = scheduleWarningControls.requestSubjectLabel;
export const requestMatchesEmployeeFilter = scheduleWarningControls.requestMatchesEmployeeFilter;
export const scheduleWarningEmployeeLabel = scheduleWarningControls.scheduleWarningEmployeeLabel;
export const warningShiftContext = scheduleWarningControls.warningShiftContext;
export const safeRecordArray = scheduleWarningControls.safeRecordArray;
export const asFunction = scheduleWarningControls.asFunction;
export const buildCoverageVarianceRows = scheduleWarningControls.buildCoverageVarianceRows;
export const buildScheduleConflictWarningRows = scheduleWarningControls.buildScheduleConflictWarningRows;
export const isRequestOffBulkEligible = scheduleWarningControls.isRequestOffBulkEligible;

export default scheduleWarningControls;
