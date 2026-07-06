const crypto = require('crypto');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDateObject(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function normalizeScheduleDate(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
    const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (mdy) {
      const y = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
      return `${y}-${pad2(mdy[1])}-${pad2(mdy[2])}`;
    }
    const parsed = new Date(trimmed);
    return formatDateObject(parsed);
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return formatDateObject(parsed);
  }

  if (value instanceof Date) return formatDateObject(value);
  if (typeof value?.toDate === 'function') return formatDateObject(value.toDate());
  if (typeof value?.seconds === 'number') return formatDateObject(new Date(value.seconds * 1000));

  return '';
}

function getShiftDate(data = {}) {
  return normalizeScheduleDate(
    data.date ||
    data.shiftDate ||
    data.scheduleDate ||
    data.startDate ||
    data.day ||
    data.startsAt ||
    data.startAt ||
    data.start ||
    data.clockDate
  );
}

function isDateInRange(date, start, end) {
  return !!date && date >= start && date <= end;
}

function stableShiftDocId({ restaurantId, sourceKey, date, employeeId, employeeName, startTime, endTime }) {
  const raw = [restaurantId, sourceKey, date, employeeId || employeeName, startTime, endTime].join('|');
  const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
  const safeDate = String(date || 'date').replace(/[^a-z0-9]/gi, '');
  const safeName = String(employeeId || employeeName || 'employee').replace(/[^a-z0-9]/gi, '').slice(0, 28) || 'employee';
  return `restored_${safeDate}_${safeName}_${hash}`;
}

function serializeFirestoreData(docSnap) {
  const data = docSnap.data() || {};
  const out = { id: docSnap.id };
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v.toDate === 'function') out[k] = v.toDate().toISOString();
    else if (v && typeof v === 'object' && typeof v.seconds === 'number') out[k] = new Date(v.seconds * 1000).toISOString();
    else out[k] = v;
  }
  return out;
}

async function commitInChunks(db, operations, chunkSize = 400) {
  let batch = db.batch();
  let count = 0;
  let committed = 0;
  for (const op of operations) {
    op(batch);
    count += 1;
    if (count >= chunkSize) {
      await batch.commit();
      committed += count;
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) {
    await batch.commit();
    committed += count;
  }
  return committed;
}

async function getRestaurantMonthShiftDocs(db, { restaurantId, monthStart, monthEnd }) {
  const snap = await db.collection('shifts').where('restaurantId', '==', restaurantId).get();
  return snap.docs.filter((docSnap) => {
    const data = docSnap.data() || {};
    const date = getShiftDate(data);
    if (isDateInRange(date, monthStart, monthEnd)) return true;

    // Restore armor: if older or restored records carry month/source metadata but the date field is messy,
    // still treat them as part of the same month so emergency replacement can fully clean them up.
    const month = String(data.scheduleMonth || data.month || '').slice(0, 7);
    if (month && month === monthStart.slice(0, 7)) return true;

    const sourceMonth = String(data.sourceMonth || data.restoreMonth || '').slice(0, 7);
    if (sourceMonth && sourceMonth === monthStart.slice(0, 7)) return true;

    return false;
  });
}

async function hardReplaceScheduleMonth(db, { restaurantId, monthStart, monthEnd, backupMeta = {}, makeImportOperations }) {
  const existingDocs = await getRestaurantMonthShiftDocs(db, { restaurantId, monthStart, monthEnd });
  const backup = {
    ...backupMeta,
    replacedShiftCount: existingDocs.length,
    replacedShifts: existingDocs.map(serializeFirestoreData)
  };

  const deleteOps = existingDocs.map(docSnap => batch => batch.delete(docSnap.ref));
  const deletedCount = await commitInChunks(db, deleteOps);
  const writeOps = await makeImportOperations();
  const importedCount = await commitInChunks(db, writeOps);

  return { deletedCount, importedCount, backup };
}

module.exports = {
  normalizeScheduleDate,
  getShiftDate,
  isDateInRange,
  stableShiftDocId,
  serializeFirestoreData,
  commitInChunks,
  getRestaurantMonthShiftDocs,
  hardReplaceScheduleMonth
};
