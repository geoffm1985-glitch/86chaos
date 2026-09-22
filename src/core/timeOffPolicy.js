const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

const clampInt = (value, min, max, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const dateKey = (value = '') => {
  const text = String(value || '').trim();
  if (!DATE_RE.test(text)) return '';
  const date = new Date(`${text}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return '';
  const [year, month, day] = text.split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day ? text : '';
};

const formatKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (key, amount) => {
  const clean = dateKey(key);
  if (!clean) return '';
  const date = new Date(`${clean}T12:00:00`);
  date.setDate(date.getDate() + Number(amount || 0));
  return formatKey(date);
};

export const normalizeTimeOffPolicy = (raw = {}) => ({
  enabled: raw?.enabled === true,
  cutoffDaysBeforeRelease: clampInt(raw.cutoffDaysBeforeRelease, 0, 90, 10),
  monthlyReleaseDay: clampInt(raw.monthlyReleaseDay, 1, 28, 25),
  nonMonthlyReleaseLeadDays: clampInt(raw.nonMonthlyReleaseLeadDays, 0, 60, 7),
  blackouts: (Array.isArray(raw.blackouts) ? raw.blackouts : []).map((row, index) => {
    const startDate = dateKey(row?.startDate || row?.date || '');
    const endDate = dateKey(row?.endDate || row?.date || row?.startDate || '');
    if (!startDate || !endDate) return null;
    return {
      id: String(row?.id || `${startDate}-${endDate}-${index}`).slice(0, 120),
      startDate: startDate <= endDate ? startDate : endDate,
      endDate: startDate <= endDate ? endDate : startDate,
      reason: String(row?.reason || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    };
  }).filter(Boolean).slice(0, 100),
});

export const normalizeTimeOffScheduleSettings = (raw = {}) => {
  const modeRaw = String(raw.schedulePublishMode || raw.scheduleCadence || raw.schedulePublishingCadence || 'monthly').toLowerCase();
  const mode = ['weekly', 'biweekly', 'monthly', 'custom'].includes(modeRaw) ? modeRaw : 'monthly';
  const weeks = mode === 'weekly' ? 1 : mode === 'biweekly' ? 2 : mode === 'custom' ? clampInt(raw.scheduleCustomWeeks || raw.schedulePeriodWeeks, 1, 8, 1) : null;
  const weekStartsOn = Object.prototype.hasOwnProperty.call(WEEKDAY_INDEX, String(raw.scheduleWeekStartsOn || raw.weekStartsOn || 'Monday')) ? String(raw.scheduleWeekStartsOn || raw.weekStartsOn || 'Monday') : 'Monday';
  return { mode, weeks, weekStartsOn };
};

export const timeOffPolicyPeriodForDate = (requestDate, scheduleSettings = {}) => {
  const clean = dateKey(requestDate);
  if (!clean) return null;
  const settings = normalizeTimeOffScheduleSettings(scheduleSettings);
  const date = new Date(`${clean}T12:00:00`);
  if (settings.mode === 'monthly') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0);
    return { start: formatKey(start), end: formatKey(end), ...settings };
  }
  const start = new Date(date);
  const desired = WEEKDAY_INDEX[settings.weekStartsOn] ?? 1;
  while (start.getDay() !== desired) start.setDate(start.getDate() - 1);
  const end = new Date(start);
  end.setDate(end.getDate() + ((settings.weeks || 1) * 7) - 1);
  return { start: formatKey(start), end: formatKey(end), ...settings };
};

export const timeOffPolicyReleaseDateForRequestDate = (requestDate, policyRaw = {}, scheduleSettingsRaw = {}) => {
  const policy = normalizeTimeOffPolicy(policyRaw);
  const period = timeOffPolicyPeriodForDate(requestDate, scheduleSettingsRaw);
  if (!period) return '';
  if (period.mode === 'monthly') {
    const start = new Date(`${period.start}T12:00:00`);
    const release = new Date(start.getFullYear(), start.getMonth() - 1, policy.monthlyReleaseDay, 12, 0, 0, 0);
    return formatKey(release);
  }
  return addDays(period.start, -policy.nonMonthlyReleaseLeadDays);
};

export const timeOffPolicyCutoffDateForRequestDate = (requestDate, policyRaw = {}, scheduleSettingsRaw = {}) => {
  const policy = normalizeTimeOffPolicy(policyRaw);
  const releaseDate = timeOffPolicyReleaseDateForRequestDate(requestDate, policy, scheduleSettingsRaw);
  return releaseDate ? addDays(releaseDate, -policy.cutoffDaysBeforeRelease) : '';
};

export const timeOffBlackoutForDate = (requestDate, policyRaw = {}) => {
  const clean = dateKey(requestDate);
  if (!clean) return null;
  return normalizeTimeOffPolicy(policyRaw).blackouts.find(row => clean >= row.startDate && clean <= row.endDate) || null;
};

export const evaluateTimeOffPolicyDate = ({ requestDate, today, policy, scheduleSettings, canOverride = false } = {}) => {
  const cleanDate = dateKey(requestDate);
  const cleanToday = dateKey(today) || formatKey(new Date());
  if (!cleanDate) return { allowed: false, code: 'invalid-date', reason: 'Choose a valid Request Off date.' };
  const normalizedPolicy = normalizeTimeOffPolicy(policy);
  if (!normalizedPolicy.enabled) return { allowed: true, blocked: false, overridden: false, code: 'disabled', reason: '', blackout: null, releaseDate: '', cutoffDate: '' };
  const blackout = timeOffBlackoutForDate(cleanDate, normalizedPolicy);
  const releaseDate = timeOffPolicyReleaseDateForRequestDate(cleanDate, normalizedPolicy, scheduleSettings);
  const cutoffDate = timeOffPolicyCutoffDateForRequestDate(cleanDate, normalizedPolicy, scheduleSettings);
  const blackoutReason = blackout ? `Time-off requests are blacked out for ${cleanDate}${blackout.reason ? `: ${blackout.reason}` : '.'}` : '';
  const cutoffClosed = Boolean(cutoffDate && cleanToday > cutoffDate);
  const cutoffReason = cutoffClosed ? `The normal Request Off deadline for this schedule was ${cutoffDate}.` : '';
  const blocked = Boolean(blackout || cutoffClosed);
  return {
    allowed: !blocked || canOverride,
    blocked,
    overridden: blocked && canOverride,
    code: blackout ? 'blackout' : cutoffClosed ? 'cutoff-closed' : 'open',
    reason: blackoutReason || cutoffReason,
    blackout,
    releaseDate,
    cutoffDate,
  };
};

export const canConfigureTimeOffPolicy = (user = {}, clientData = {}) => {
  const email = String(user?.email || '').toLowerCase().trim();
  const ownerEmail = String(clientData?.ownerEmail || clientData?.ownerEmailLower || clientData?.ownerUserEmail || '').toLowerCase().trim();
  const ownerId = String(clientData?.ownerUserId || clientData?.ownerUid || '').trim();
  const userIds = [user?.id, user?.uid, user?.authUid, user?.userId].map(value => String(value || '').trim()).filter(Boolean);
  const role = String(user?.accountRole || user?.role || '').toLowerCase().trim();
  return Boolean(
    user?.isSuperAdmin === true ||
    user?.isAdmin === true ||
    user?.isOwner === true ||
    user?.accountOwner === true ||
    user?.owner === true ||
    user?.workspaceOwner === true ||
    role === 'owner' || role === 'admin' || role === 'administrator' ||
    (ownerEmail && email && ownerEmail === email) ||
    (ownerId && userIds.includes(ownerId))
  );
};

export default {
  normalizeTimeOffPolicy,
  normalizeTimeOffScheduleSettings,
  timeOffPolicyPeriodForDate,
  timeOffPolicyReleaseDateForRequestDate,
  timeOffPolicyCutoffDateForRequestDate,
  timeOffBlackoutForDate,
  evaluateTimeOffPolicyDate,
  canConfigureTimeOffPolicy,
};
