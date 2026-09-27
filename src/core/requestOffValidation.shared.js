'use strict';

function normalizeRequestOffClock(value = '') {
  return String(value || '').trim();
}

function isCanonicalRequestOffClock(value = '') {
  const raw = normalizeRequestOffClock(value);
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw);
}

function requestOffClockMinutes(value = '') {
  const raw = normalizeRequestOffClock(value);
  if (!isCanonicalRequestOffClock(raw)) return null;
  const [hours, minutes] = raw.split(':').map(Number);
  return (hours * 60) + minutes;
}

function validatePartialRequestOffTimeRange({ isPartial = false, startTime = '', endTime = '' } = {}) {
  if (isPartial !== true) return { valid: true, code: 'full-day', message: '' };
  const start = requestOffClockMinutes(startTime);
  const end = requestOffClockMinutes(endTime);
  if (start === null || end === null) {
    return { valid: false, code: 'invalid-time-format', message: 'Choose a valid start and end time for the part of the day you need off.' };
  }
  if (end <= start) {
    return { valid: false, code: 'invalid-time-order', message: 'End time must be later than start time for a partial-day Request Off.' };
  }
  return { valid: true, code: 'valid-partial', message: '', startMinutes: start, endMinutes: end };
}

const requestOffValidationShared = {
  normalizeRequestOffClock,
  isCanonicalRequestOffClock,
  requestOffClockMinutes,
  validatePartialRequestOffTimeRange,
};

if (typeof globalThis !== 'undefined') {
  Object.defineProperty(globalThis, '__86ChaosRequestOffValidationShared', {
    value: requestOffValidationShared,
    configurable: true,
    writable: true,
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = requestOffValidationShared;
