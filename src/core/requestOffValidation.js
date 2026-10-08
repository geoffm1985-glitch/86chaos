import './requestOffValidation.shared';

const validation = (typeof globalThis !== 'undefined' && globalThis.__86ChaosRequestOffValidationShared) || {};

export const normalizeRequestOffClock = validation.normalizeRequestOffClock;
export const isCanonicalRequestOffClock = validation.isCanonicalRequestOffClock;
export const requestOffClockMinutes = validation.requestOffClockMinutes;
export const validatePartialRequestOffTimeRange = validation.validatePartialRequestOffTimeRange;
export default validation;
