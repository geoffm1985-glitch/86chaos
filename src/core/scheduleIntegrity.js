import './scheduleIntegrity.shared.js';

const scheduleIntegrity = globalThis.__86ChaosScheduleIntegrityShared;
if (!scheduleIntegrity) throw new Error('86 Chaos schedule integrity helpers failed to initialize.');

export const {
  SCHEDULE_AUDIT_CLASSIFICATIONS,
  isCanonicalScheduleDate,
  isUsableScheduleTime,
  buildCanonicalScheduleDatePatch,
  buildCanonicalScheduleCreateFields,
  buildScheduleQuickEditMutation,
  resolveScheduleAuditIdentity,
  scheduleDuplicateKey,
  classifyScheduleIntegrityRecord,
  classifyScheduleIntegrityRecords
} = scheduleIntegrity;

export default scheduleIntegrity;
