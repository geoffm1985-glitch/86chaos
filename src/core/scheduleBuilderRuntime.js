const isRuntimeRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const dateFromTimestampLike = (value) => {
  if (!isRuntimeRecord(value)) return null;
  if (typeof value.toDate === 'function') {
    try {
      const converted = value.toDate();
      if (converted instanceof Date && Number.isFinite(converted.getTime())) return converted;
    } catch (error) {
      return null;
    }
  }

  const seconds = Number(value.seconds ?? value._seconds);
  if (!Number.isFinite(seconds)) return null;
  const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
  const converted = new Date((seconds * 1000) + (Number.isFinite(nanoseconds) ? Math.floor(nanoseconds / 1e6) : 0));
  return Number.isFinite(converted.getTime()) ? converted : null;
};

const validCalendarDateKey = (year, month, day) => {
  const converted = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(converted.getTime())) return '';
  if (converted.getUTCFullYear() !== year || converted.getUTCMonth() !== month - 1 || converted.getUTCDate() !== day) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const scheduleBuilderDateKey = (value) => {
  if (typeof value === 'string') {
    const raw = value.trim();
    const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
    return match ? validCalendarDateKey(Number(match[1]), Number(match[2]), Number(match[3])) : '';
  }

  const converted = value instanceof Date ? value : dateFromTimestampLike(value);
  if (!(converted instanceof Date) || !Number.isFinite(converted.getTime())) return '';
  return converted.toISOString().slice(0, 10);
};

export const safeScheduleBuilderRecords = (rows) => (
  Array.isArray(rows) ? rows.filter(isRuntimeRecord) : []
);

export const normalizeScheduleBuilderEvents = (rows) => safeScheduleBuilderRecords(rows).flatMap((event) => {
  if (event.type !== 'special_event') return [event];
  const date = scheduleBuilderDateKey(event.date ?? event.eventDate ?? event.startDate);
  return date ? [{ ...event, date }] : [];
});

