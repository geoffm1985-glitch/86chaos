import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Bell, Check, Camera, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star, Bug, Wrench, Globe } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs, getDocsFromServer, writeBatch, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { T, db, storage, auth, messaging, firebaseConfig, secureFetch, MASTER_ADMIN_EMAIL, EVENT_TAGS, CURRENT_VERSION, useLiveCollection, formatDate, getToday, getMonthStr, formatDisplayDate, formatDisplayFullDate, formatDisplayMonth, getDaysInMonth, formatShortTime, formatClockTime, formatClockDateTime, getAvatar, generateTempPass, getExpDate, getHoliday, logAudit, customMapIcon, getRestaurantExportPrefix, safeFilenamePart, downloadCsvRows, downloadTextFile, openPrintableReport } from '../core/appCore';
import { buildAlertFingerprint, useRememberedAlert } from '../core/alertMemory';
import {
  requestSubjectLabel,
  requestMatchesEmployeeFilter,
  scheduleWarningEmployeeLabel,
  warningShiftContext,
  buildCoverageVarianceRows,
  buildScheduleConflictWarningRows,
  isRequestOffBulkEligible,
} from '../core/scheduleWarningControls';
import { getCanonicalScheduleUserId, collectScheduleDurableIdentityAliases, collectScheduleShiftDurableIdentityAliases, collectScheduleEmailAliases, collectScheduleFullNameAliases, collectScheduleFirstNameAliases, collectScheduleIdentityAliases, collectScheduleShiftIdentityAliases, resolveSchedulePersonForAccount, resolveSchedulePersonForShift, buildCanonicalScheduleIdentityBlock, scheduleIdentityBlockMatchesPerson } from '../core/scheduleQueryPlanner';
import { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, MapClickListener, SmartEmptyState, MiniProblemCard, getHomeProfile, calculatePunchHours, getWeekStart, getWeekDates, roleMatches, toLocalTimeInput, makeLocalIso, PunchTable, FriendlyEmpty, GlobalSearchModal, QuickActionDock, KitchenTVMode, ChangeLogModal, UndoBar } from '../components/common';



const escapeSchedulePrintHtml = (value = '') => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const cleanScheduleRoleName = (role = '') => String(role || '').replace(/\s+/g, ' ').trim();

const getScheduleStaffRoleOptions = (users = [], dbRoles = []) => {
  const byLower = new Map();
  const addRole = (role) => {
    const clean = cleanScheduleRoleName(role);
    if (!clean || clean.toLowerCase() === 'unassigned') return;
    if (!byLower.has(clean.toLowerCase())) byLower.set(clean.toLowerCase(), clean);
  };

  // This is the single role source used by Schedule Builder and Schedule Copilot:
  // restaurant-created roles plus the exact role names currently visible in the schedule staff list.
  (dbRoles || []).forEach(r => addRole(r?.name));
  (users || []).filter(u => u?.isActive !== false).forEach(u => addRole(u?.role));

  const roles = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return roles.length ? roles : ['Unassigned'];
};

const getRoleFromScheduleStaffList = (role, scheduleRoleOptions = []) => {
  const clean = cleanScheduleRoleName(role);
  if (!clean) return scheduleRoleOptions[0] || 'Unassigned';
  const exact = scheduleRoleOptions.find(r => r.toLowerCase() === clean.toLowerCase());
  if (exact) return exact;
  const fuzzy = scheduleRoleOptions.find(r => roleMatches(r, clean) || roleMatches(clean, r));
  return fuzzy || scheduleRoleOptions[0] || clean;
};


const normalizeScheduleIdentity = (value = '') => String(value || '').toLowerCase().trim().replace(/[^a-z0-9@.]+/g, '');
const normalizeScheduleName = (value = '') => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
const firstNameKey = (value = '') => normalizeScheduleName(String(value || '').split(/\s+/)[0] || '');

const personIdentityKeys = (person = {}) => {
  const keys = new Set();
  [person.id, person.uid, person.authUid, person.accountUserId, person.userId, person.employeeId, person.rosterUserId, person.scheduleUserId, person.assignedUserId, person.membershipId, person.workspaceMemberId, person.accountProfile?.id, person.accountProfile?.uid, person.accountProfile?.authUid, person.email, person.employeeEmail, person.name, person.displayName, person.fullName, person.ghostTargetUserId].forEach(v => {
    const id = normalizeScheduleIdentity(v);
    const name = normalizeScheduleName(v);
    if (id) keys.add(id);
    if (name) keys.add(name);
  });
  return keys;
};

const recordMatchesPerson = (record = {}, person = {}) => {
  if (!record || !person) return false;
  const keys = personIdentityKeys(person);
  const directValues = [
    record.userId, record.employeeId, record.rosterUserId, record.accountUserId, record.createdBy, record.createdById, record.uid, record.authUid,
    record.userEmail, record.employeeEmail, record.email, record.assignedEmail,
    record.userName, record.employeeName, record.name, record.displayName
  ].map(v => [normalizeScheduleIdentity(v), normalizeScheduleName(v)]).flat().filter(Boolean);
  if (directValues.some(v => keys.has(v))) return true;

  // Legacy restored/imported records sometimes only carried a first name. Use this fallback only
  // when the record has no durable id/email so we do not accidentally cross-match two employees.
  const hasDurableRecordKey = !!(record.userId || record.employeeId || record.uid || record.authUid || record.userEmail || record.employeeEmail || record.email);
  if (!hasDurableRecordKey) {
    const recordFirst = firstNameKey(record.employeeName || record.userName || record.name || '');
    const personFirst = firstNameKey(person.name || person.displayName || person.email || '');
    if (recordFirst && personFirst && recordFirst === personFirst) return true;
  }
  return false;
};

const isActiveTimeOffRequest = (request = {}) => {
  const status = String(request.status || 'pending').toLowerCase();
  if (request.archived === true || request.processed === true) return false;
  return !['cancelled', 'canceled', 'archived', 'processed', 'denied', 'rejected'].includes(status);
};

const timeOffMatchesPerson = (request = {}, person = {}) => recordMatchesPerson(request, person);

const requestOffSubjectMatchesPerson = (request = {}, person = {}) => {
  if (!request || !person) return false;
  const keys = personIdentityKeys(person);
  const subjectValues = [
    request.userId, request.employeeId, request.rosterUserId, request.accountUserId, request.scheduleUserId, request.uid, request.authUid,
    request.ghostTargetUserId, request.targetUserId, request.requestedForUserId,
    request.userEmail, request.employeeEmail, request.email, request.assignedEmail,
    request.userName, request.employeeName, request.name, request.displayName
  ].map(v => [normalizeScheduleIdentity(v), normalizeScheduleName(v)]).flat().filter(Boolean);
  if (subjectValues.some(v => keys.has(v))) return true;
  const hasDurableSubjectKey = !!(request.userId || request.employeeId || request.uid || request.authUid || request.scheduleUserId || request.userEmail || request.employeeEmail || request.email);
  if (!hasDurableSubjectKey) {
    const recordFirst = firstNameKey(request.employeeName || request.userName || request.name || '');
    const personFirst = firstNameKey(person.name || person.displayName || person.email || '');
    if (recordFirst && personFirst && recordFirst === personFirst) return true;
  }
  return false;
};

const requestOffSubjectIdFields = [
  'scheduleUserId', 'employeeId', 'rosterUserId', 'accountUserId', 'userId', 'authUid', 'uid',
  'ghostTargetUserId', 'targetUserId', 'requestedForUserId'
];
const requestOffSubjectEmailFields = ['userEmail', 'employeeEmail', 'email', 'assignedEmail'];
const requestOffSubjectNameFields = ['employeeName', 'userName', 'name', 'displayName'];
const requestOffSubjectRoleFields = ['role', 'scheduleRole', 'primaryRole'];

const firstCleanRequestField = (record = {}, fields = []) => {
  for (const field of fields) {
    const value = String(record?.[field] || '').trim();
    if (value) return value;
  }
  return '';
};

const buildRequestOffSubjectFallbackPerson = (request = {}) => {
  const subjectId = firstCleanRequestField(request, requestOffSubjectIdFields);
  const subjectEmail = firstCleanRequestField(request, requestOffSubjectEmailFields);
  const subjectLabel = firstCleanRequestField(request, requestOffSubjectNameFields) || subjectEmail || subjectId;
  if (!subjectLabel && !subjectEmail && !subjectId) return null;
  const role = firstCleanRequestField(request, requestOffSubjectRoleFields) || 'Other';
  const synthetic = subjectId || subjectEmail || `request-subject:${normalizeScheduleName(subjectLabel)}`;
  return {
    id: synthetic,
    scheduleUserId: request.scheduleUserId || '',
    employeeId: request.employeeId || '',
    rosterUserId: request.rosterUserId || '',
    accountUserId: request.accountUserId || '',
    userId: request.userId || '',
    authUid: request.authUid || '',
    uid: request.uid || '',
    ghostTargetUserId: request.ghostTargetUserId || '',
    targetUserId: request.targetUserId || '',
    requestedForUserId: request.requestedForUserId || '',
    name: subjectLabel,
    displayName: subjectLabel,
    fullName: subjectLabel,
    email: subjectEmail,
    employeeEmail: subjectEmail,
    role,
    isActive: true,
    requestOnly: true,
    source: 'request-off-subject-fallback'
  };
};

const shiftMatchesPerson = (shift = {}, person = {}, roster = []) => {
  if (!shift || !person) return false;

  const personDurable = collectScheduleDurableIdentityAliases(person, person.accountProfile || {});
  const personEmails = collectScheduleEmailAliases(person, person.accountProfile || {});
  const personNames = collectScheduleFullNameAliases(person, person.accountProfile || {});
  const personFirstNames = collectScheduleFirstNameAliases(person, person.accountProfile || {});

  const shiftDurable = collectScheduleShiftDurableIdentityAliases(shift);
  const shiftEmails = collectScheduleEmailAliases(shift);
  const shiftNames = collectScheduleFullNameAliases(shift);
  const shiftFirstNames = collectScheduleFirstNameAliases(shift);

  if (shiftDurable.length) {
    if (shiftDurable.some(alias => personDurable.includes(alias))) return true;
    // Allow exact email or full-name legacy repair evidence when durable shift IDs are stale.
    if (shiftEmails.length && shiftEmails.some(alias => personEmails.includes(alias))) return true;
    if (shiftNames.length && shiftNames.some(alias => personNames.includes(alias))) return true;
    return false;
  }

  if (shiftEmails.length) return shiftEmails.some(alias => personEmails.includes(alias));
  if (shiftNames.length && shiftNames.some(alias => personNames.includes(alias))) return true;

  // First-name-only is migration evidence only and must be unique in the active roster.
  if (shiftFirstNames.length && personFirstNames.length && shiftFirstNames.some(alias => personFirstNames.includes(alias))) {
    const activeRoster = (Array.isArray(roster) ? roster : []).filter(u => u && u.isActive !== false);
    if (!activeRoster.length) return true;
    const matchingRoster = activeRoster.filter(candidate => collectScheduleFirstNameAliases(candidate).some(alias => shiftFirstNames.includes(alias)));
    return matchingRoster.length === 1 && collectScheduleIdentityAliases(matchingRoster[0]).some(alias => collectScheduleIdentityAliases(person).includes(alias));
  }
  return false;
};

const requestOffPersonKey = (request = {}) => {
  const durable = normalizeScheduleIdentity(request.userId || request.employeeId || request.rosterUserId || request.accountUserId || request.createdBy || request.authUid || request.userEmail || request.employeeEmail || request.email || '');
  if (durable) return durable;
  return normalizeScheduleName(request.userName || request.employeeName || request.name || 'unknown');
};

const requestOffDateKey = (request = {}) => {
  const raw = String(request?.date || request?.requestDate || request?.requestedDate || request?.startDate || request?.dateKey || request?.day || request?.requestedDay || request?.scheduleDateKey || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
};

const normalizeRequestOffWorkflowRow = (request = {}) => {
  const date = requestOffDateKey(request);
  return date && request.date !== date ? { ...request, date } : request;
};

const mergeRequestOffWorkflowRows = (...lists) => {
  const byKey = new Map();
  lists.flat().filter(Boolean).map(normalizeRequestOffWorkflowRow).forEach(row => {
    const key = row.id || `${requestOffDateKey(row) || 'no-date'}|${requestOffPersonKey(row)}|${row.requestedAt || row.submittedAt || row.createdAt || row.requestTimestamp || ''}`;
    if (key && !byKey.has(key)) byKey.set(key, row);
  });
  return Array.from(byKey.values());
};
const isRequestOffConflictCountable = (request = {}) => {
  const status = String(request.status || 'pending').toLowerCase();
  return request.archived !== true && !['cancelled', 'canceled', 'archived'].includes(status);
};

const titleCaseScheduleNamePart = (value = '') => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  .filter(Boolean)
  .map(part => part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ');

const prettifyScheduleMachineName = (value = '') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const emailLocal = text.includes('@') ? text.split('@')[0] : text;
  const normalized = emailLocal.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const compact = normalized.replace(/\s+/g, '');
  const slugWithTrailingDigits = compact.match(/^([a-z]{2,})([a-z])(\d{2,})$/i);
  if (slugWithTrailingDigits) return titleCaseScheduleNamePart(`${slugWithTrailingDigits[1]} ${slugWithTrailingDigits[2]}`);
  const slugParts = normalized.replace(/\d{2,}$/g, '').trim();
  return titleCaseScheduleNamePart(slugParts || normalized);
};

const cleanScheduleDisplayName = (value = '') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  if (['unknown', 'unknown staff', 'unknown employee', 'employee unknown', 'unassigned', 'unassigned staff', 'unassigned employee'].includes(lower)) return '';
  if (text.includes('@') || /^[a-z][a-z0-9._-]*\d{2,}$/i.test(text)) return prettifyScheduleMachineName(text);
  return text;
};

const getSchedulePersonName = (person = {}) => cleanScheduleDisplayName(
  person?.employeeName || person?.name || person?.displayName || person?.fullName || person?.assignedName || person?.email || person?.employeeEmail || ''
);

const getScheduleShiftFallbackName = (shift = {}) => cleanScheduleDisplayName(
  shift?.employeeName || shift?.assignedName || shift?.userName || shift?.name || shift?.displayName || shift?.employeeEmail || shift?.assignedEmail || shift?.email || ''
);

const resolveScheduleShiftPersonForDisplay = (shift = {}, roster = []) => {
  const resolved = resolveSchedulePersonForShift(shift, roster);
  if (resolved?.ok && resolved.person) return resolved.person;

  const activeRoster = (Array.isArray(roster) ? roster : []).filter(person => person && person.isActive !== false);
  const shiftAliases = collectScheduleShiftIdentityAliases(shift);
  if (shiftAliases.length) {
    const match = activeRoster.find(person => collectScheduleIdentityAliases(person).some(alias => shiftAliases.includes(alias)));
    if (match) return match;
  }
  return null;
};

const getScheduleShiftDisplayName = (shift = {}, roster = [], fallback = 'Open Shift') => {
  const person = resolveScheduleShiftPersonForDisplay(shift, roster);
  return getSchedulePersonName(person) || getScheduleShiftFallbackName(shift) || fallback;
};

const shiftResolvedPersonKey = (shift = {}, roster = []) => {
  const person = resolveScheduleShiftPersonForDisplay(shift, roster);
  const identitySource = person || shift;
  const durable = (person ? collectScheduleDurableIdentityAliases(person) : collectScheduleShiftDurableIdentityAliases(shift)).find(Boolean);
  if (durable) return `id:${durable}`;
  const email = collectScheduleEmailAliases(identitySource).find(Boolean);
  if (email) return `email:${email}`;
  const fullName = collectScheduleFullNameAliases(identitySource).find(Boolean);
  if (person && fullName) return `name:${fullName}`;
  return '';
};

const getScheduleShiftSlotKey = (shift = {}) => [
  String(shift.restaurantId || shift.workspaceId || '').trim().toLowerCase(),
  getShiftDateKey(shift),
  cleanScheduleRoleName(shift.role || shift.targetRole || 'Unassigned').toLowerCase(),
  normalizeShiftTimeForFingerprint(shift.startTime),
  normalizeShiftTimeForFingerprint(shift.endTime)
].join('|');

const shiftLooksUnresolvedForScheduleDisplay = (shift = {}, roster = []) => {
  if (resolveScheduleShiftPersonForDisplay(shift, roster)) return false;
  if (shiftResolvedPersonKey(shift, roster)) return false;
  const fallbackName = normalizeScheduleName(getScheduleShiftFallbackName(shift));
  return !fallbackName || ['unassigned', 'unknown', 'unknown staff', 'open shift'].includes(fallbackName);
};

const rankScheduleShiftForDisplay = (shift = {}, roster = []) => {
  let score = 0;
  if (resolveScheduleShiftPersonForDisplay(shift, roster)) score += 100;
  if (shiftResolvedPersonKey(shift, roster)) score += 50;
  if (getScheduleShiftFallbackName(shift)) score += 20;
  if (isScheduleShiftPublished(shift)) score += 10;
  if (shift.scheduleBuilderDraft || shift.readyToPublish || shift.rescueProtected || shift.rescueEditable) score += 5;
  score += Math.min(9, Math.floor(getShiftRecordTimeMs(shift) / 1000000000000));
  return score;
};

const collapseScheduleDisplayShifts = (shiftList = [], roster = []) => {
  const safeList = (Array.isArray(shiftList) ? shiftList : []).filter(Boolean);
  const assignedSlots = new Set(safeList
    .filter(shift => !shiftLooksUnresolvedForScheduleDisplay(shift, roster))
    .map(getScheduleShiftSlotKey)
    .filter(Boolean));

  const bySemanticKey = new Map();
  safeList.forEach((shift) => {
    const slotKey = getScheduleShiftSlotKey(shift);
    const unresolved = shiftLooksUnresolvedForScheduleDisplay(shift, roster);
    // If an unresolved/open placeholder shares the exact same date/role/time slot as a resolved
    // employee shift, it is stale duplicate noise from import/restore/listener overlap and must
    // not be shown as a real month-view shift. A genuinely open shift with no assigned duplicate
    // is still preserved.
    if (unresolved && slotKey && assignedSlots.has(slotKey)) return;

    const personKey = shiftResolvedPersonKey(shift, roster);
    const semanticKey = personKey
      ? `${slotKey}|${personKey}`
      : `${slotKey}|open:${normalizeScheduleName(getScheduleShiftFallbackName(shift)) || 'slot'}`;
    if (!semanticKey || semanticKey === '||||open:slot') return;
    const previous = bySemanticKey.get(semanticKey);
    if (!previous || rankScheduleShiftForDisplay(shift, roster) >= rankScheduleShiftForDisplay(previous, roster)) {
      bySemanticKey.set(semanticKey, shift);
    }
  });
  return Array.from(bySemanticKey.values());
};

const getScheduleShiftMonthLabels = (shift = {}, roster = []) => {
  const name = getScheduleShiftDisplayName(shift, roster);
  const firstName = cleanScheduleDisplayName(String(name || '').split(/\s+/)[0] || name) || name;
  const timeRange = `${formatShortTime(shift.startTime)}-${formatShortTime(shift.endTime)}`;
  return {
    full: `${name} ${timeRange}`.trim(),
    mobile: `${firstName} ${timeRange}`.trim()
  };
};

const getScheduleShiftDisplayIdentityKey = (shift = {}, roster = []) => {
  const person = resolveScheduleShiftPersonForDisplay(shift, roster);
  const personAliases = person ? collectScheduleIdentityAliases(person) : [];
  if (personAliases.length) return `person:${personAliases[0]}`;
  const shiftAliases = collectScheduleShiftIdentityAliases(shift);
  if (shiftAliases.length) return `shift:${shiftAliases[0]}`;
  const label = normalizeScheduleName(getScheduleShiftFallbackName(shift));
  return label ? `name:${label}` : 'open:unresolved';
};

const getScheduleShiftDisplayDedupeKey = (shift = {}, roster = []) => {
  const date = getShiftDateKey(shift);
  const identity = getScheduleShiftDisplayIdentityKey(shift, roster);
  const role = cleanScheduleRoleName(shift.role || shift.targetRole || '').toLowerCase();
  const start = normalizeShiftTimeForFingerprint(shift.startTime);
  const end = normalizeShiftTimeForFingerprint(shift.endTime);
  return [date, identity, role, start, end].join('|');
};

const getScheduleDisplayResolutionScore = (shift = {}, roster = []) => {
  const person = resolveScheduleShiftPersonForDisplay(shift, roster);
  const hasUsefulName = Boolean(getSchedulePersonName(person) || getScheduleShiftFallbackName(shift));
  const hasDurable = collectScheduleShiftDurableIdentityAliases(shift).length > 0;
  const isPublished = isScheduleShiftPublished(shift);
  return (person ? 1000 : 0) + (hasUsefulName ? 100 : 0) + (hasDurable ? 10 : 0) + (isPublished ? 5 : 0) + Math.min(getShiftRecordTimeMs(shift) / 1000000000000, 4);
};

const dedupePublishedScheduleShiftsForDisplay = (shiftList = [], roster = []) => collapseScheduleDisplayShifts(shiftList, roster);

const getSchedulePersonForAppUser = (appUser = {}, users = []) => {
  if (!appUser) return {};
  const resolved = resolveSchedulePersonForAccount(appUser, users);
  const rosterUser = resolved.ok ? resolved.person : null;
  if (!rosterUser) return appUser;
  const canonical = buildCanonicalScheduleIdentityBlock(rosterUser, appUser);
  const rosterDisplayName = getSchedulePersonName(rosterUser) || cleanScheduleDisplayName(canonical.employeeName) || cleanScheduleDisplayName(appUser.name) || prettifyScheduleMachineName(appUser.email || '');
  // Preserve account/session identity and roster/schedule identity separately.
  // Canonical fields are assigned after spreads so auth UID cannot overwrite the roster scheduleUserId
  // and a machine-like login/display label cannot overwrite the human roster name on schedule chips.
  return {
    ...appUser,
    ...rosterUser,
    ...canonical,
    id: rosterUser.id || rosterUser.scheduleUserId || rosterUser.employeeId || appUser.id || appUser.uid || '',
    uid: appUser.uid || appUser.authUid || rosterUser.uid || '',
    authUid: canonical.authUid || appUser.uid || appUser.authUid || '',
    accountUserId: canonical.accountUserId || appUser.id || appUser.uid || '',
    loginEmail: appUser.email || appUser.userEmail || '',
    email: appUser.email || rosterUser.email || canonical.employeeEmail || '',
    employeeEmail: canonical.employeeEmail || rosterUser.email || appUser.email || '',
    employeeName: rosterDisplayName || canonical.employeeName || rosterUser.name || appUser.name || '',
    assignedName: rosterDisplayName || canonical.assignedName || canonical.employeeName || '',
    name: rosterDisplayName || cleanScheduleDisplayName(appUser.name) || appUser.email || ''
  };
};




export const buildScheduleIdentityFields = (person = {}, account = {}) => buildCanonicalScheduleIdentityBlock(person, account);

export const normalizeShiftTimeForFingerprint = (value) => {
  const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!raw) return '';
  if (['close', 'cl', 'closing'].includes(raw)) return 'close';
  if (['open', 'opening'].includes(raw)) return 'open';
  const match = raw.match(/^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/);
  if (!match) return raw;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3] || '';
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';
  if ((meridiem === 'p' || meridiem === 'pm') && hours < 12) hours += 12;
  if ((meridiem === 'a' || meridiem === 'am') && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const getStableShiftEmployeeKey = (shift = {}) => {
  const durable = [shift.employeeId, shift.userId, shift.rosterUserId, shift.accountUserId, shift.assignedUserId, shift.uid, shift.authUid]
    .map(normalizeScheduleIdentity)
    .find(Boolean);
  if (durable) return `id:${durable}`;
  const email = [shift.employeeEmail, shift.userEmail, shift.email, shift.assignedEmail]
    .map(normalizeScheduleIdentity)
    .find(Boolean);
  if (email) return `email:${email}`;
  const name = [shift.employeeName, shift.userName, shift.name, shift.displayName, shift.assignedName]
    .map(normalizeScheduleName)
    .find(Boolean);
  return name ? `name:${name}` : '';
};

export const resolveAmbiguousNameOnlyShiftIdentity = (shift = {}, roster = []) => {
  const durable = [shift.employeeId, shift.userId, shift.rosterUserId, shift.accountUserId, shift.assignedUserId, shift.uid, shift.authUid]
    .map(normalizeScheduleIdentity)
    .find(Boolean);
  const email = [shift.employeeEmail, shift.userEmail, shift.email, shift.assignedEmail]
    .map(normalizeScheduleIdentity)
    .find(Boolean);
  if (durable || email) return { ok: true, shift, reason: '' };

  const rawNameValues = [shift.employeeName, shift.userName, shift.name, shift.displayName, shift.assignedName];
  const nameKey = rawNameValues
    .map(normalizeScheduleName)
    .find(Boolean);
  const firstKey = rawNameValues
    .map(firstNameKey)
    .find(Boolean);
  if (!nameKey) return { ok: false, shift, reason: 'missing-employee-identity' };

  const activeRoster = (Array.isArray(roster) ? roster : []).filter(person => person && person.isActive !== false);
  const exactMatches = activeRoster.filter(person => {
    const candidateNames = [person.name, person.displayName, person.fullName, person.employeeName]
      .map(normalizeScheduleName)
      .filter(Boolean);
    return candidateNames.includes(nameKey);
  });
  const firstNameMatches = exactMatches.length === 0 && firstKey ? activeRoster.filter(person => {
    const candidateFirstNames = [person.name, person.displayName, person.fullName, person.employeeName]
      .map(firstNameKey)
      .filter(Boolean);
    return candidateFirstNames.includes(firstKey);
  }) : [];
  const matches = exactMatches.length ? exactMatches : firstNameMatches;

  if (matches.length !== 1) {
    return { ok: false, shift, reason: matches.length > 1 ? 'ambiguous-name-only-identity' : 'unmatched-name-only-identity' };
  }

  const match = matches[0];
  const resolvedId = match.id || match.uid || match.authUid || match.accountUserId || '';
  return {
    ok: Boolean(resolvedId),
    reason: '',
    shift: {
      ...shift,
      employeeId: shift.employeeId || resolvedId || '',
      userId: shift.userId || match.userId || resolvedId || '',
      rosterUserId: shift.rosterUserId || resolvedId || '',
      employeeName: shift.employeeName || match.name || match.displayName || match.fullName || shift.name || '',
      employeeEmail: shift.employeeEmail || match.email || shift.email || shift.assignedEmail || '',
      assignedEmail: shift.assignedEmail || match.email || shift.employeeEmail || ''
    }
  };
};


const findAutoFillRosterPersonForShift = (shift = {}, roster = []) => {
  const activeRoster = (Array.isArray(roster) ? roster : []).filter(person => person && person.isActive !== false);
  const durableKeys = [shift.scheduleUserId, shift.employeeId, shift.userId, shift.rosterUserId, shift.accountUserId, shift.assignedUserId, shift.uid, shift.authUid]
    .map(normalizeScheduleIdentity)
    .filter(Boolean);
  const emailKeys = [shift.employeeEmail, shift.userEmail, shift.email, shift.assignedEmail]
    .map(normalizeScheduleIdentity)
    .filter(Boolean);
  const fullNameKeys = [shift.employeeName, shift.userName, shift.name, shift.displayName, shift.assignedName]
    .map(normalizeScheduleName)
    .filter(Boolean);
  const firstKeys = [shift.employeeName, shift.userName, shift.name, shift.displayName, shift.assignedName]
    .map(firstNameKey)
    .filter(Boolean);

  const personDurableKeys = (person = {}) => [person.scheduleUserId, person.employeeId, person.rosterUserId, person.userId, person.accountUserId, person.authUid, person.uid, person.id]
    .map(normalizeScheduleIdentity)
    .filter(Boolean);
  const personEmailKeys = (person = {}) => [person.employeeEmail, person.userEmail, person.email, person.assignedEmail]
    .map(normalizeScheduleIdentity)
    .filter(Boolean);
  const personFullNameKeys = (person = {}) => [person.employeeName, person.name, person.displayName, person.fullName, person.assignedName]
    .map(normalizeScheduleName)
    .filter(Boolean);
  const personFirstKeys = (person = {}) => [person.employeeName, person.name, person.displayName, person.fullName, person.assignedName]
    .map(firstNameKey)
    .filter(Boolean);

  const exactDurable = activeRoster.filter(person => durableKeys.some(key => personDurableKeys(person).includes(key)));
  if (exactDurable.length === 1) return { ok: true, person: exactDurable[0], reason: 'durable' };

  const exactEmail = activeRoster.filter(person => emailKeys.some(key => personEmailKeys(person).includes(key)));
  if (exactEmail.length === 1) return { ok: true, person: exactEmail[0], reason: 'email' };

  const exactName = activeRoster.filter(person => fullNameKeys.some(key => personFullNameKeys(person).includes(key)));
  if (exactName.length === 1) return { ok: true, person: exactName[0], reason: 'name' };

  // Old imported/copied schedules sometimes had a stale employeeId but only a short first-name label.
  // Use first-name matching only when it uniquely identifies one active roster record.
  const firstNameMatches = activeRoster.filter(person => firstKeys.some(key => personFirstKeys(person).includes(key)));
  if (firstNameMatches.length === 1) return { ok: true, person: firstNameMatches[0], reason: 'first-name' };

  return { ok: false, person: null, reason: exactDurable.length > 1 || exactEmail.length > 1 || exactName.length > 1 || firstNameMatches.length > 1 ? 'ambiguous-roster-match' : 'no-roster-match' };
};

const mergeVisibleScheduleShifts = (...shiftGroups) => {
  const seen = new Set();
  const merged = [];
  shiftGroups.flat().filter(Boolean).forEach(shift => {
    const key = shift.id ? `id:${shift.id}` : buildShiftFingerprint(shift) || `${shift.date || shift.scheduleDateKey || ''}|${shift.employeeName || ''}|${shift.startTime || ''}|${shift.endTime || ''}`;
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(shift);
  });
  return merged;
};

const getShiftWritableDocId = (shift = {}) => String(shift?.id || shift?.docId || shift?.firestoreId || shift?._id || '').trim();
const getShiftRecordTimeMs = (shift = {}) => {
  const raw = shift?.createdAt || shift?.updatedAt || shift?.publishedAt || shift?.importedAt || shift?.restoredAt || '';
  if (!raw) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (typeof raw?.toMillis === 'function') return raw.toMillis();
  if (typeof raw?.seconds === 'number') return raw.seconds * 1000;
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : 0;
};
const shiftIsInsideDaySet = (shift = {}, daySet = new Set()) => daySet.has(String(shift?.date || shift?.scheduleDateKey || '').trim());

const dedupeScheduleShiftsByDatePersonTime = (shiftList = []) => {
  const seen = new Set();
  return (shiftList || []).filter(shift => {
    const key = buildShiftFingerprint(shift) || getShiftPublishIdentity(shift) || `${getShiftDateKey(shift)}|${shift?.employeeName || ''}|${shift?.startTime || ''}|${shift?.endTime || ''}`;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getShiftPublishIdentity = (shift = {}) => {
  const docId = getShiftWritableDocId(shift);
  if (docId) return `id:${docId}`;
  const fingerprint = buildShiftFingerprint(shift);
  return fingerprint ? `fp:${fingerprint}` : '';
};

const mergeSchedulePublishCandidates = (...shiftGroups) => {
  const byKey = new Map();
  shiftGroups.flat().filter(Boolean).forEach(shift => {
    const key = getShiftPublishIdentity(shift);
    if (!key) return;
    const previous = byKey.get(key) || {};
    const previousTime = getShiftRecordTimeMs(previous);
    const nextTime = getShiftRecordTimeMs(shift);
    const authoritative = !previousTime || (nextTime && nextTime >= previousTime) ? shift : previous;
    const merged = { ...previous, ...shift, ...authoritative };
    byKey.set(key, { ...merged, id: getShiftWritableDocId(shift) || getShiftWritableDocId(previous) || shift.id || previous.id });
  });
  return Array.from(byKey.values());
};

const getScheduleMonthBoundsForKey = (monthKey = '') => {
  const cleanMonth = String(monthKey || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(cleanMonth)) return { start: '', end: '' };
  const [year, month] = cleanMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${cleanMonth}-01`, end: `${cleanMonth}-${String(lastDay).padStart(2, '0')}` };
};

export const buildShiftFingerprint = (shift = {}) => {
  const date = String(shift.date || '').trim();
  const employeeKey = getStableShiftEmployeeKey(shift);
  const role = cleanScheduleRoleName(shift.role || 'Unassigned').toLowerCase();
  const start = normalizeShiftTimeForFingerprint(shift.startTime);
  const end = normalizeShiftTimeForFingerprint(shift.endTime);
  if (!date || !employeeKey || !start || !end) return '';
  return [date, employeeKey, role, start, end].join('|');
};

const SHIFT_LOCAL_DELETE_MARKER_GRACE_MS = 5000;
const SHIFT_LOCAL_DELETE_MARKER_TTL_MS = 120000;
const SHIFT_SAVED_DELETE_MARKER_TTL_MS = 12 * 60 * 60 * 1000;
const SHIFT_SAVED_DELETE_RETRY_MS = 15000;

const getScheduleDeletedShiftStorageKey = (restaurantId = '') => `86chaos:scheduleBuilderDeletedShiftIds:${String(restaurantId || 'unknown').trim() || 'unknown'}`;

const readScheduleDeletedShiftMarkersFromStorage = (restaurantId = '', now = Date.now()) => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage?.getItem(getScheduleDeletedShiftStorageKey(restaurantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(marker => marker && String(marker.key || '').startsWith('id:') && Number(marker.expiresAt || 0) > now)
      .map(marker => ({
        key: String(marker.key || ''),
        shiftId: String(marker.shiftId || String(marker.key || '').replace(/^id:/, '')),
        restaurantId: String(marker.restaurantId || restaurantId || ''),
        createdAt: Number(marker.createdAt || now),
        expiresAt: Number(marker.expiresAt || now + SHIFT_SAVED_DELETE_MARKER_TTL_MS),
        persisted: true
      }));
  } catch {
    return [];
  }
};

const writeScheduleDeletedShiftMarkersToStorage = (restaurantId = '', markers = [], now = Date.now()) => {
  if (typeof window === 'undefined') return;
  try {
    const idMarkers = (markers || [])
      .filter(marker => marker && String(marker.key || '').startsWith('id:') && Number(marker.expiresAt || 0) > now)
      .map(marker => ({
        key: String(marker.key || ''),
        shiftId: String(marker.shiftId || String(marker.key || '').replace(/^id:/, '')),
        restaurantId: String(marker.restaurantId || restaurantId || ''),
        createdAt: Number(marker.createdAt || now),
        expiresAt: Number(marker.expiresAt || now + SHIFT_SAVED_DELETE_MARKER_TTL_MS)
      }));
    if (!idMarkers.length) {
      window.localStorage?.removeItem(getScheduleDeletedShiftStorageKey(restaurantId));
      return;
    }
    window.localStorage?.setItem(getScheduleDeletedShiftStorageKey(restaurantId), JSON.stringify(idMarkers.slice(-500)));
  } catch {
    // Local tombstones are a UI safety net only. Firestore remains the source of truth.
  }
};

const getScheduleShiftLocalDeleteKeys = (shift = {}) => {
  const id = String(shift?.id || '').trim();
  if (id) return [`id:${id}`];
  return getScheduleShiftLocalPruneKeys(shift);
};

const getScheduleShiftLocalPruneKeys = (shift = {}) => {
  const keys = [];
  const fingerprint = buildShiftFingerprint(shift);
  if (fingerprint) keys.push(`fp:${fingerprint}`);
  const fallback = [
    String(shift?.restaurantId || ''),
    String(shift?.date || shift?.scheduleDateKey || ''),
    getStableShiftEmployeeKey(shift),
    normalizeShiftTimeForFingerprint(shift?.startTime),
    normalizeShiftTimeForFingerprint(shift?.endTime)
  ].filter(Boolean).join('|');
  if (fallback) keys.push(`fallback:${fallback}`);
  return [...new Set(keys)];
};

const buildLocalShiftDeletionMarkers = (shiftList = [], now = Date.now()) => {
  return (shiftList || []).flatMap(shift => {
    const markerKeys = new Set([
      ...getScheduleShiftLocalDeleteKeys(shift),
      ...getScheduleShiftLocalPruneKeys(shift)
    ].filter(Boolean));
    return Array.from(markerKeys).map(key => {
      const isSavedId = String(key || '').startsWith('id:');
      return {
        key,
        shiftId: isSavedId ? String(key).replace(/^id:/, '') : '',
        restaurantId: String(shift?.restaurantId || ''),
        createdAt: now,
        sourceRecordTime: getShiftRecordTimeMs(shift),
        expiresAt: now + (isSavedId ? SHIFT_SAVED_DELETE_MARKER_TTL_MS : SHIFT_LOCAL_DELETE_MARKER_TTL_MS)
      };
    });
  });
};

const mergeLocalShiftDeletionMarkers = (existing = [], incoming = []) => {
  const byKey = new Map();
  [...(existing || []), ...(incoming || [])].forEach(marker => {
    if (!marker?.key) return;
    const prev = byKey.get(marker.key);
    if (!prev || Number(marker.expiresAt || 0) > Number(prev.expiresAt || 0)) byKey.set(marker.key, marker);
  });
  return Array.from(byKey.values());
};

const scheduleShiftHasLocalDeleteKey = (shift = {}, key = '') => getScheduleShiftLocalDeleteKeys(shift).includes(key);

const shiftMatchesLocalDeleteMarkers = (shift = {}, markerKeySet = new Set(), markerMap = null) => {
  if (!markerKeySet || markerKeySet.size === 0) return false;
  const id = String(shift?.id || '').trim();
  if (id && markerKeySet.has(`id:${id}`)) return true;
  const candidateKeys = getScheduleShiftLocalPruneKeys(shift);
  return candidateKeys.some(key => {
    if (!markerKeySet.has(key)) return false;
    const marker = markerMap?.get?.(key);
    if (!marker) return true;
    const shiftTime = getShiftRecordTimeMs(shift);
    const markerTime = Number(marker.createdAt || marker.sourceRecordTime || 0);
    // Fingerprint tombstones hide old deleted copies but should not hide a brand-new shift
    // re-added after the deletion was confirmed.
    return !shiftTime || !markerTime || shiftTime <= markerTime;
  });
};

const shiftMatchesLocalDeletePruneKeys = (shift = {}, pruneKeySet = new Set()) => {
  if (!pruneKeySet || pruneKeySet.size === 0) return false;
  return getScheduleShiftLocalPruneKeys(shift).some(key => pruneKeySet.has(key));
};

export const buildAutoPopulateShift = (sourceShift = {}, newDate = '', restaurantId = '', actor = {}, copiedFromMonth = '', resolvedPerson = null) => {
  const nowIso = new Date().toISOString();
  const month = getMonthStr(newDate || getToday());
  const identitySource = resolvedPerson || sourceShift;
  return {
    date: newDate,
    scheduleDateKey: newDate,
    scheduleMonth: month,
    ...buildScheduleIdentityFields(identitySource),
    role: sourceShift.role || resolvedPerson?.role || 'Unassigned',
    startTime: sourceShift.startTime || '',
    endTime: sourceShift.endTime || '',
    isPublished: false,
    publishState: 'draft',
    scheduleBuilderDraft: true,
    readyToPublish: true,
    restaurantId,
    workspaceId: restaurantId,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: actor?.id || actor?.uid || actor?.email || 'auto-populate',
    updatedBy: actor?.id || actor?.uid || actor?.email || 'auto-populate',
    createdByName: actor?.name || actor?.email || 'Schedule Auto-Fill',
    source: 'schedule_auto_fill',
    assignmentSource: 'schedule_auto_fill',
    copiedFromShiftId: sourceShift.id || '',
    copiedFromMonth,
    autoFillTargetMonth: month
  };
};

const parseScheduleTimeParts = (value, fallback = { hours: 0, minutes: 0 }) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return fallback;
  if (raw === 'CLOSE' || raw === 'CL') return { hours: 23, minutes: 59, seconds: 59 };
  if (raw === 'OPEN') return { hours: 0, minutes: 0, seconds: 0 };

  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(A|P|AM|PM)?$/);
  if (!match) return fallback;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2] || '0', 10);
  const meridian = match[3] || '';
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;

  if (meridian.startsWith('P') && hours < 12) hours += 12;
  if (meridian.startsWith('A') && hours === 12) hours = 0;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;

  return { hours, minutes, seconds: 0 };
};

const buildScheduleDateTime = (dateKey, timeValue, fallback) => {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) return null;
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const parts = parseScheduleTimeParts(timeValue, fallback);
  return new Date(year, month - 1, day, parts.hours, parts.minutes, parts.seconds || 0, 0);
};

const getShiftDateKey = (shift = {}) => String(shift?.date || shift?.scheduleDateKey || '').trim();

const getShiftStartDateTime = (shift) => buildScheduleDateTime(getShiftDateKey(shift), shift?.startTime, { hours: 0, minutes: 0, seconds: 0 });

const getShiftEndDateTime = (shift) => {
  const startAt = getShiftStartDateTime(shift);
  const endAt = buildScheduleDateTime(getShiftDateKey(shift), shift?.endTime, { hours: 23, minutes: 59, seconds: 59 });
  if (!endAt) return null;
  if (startAt && endAt.getTime() <= startAt.getTime()) endAt.setDate(endAt.getDate() + 1);
  return endAt;
};

const isShiftStillCurrentOrUpcoming = (shift, now = new Date()) => {
  const dateKey = getShiftDateKey(shift);
  if (!dateKey) return false;
  const endAt = getShiftEndDateTime(shift);
  if (!endAt) return dateKey >= formatDate(now);
  return endAt.getTime() > now.getTime();
};

const isShiftInPast = (shift, now = new Date()) => getShiftDateKey(shift) ? !isShiftStillCurrentOrUpcoming(shift, now) : false;

const isScheduleDateComplete = (dateKey, shiftsForDate = [], now = new Date()) => {
  if (!dateKey) return false;
  const dateValue = String(dateKey);
  const today = formatDate(now);
  if (dateValue < today) return true;
  if (dateValue > today) return false;
  const dayShifts = (shiftsForDate || []).filter(s => s?.date === dateValue);
  return dayShifts.length > 0 && dayShifts.every(s => isShiftInPast(s, now));
};

const compareShiftsByStartDateTime = (a, b) => {
  const aStart = getShiftStartDateTime(a)?.getTime() || 0;
  const bStart = getShiftStartDateTime(b)?.getTime() || 0;
  if (aStart !== bStart) return aStart - bStart;
  return String(a?.role || '').localeCompare(String(b?.role || ''));
};

const mergeWorkspaceSettings = (appUser = {}, clientData = {}) => ({
  ...(appUser?.systemSettings || {}),
  ...(clientData?.systemSettings || {})
});

const settingBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['false', '0', 'off', 'no', 'disabled'].includes(v)) return false;
    if (['true', '1', 'on', 'yes', 'enabled'].includes(v)) return true;
  }
  return Boolean(value);
};


const WEEKDAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

const normalizeScheduleWeekStart = (value = 'Monday') => {
  const clean = String(value || 'Monday').trim();
  return Object.prototype.hasOwnProperty.call(WEEKDAY_INDEX, clean) ? clean : 'Monday';
};

const getSchedulePublishingSettings = (appUser = {}, clientData = {}) => {
  const settings = mergeWorkspaceSettings(appUser, clientData);
  const rawMode = String(settings.schedulePublishMode || settings.scheduleCadence || settings.schedulePublishingCadence || 'monthly').toLowerCase();
  const allowedModes = ['weekly', 'biweekly', 'monthly', 'custom'];
  const mode = allowedModes.includes(rawMode) ? rawMode : 'monthly';
  const customWeeks = Math.min(8, Math.max(1, parseInt(settings.scheduleCustomWeeks || settings.schedulePeriodWeeks || (mode === 'biweekly' ? 2 : 1), 10) || 1));
  const weeks = mode === 'weekly' ? 1 : mode === 'biweekly' ? 2 : mode === 'custom' ? customWeeks : null;
  const weekStartsOn = normalizeScheduleWeekStart(settings.scheduleWeekStartsOn || settings.weekStartsOn || appUser?.preferences?.payPeriodStart || 'Monday');
  const allowPostPublishedTimeOff = settings.allowPostPublishedTimeOff !== false;
  return { mode, weeks, customWeeks, weekStartsOn, allowPostPublishedTimeOff };
};

const getSchedulePeriodBounds = (dateKey, scheduleSettings = {}) => {
  const base = new Date(`${dateKey || getToday()}T12:00:00`);
  if (scheduleSettings.mode === 'monthly' || !scheduleSettings.weeks) {
    const month = getMonthStr(dateKey || getToday());
    return { start: `${month}-01`, end: `${month}-${String(getDaysInMonth(month)).padStart(2, '0')}` };
  }
  const weekStart = WEEKDAY_INDEX[normalizeScheduleWeekStart(scheduleSettings.weekStartsOn)] ?? 1;
  const start = new Date(base);
  while (start.getDay() !== weekStart) start.setDate(start.getDate() - 1);
  const end = new Date(start);
  end.setDate(start.getDate() + (Number(scheduleSettings.weeks || 1) * 7) - 1);
  return { start: formatDate(start), end: formatDate(end) };
};

const getScheduleOuterWeekBounds = (bounds = {}, scheduleSettings = {}) => {
  const startKey = bounds?.start || getToday();
  const endKey = bounds?.end || startKey;
  const weekStart = WEEKDAY_INDEX[normalizeScheduleWeekStart(scheduleSettings.weekStartsOn)] ?? 1;
  const start = new Date(`${startKey}T12:00:00`);
  while (start.getDay() !== weekStart) start.setDate(start.getDate() - 1);
  const end = new Date(`${endKey}T12:00:00`);
  while (end.getDay() !== ((weekStart + 6) % 7)) end.setDate(end.getDate() + 1);
  return { start: formatDate(start), end: formatDate(end) };
};

const buildDateRange = (startKey, endKey) => {
  const days = [];
  if (!startKey || !endKey) return days;
  const cursor = new Date(`${startKey}T12:00:00`);
  const end = new Date(`${endKey}T12:00:00`);
  while (cursor <= end && days.length < 75) {
    days.push(formatDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const getSchedulePeriodLabel = (bounds, scheduleSettings = {}) => {
  if (scheduleSettings.mode === 'monthly') return formatDisplayMonth(getMonthStr(bounds.start));
  const modeLabel = scheduleSettings.mode === 'weekly' ? 'Weekly' : scheduleSettings.mode === 'biweekly' ? '2-Week' : `${scheduleSettings.weeks || 1}-Week`;
  return `${modeLabel} Schedule: ${formatDisplayDate(bounds.start)} - ${formatDisplayDate(bounds.end)}`;
};

export const isDeletedScheduleShift = (shift = {}) => {
  const status = String(shift?.status || '').toLowerCase().trim();
  const publishStatus = String(shift?.publishStatus || '').toLowerCase().trim();
  const recordStatus = String(shift?.recordStatus || '').toLowerCase().trim();
  return shift?.deleted === true || shift?.isDeleted === true || shift?.scheduleDeleted === true || status === 'deleted' || publishStatus === 'deleted' || recordStatus === 'deleted';
};

const isScheduleShiftPublished = (shift = {}) => {
  if (isDeletedScheduleShift(shift)) return false;
  const statusBlob = [
    shift?.status,
    shift?.publishStatus,
    shift?.publishState,
    shift?.schedulePublishStatus,
    shift?.visibility
  ].map(v => String(v || '').toLowerCase().trim()).join('|');
  return shift?.isPublished === true
    || shift?.published === true
    || shift?.isLive === true
    || shift?.schedulePublished === true
    || statusBlob.split('|').includes('published')
    || statusBlob.split('|').includes('live')
    || Boolean(shift?.publishedAt || shift?.scheduleId);
};

const isDateInsidePublishedSchedule = (dateKey, shifts = []) => {
  if (!dateKey) return false;
  return (shifts || []).some(s => String(s?.date || s?.scheduleDateKey || '') === String(dateKey) && isScheduleShiftPublished(s));
};

const isTipDeclarationEnabled = (appUser = {}, clientData = {}) => {
  const settings = mergeWorkspaceSettings(appUser, clientData);
  const raw = settings.tips ?? settings.mandatoryTipDeclaration ?? settings.tipDeclarationRequired ?? settings.tipDeclarationEnabled;
  // The workspace setting has always defaulted to ON in Settings. Treat missing legacy
  // fields as enabled so old restaurant docs cannot silently let employees bypass tips.
  return settingBool(raw, true);
};


const SCHEDULE_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getScheduleWeekdayName = (dateKey = '') => {
  try { return SCHEDULE_WEEKDAYS[new Date(`${dateKey}T12:00:00`).getDay()] || ''; } catch (err) { return ''; }
};

const normalizeAvailabilityStatus = (status = '') => String(status || 'approved').toLowerCase();

const isAvailabilityActiveForDate = (record = {}, dateKey = '') => {
  if (!record || !dateKey) return false;
  const status = normalizeAvailabilityStatus(record.status);
  if (!['approved', 'active'].includes(status)) return false;
  if (record.archived === true || status === 'archived' || status === 'denied') return false;
  if (record.effectiveStartDate && record.effectiveStartDate > dateKey) return false;
  if (record.effectiveEndDate && record.effectiveEndDate < dateKey) return false;
  return true;
};

const getActiveAvailabilityForDate = (employeeId = '', dateKey = '', availabilityRecords = []) => {
  return (availabilityRecords || [])
    .filter(record => String(record.employeeId || record.userId || '') === String(employeeId || '') && isAvailabilityActiveForDate(record, dateKey))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || b.effectiveStartDate || 0) - new Date(a.updatedAt || a.createdAt || a.effectiveStartDate || 0))[0] || null;
};

const timeWindowOverlaps = (startA = '', endA = '', startB = '', endB = '') => {
  if (!startA || !endA || !startB || !endB) return false;
  return startA < endB && endA > startB;
};

const getAvailabilityConflict = (availabilityRecord = null, dateKey = '', startTime = '', endTime = '') => {
  if (!availabilityRecord || !dateKey || !startTime || !endTime) return null;
  const dayName = getScheduleWeekdayName(dateKey);
  const weekly = availabilityRecord.weeklyAvailability || {};
  const day = weekly[dayName] || weekly[dayName?.toLowerCase?.()] || null;
  const unavailableWindows = Array.isArray(availabilityRecord.unavailableWindows) ? availabilityRecord.unavailableWindows : [];
  const preferredWindows = Array.isArray(availabilityRecord.preferredWindows) ? availabilityRecord.preferredWindows : [];
  const unavailableHit = unavailableWindows.find(win => (win.day === dayName || win.day === dayName.toLowerCase()) && timeWindowOverlaps(startTime, endTime, win.start || win.startTime || '00:00', win.end || win.endTime || '23:59'));
  if (unavailableHit) return { level: 'unavailable', message: `${dayName} ${startTime}-${endTime} overlaps an unavailable window.` };
  if (!day || day.available === false) return { level: 'outside', message: `${dayName} is not listed as available.` };
  const availableStart = day.start || day.startTime || '00:00';
  const availableEnd = day.end || day.endTime || '23:59';
  if (startTime < availableStart || endTime > availableEnd) return { level: 'outside', message: `Shift ${startTime}-${endTime} is outside availability ${availableStart}-${availableEnd}.` };
  const preferredHit = day.preferred === true || preferredWindows.some(win => (win.day === dayName || win.day === dayName.toLowerCase()) && timeWindowOverlaps(startTime, endTime, win.start || win.startTime || '00:00', win.end || win.endTime || '23:59'));
  return preferredHit ? { level: 'preferred', message: 'Preferred availability window.' } : { level: 'available', message: 'Available.' };
};

const normalizeTipAmount = (value) => {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
};

const TabMasterSchedule = ({ currentDate, setCurrentDate = null, onSubTabChange = null, appUser, users, shifts, shiftSwaps, timeOffRequests, events, addToast, initialSubTab = 'my-schedule', voiceScheduleSubTabTarget = null, scheduleBuilderProps = null, clientData = null }) => {
  const [rosterFilterDate, setRosterFilterDate] = useState('');
  const [isFullSchedulePickerOpen, setIsFullSchedulePickerOpen] = useState(false);
  const [fullSchedulePickerMonth, setFullSchedulePickerMonth] = useState(getMonthStr(currentDate));
  const monthStr = getMonthStr(currentDate);
  const schedulePerson = getSchedulePersonForAppUser(appUser, users);
  
  // --- TIME CLOCK LOGIC ---
  const [activePunch, setActivePunch] = useState(null);
  const [clockActionBusy, setClockActionBusy] = useState(false);
  const [clockActionType, setClockActionType] = useState(null);
  const [clockActionPunch, setClockActionPunch] = useState(null);
  const [scheduleNow, setScheduleNow] = useState(() => new Date());
  const recentlyClockedOutRef = useRef({});

  useEffect(() => {
    const refreshScheduleNow = () => setScheduleNow(new Date());
    refreshScheduleNow();
    const tick = setInterval(refreshScheduleNow, 30000);
    const onVisibility = () => { if (!document.hidden) refreshScheduleNow(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [tipCash, setTipCash] = useState('');
  const [tipCredit, setTipCredit] = useState('');
  const [subTab, setSubTab] = useState(initialSubTab);
  const canViewTeamAvailability = Boolean(appUser?.isSuperAdmin || appUser?.isAdmin || appUser?.isOwner || appUser?.accountOwner || appUser?.workspaceOwner || appUser?.permissions?.schedule || appUser?.permissions?.team);
  const scheduleIdentity = buildScheduleIdentityFields(getSchedulePersonForAppUser(appUser, users), appUser);
  const availabilityWhereClauses = canViewTeamAvailability ? [] : [['scheduleUserId', '==', scheduleIdentity.scheduleUserId || '__none__']];
  const availabilityRecords = useLiveCollection('availabilityRecords', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && (subTab === 'availability' || subTab === 'schedule-builder'), whereClauses: availabilityWhereClauses, orderByField: canViewTeamAvailability ? 'employeeName' : null, orderDirection: 'asc', limitCount: canViewTeamAvailability ? 220 : 25, fallbackLimitCount: canViewTeamAvailability ? 80 : 25, debugLabel: `schedule:${subTab}:availability` });

  useEffect(() => { onSubTabChange?.(subTab); }, [subTab, onSubTabChange]);

  useEffect(() => {
    setFullSchedulePickerMonth(getMonthStr(currentDate));
  }, [currentDate]);

  const jumpFullScheduleDate = (dateKey = '') => {
    setRosterFilterDate(dateKey);
    if (dateKey && typeof setCurrentDate === 'function') setCurrentDate(dateKey);
  };

  const changeFullSchedulePickerMonth = (offset) => {
    const base = new Date((fullSchedulePickerMonth || monthStr) + '-01T12:00:00');
    base.setMonth(base.getMonth() + offset);
    setFullSchedulePickerMonth(base.toISOString().substring(0, 7));
  };

  const selectFullSchedulePickerDate = (dateKey) => {
    jumpFullScheduleDate(dateKey);
    setFullSchedulePickerMonth(getMonthStr(dateKey));
    setIsFullSchedulePickerOpen(false);
  };

  const openScheduleSubTabSafely = (requested = '') => {
    if (!requested) return;
    const allowed = ['my-schedule', 'full-schedule', 'month-view', 'trade-board', 'time-off', 'availability'];
    if ((appUser?.isAdmin || appUser?.permissions?.schedule) && scheduleBuilderProps) allowed.push('schedule-builder');
    if (allowed.includes(requested)) setSubTab(requested);
  };

  useEffect(() => {
    openScheduleSubTabSafely(voiceScheduleSubTabTarget?.subTab);
  }, [voiceScheduleSubTabTarget?.id]);

  useEffect(() => {
    let requested = '';
    try {
      requested = sessionStorage.getItem('scheduleFocus') || '';
      if (requested) sessionStorage.removeItem('scheduleFocus');
    } catch (e) {}
    openScheduleSubTabSafely(requested);
  }, []);

  useEffect(() => {
    if (subTab !== 'my-schedule') {
      setActivePunch(null);
      return undefined;
    }
    if (!appUser?.id || !appUser?.restaurantId) {
      setActivePunch(null);
      return;
    }

    const scheduleUserId = appUser.scheduleUserId || appUser.employeeId || appUser.userId || appUser.rosterUserId || appUser.id;
    // Keep the active-punch listener index-light. The old status + clockInTime
    // server sort was brittle in production and could lock the entire Schedule tab
    // behind a chunk-recovery screen if Firestore rejected the composite query.
    // Pull the small employee punch window and sort/filter client-side instead.
    const q = query(
      collection(db, 'timePunches'),
      where('restaurantId', '==', appUser.restaurantId),
      where('scheduleUserId', '==', scheduleUserId),
      firestoreLimit(25)
    );
    const unsub = onSnapshot(q, snap => {
      const newest = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(punch => ['clocked_in', 'on_break'].includes(String(punch.status || '').toLowerCase()))
        .sort((a, b) => String(b.clockInTime || '').localeCompare(String(a.clockInTime || '')))[0] || null;

      setActivePunch(prev => {
        if (newest?.id) {
          const suppressUntil = recentlyClockedOutRef.current[newest.id] || 0;
          if (Date.now() < suppressUntil) return null;
          return newest;
        }

        // Do not let an empty/stale snapshot erase the optimistic button flip
        // immediately after a successful clock-in write.
        if (prev?._optimisticUntil && Date.now() < prev._optimisticUntil) return prev;
        return null;
      });
    }, err => {
      console.warn('Active punch listener fell back safely:', err?.message || err);
      addToast('Clock Sync Warning', 'Clock-in status could not sync yet. Your schedule is still available. Try again in a minute or tell a manager.');
    });
    return () => unsub();
  }, [subTab, appUser?.id, appUser?.restaurantId, appUser?.scheduleUserId, appUser?.employeeId, appUser?.userId, appUser?.rosterUserId]);



// --- GEOFENCE MATH ENGINE ---
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c) * 3.28084; // Convert final result to feet
  };


  const getClockOutGeofenceReview = async () => {
    const settings = mergeWorkspaceSettings(appUser, clientData);
    if (!settings.geofence) return { status: 'not_required', update: {}, alertNeeded: false };
    const targetLat = parseFloat(settings.lat);
    const targetLon = parseFloat(settings.lon);
    const allowedRadius = parseInt(settings.geofenceRadius, 10) || 300;
    if (!targetLat || !targetLon || !navigator.geolocation) {
      return {
        status: 'unverified',
        alertNeeded: true,
        update: {
          clockOutGeofenceStatus: 'unverified',
          requiresManagerReview: true,
          managerNote: 'Clock-out location could not be verified. Manager review needed.',
          clockOutLocationCheckedAt: new Date().toISOString()
        },
        message: 'Your clock-out will be saved, but location could not be verified. A manager will be alerted.'
      };
    }
    try {
      const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }));
      const dist = calculateDistance(targetLat, targetLon, pos.coords.latitude, pos.coords.longitude);
      const outside = dist > allowedRadius;
      return {
        status: outside ? 'outside' : 'inside',
        alertNeeded: outside,
        distanceFeet: dist,
        update: {
          clockOutGeofenceStatus: outside ? 'outside' : 'inside',
          clockOutDistanceFeet: Math.round(dist),
          clockOutRequiredRadiusFeet: allowedRadius,
          clockOutLocation: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || null,
            capturedAt: new Date().toISOString()
          },
          requiresManagerReview: outside,
          managerNote: outside ? `Clocked out outside required area (${Math.round(dist)} ft from required area). Manager review needed.` : null,
          clockOutLocationCheckedAt: new Date().toISOString()
        },
        message: outside ? `You are clocking out ${Math.round(dist)} feet outside the required work area. Your clock-out will still save, but a manager will be alerted and the time punch will be marked.` : ''
      };
    } catch (err) {
      return {
        status: 'unverified',
        alertNeeded: true,
        update: {
          clockOutGeofenceStatus: 'unverified',
          requiresManagerReview: true,
          managerNote: 'Clock-out location was denied or unavailable. Manager review needed.',
          clockOutLocationError: err?.message || 'Location unavailable',
          clockOutLocationCheckedAt: new Date().toISOString()
        },
        message: 'Your clock-out will be saved, but location was denied or unavailable. A manager will be alerted.'
      };
    }
  };

const handleClockIn = async () => {
    if (clockActionBusy || activePunch) return;
    // Check if scheduled today
    const isScheduledToday = shifts.some(s => shiftMatchesPerson(s, appUser, users) && s.date === getToday() && s.isPublished);
    
    let isUnscheduled = false;
    if (!isScheduledToday) {
       const confirmUnscheduled = window.confirm("You are not scheduled for a shift today. Do you want to proceed with an unscheduled clock-in?");
       if (!confirmUnscheduled) return;
       isUnscheduled = true;
    }

    const executePunch = async () => {
      setClockActionType('in');
      setClockActionBusy(true);
      try {
        const clockInStamp = new Date().toISOString();
        const clockAuthUid = auth?.currentUser?.uid || appUser.authUid || appUser.uid || appUser.id || '';
        const punchData = {
          employeeId: appUser.employeeId || appUser.rosterUserId || appUser.id,
          scheduleUserId: appUser.scheduleUserId || appUser.employeeId || appUser.rosterUserId || appUser.userId || clockAuthUid,
          userId: clockAuthUid,
          rosterUserId: appUser.rosterUserId || appUser.employeeId || '',
          authUid: clockAuthUid,
          createdBy: clockAuthUid,
          employeeName: appUser.name,
          clockInTime: clockInStamp,
          status: 'clocked_in',
          restaurantId: appUser.restaurantId,
          date: getToday(),
          breakMinutes: 0,
          isUnscheduled: isUnscheduled,
          isApproved: !isUnscheduled
        };
        const punchRef = await addDoc(collection(db, "timePunches"), punchData);
        setActivePunch({ id: punchRef.id, ...punchData, _optimisticUntil: Date.now() + 30000 });
        
        // Blast the manager alert to the Message Board
        if (isUnscheduled) {
           await addDoc(collection(db, "events"), { 
             date: new Date().toISOString(), title: `UNSCHEDULED PUNCH: ${appUser.name.split(' ')[0]} clocked in without a scheduled shift. Please review in Timesheets.`, 
             type: 'note', author: 'System Alert', isImportant: true, restaurantId: appUser.restaurantId, replies: [] 
           });
        }
        
        addToast('Clocked In', isUnscheduled ? 'Unscheduled shift started. Manager notified.' : 'Shift started successfully.');
      } catch (e) { 
        setActivePunch(null);
        addToast('Error', e.message); 
      } finally {
        setClockActionBusy(false);
        setClockActionType(null);
        setClockActionPunch(null);
      }
    };

    const workspaceSettings = mergeWorkspaceSettings(appUser, clientData);
    if (workspaceSettings.geofence) {
      if (!navigator.geolocation) return addToast('Error', 'Your device does not support location tracking.');
      
      const targetLat = parseFloat(workspaceSettings.lat);
      const targetLon = parseFloat(workspaceSettings.lon);
      const allowedRadius = parseInt(workspaceSettings.geofenceRadius) || 300; // Default to 300 feet
      
      if (!targetLat || !targetLon) return addToast('Geofence Error', 'Location coordinates are not set in Workspace settings yet.');
      
      addToast('Locating...', 'Verifying GPS coordinates. Hold still.');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = calculateDistance(targetLat, targetLon, pos.coords.latitude, pos.coords.longitude);
          if (dist <= allowedRadius) executePunch();
          else addToast('Access Denied', `Too far away. Move closer to the restaurant. (${Math.round(dist)} feet away)`);
        },
        (err) => addToast('Location Error', err.code === 1 ? 'Location access denied. Please allow location access in your browser to clock in.' : 'Could not lock GPS. Step outside the walk-in and try again.'),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      executePunch();
    }
  };

  const handleStartBreak = async () => {
    if (!activePunch?.id) return;
    const breakStartTime = new Date().toISOString();
    await updateDoc(doc(db, "timePunches", activePunch.id), { breakStartTime, status: 'on_break' });
    setActivePunch(prev => prev ? { ...prev, breakStartTime, status: 'on_break' } : prev);
    addToast('Break Started', 'Enjoy your break.');
  };

  const handleEndBreak = async () => {
    if (!activePunch?.id) return;
    const breakStart = new Date(activePunch.breakStartTime);
    const now = new Date();
    const mins = Number.isNaN(breakStart.getTime()) ? 0 : (now - breakStart) / 60000;
    const currentBreaks = activePunch.breakMinutes || 0;
    const breakMinutes = currentBreaks + mins;
    await updateDoc(doc(db, "timePunches", activePunch.id), { breakStartTime: null, breakMinutes, status: 'clocked_in' });
    setActivePunch(prev => prev ? { ...prev, breakStartTime: null, breakMinutes, status: 'clocked_in' } : prev);
    addToast('Break Ended', 'Welcome back to work.');
  };

  const initiateClockOut = () => {
    if (clockActionBusy) return;
    if (isTipDeclarationEnabled(appUser, clientData)) { setIsTipModalOpen(true); } 
    else { finalizeClockOut(); }
  };

  const finalizeClockOut = async (e) => {
    if(e) e.preventDefault();
    if (!activePunch || clockActionBusy) return;
    const punchToClose = activePunch;
    try {
      let finalBreakMins = punchToClose.breakMinutes || 0;
      if (punchToClose.status === 'on_break') {
         const breakStart = new Date(punchToClose.breakStartTime);
         finalBreakMins += (new Date() - breakStart) / 60000;
      }
      
      const geofenceReview = await getClockOutGeofenceReview();
      if (geofenceReview.alertNeeded && geofenceReview.message) {
        const proceed = window.confirm(`${geofenceReview.message}

Clock out anyway?`);
        if (!proceed) return;
      }
      const clockOutStamp = new Date().toISOString();
      const cashTipsDeclared = normalizeTipAmount(tipCash);
      const creditTipsDeclared = normalizeTipAmount(tipCredit);
      const tipRequired = isTipDeclarationEnabled(appUser, clientData);
      const punchUpdate = { 
        clockOutTime: clockOutStamp, 
        status: 'clocked_out',
        cashTips: cashTipsDeclared,
        creditTips: creditTipsDeclared,
        totalDeclaredTips: cashTipsDeclared + creditTipsDeclared,
        tipDeclarationRequired: tipRequired,
        tipDeclarationCompleted: tipRequired,
        tipDeclaredAt: tipRequired ? clockOutStamp : null,
        tipDeclarationVersion: '14.0.2',
        breakMinutes: finalBreakMins,
        breakStartTime: null,
        ...(geofenceReview.update || {})
      };
      setClockActionType('out');
      setClockActionPunch(punchToClose);
      setClockActionBusy(true);
      recentlyClockedOutRef.current[punchToClose.id] = Date.now() + 30000;
      await updateDoc(doc(db, "timePunches", punchToClose.id), punchUpdate);
      setActivePunch(null);
      if (geofenceReview.alertNeeded) {
        const distText = geofenceReview.distanceFeet ? `${Math.round(geofenceReview.distanceFeet)} ft outside required area` : 'location not verified';
        const alertTitle = `GEOFENCE CLOCK-OUT REVIEW: ${appUser.name} clocked out with ${distText}. Review Financials → Timesheets.`;
        await addDoc(collection(db, "events"), {
          date: clockOutStamp,
          title: alertTitle,
          type: 'note',
          category: 'Geofence Clock-Out Alert',
          author: 'System Alert',
          isImportant: true,
          restaurantId: appUser.restaurantId,
          employeeId: appUser.employeeId || appUser.id,
          scheduleUserId: appUser.scheduleUserId || appUser.employeeId || appUser.userId || appUser.rosterUserId || appUser.id,
          userId: appUser.id,
          rosterUserId: appUser.rosterUserId || '',
          authUid: appUser.uid || appUser.authUid || appUser.id,
          employeeName: appUser.name,
          punchId: punchToClose.id,
          replies: [],
          geofenceStatus: geofenceReview.status || 'review'
        });
        try {
          await secureFetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurantId: appUser.restaurantId, type: 'geofence', title: 'Geofence Clock-Out Alert', body: alertTitle, isCritical: true })
          });
        } catch (pushErr) { console.warn('Geofence push failed:', pushErr); }
      }
      
      setIsTipModalOpen(false);
      setTipCash(''); setTipCredit('');
      addToast('Clocked Out', 'Shift ended. Great work today!');
    } catch (err) {
      if (punchToClose?.id) delete recentlyClockedOutRef.current[punchToClose.id];
      setActivePunch(punchToClose || null);
      addToast('Error', err.message); 
    } finally {
      setClockActionBusy(false);
      setClockActionType(null);
      setClockActionPunch(null);
    }
  };

// --- TRADE BOARD LOGIC ---
  const availableSwaps = shiftSwaps
    .filter(s => ['available','open'].includes(String(s.status || '').toLowerCase()) && String(s.shiftDate || s.date || '') >= getToday())
    .sort((a,b) => String(a.shiftDate || a.date || '').localeCompare(String(b.shiftDate || b.date || '')));

  const handleCancelSwap = async (swapId) => {
    if (!window.confirm("Remove this shift from the Trade Board?")) return;
    await deleteDoc(doc(db, "shiftSwaps", swapId));
    addToast('Revoked', 'Shift removed from Trade Board.');
  };

  const handleClaimShift = async (swap) => {
    if (!swap?.shiftId) return addToast('Error', 'This trade-board listing is missing its linked shift ID.');
    if (!window.confirm(`Claim this ${swap.role} shift on ${formatDisplayDate(swap.shiftDate || swap.date)}?`)) return;

    try {
      const claimantAuthUid = auth?.currentUser?.uid || appUser.authUid || appUser.uid || appUser.id || '';
      const claimantIdentity = buildScheduleIdentityFields(schedulePerson, appUser);
      await updateDoc(doc(db, "shifts", swap.shiftId), {
        ...claimantIdentity,
        userId: claimantAuthUid,
        authUid: claimantAuthUid,
        assignedUserId: claimantAuthUid,
        employeeName: claimantIdentity.employeeName || appUser.name || appUser.email || '',
        employeeEmail: claimantIdentity.employeeEmail || appUser.email || '',
        assignedEmail: claimantIdentity.assignedEmail || appUser.email || '',
        role: swap.role,
        updatedAt: new Date().toISOString(),
        claimedFromTradeBoard: true
      });

      await updateDoc(doc(db, "shiftSwaps", swap.id), {
        status: 'claimed',
        claimedBy: claimantAuthUid,
        claimedByName: appUser.name,
        claimedAt: new Date().toISOString()
      });

      addToast('Shift Claimed', 'The shift has been added to your schedule.');
      setSubTab('my-schedule');
    } catch (e) {
      addToast('Error', e.message || 'Could not claim shift.');
    }
  };

const handleOfferSwap = async (shift) => {
    if (!window.confirm(`Offer your ${shift.role} shift on ${formatDisplayDate(shift.date)} to the Trade Board?`)) return;
    
    try {
      // 1. Add the swap to the database
      await addDoc(collection(db, "shiftSwaps"), {
        shiftId: shift.id,
        originalEmployeeId: schedulePerson.employeeId || schedulePerson.id || appUser.id,
        sourceEmployeeId: schedulePerson.employeeId || schedulePerson.id || appUser.id,
        requesterUserId: appUser.id,
        originalUserId: appUser.id,
        originalEmployeeName: schedulePerson.employeeName || schedulePerson.name || appUser.name || appUser.email || '',
        originalEmployeeEmail: schedulePerson.employeeEmail || schedulePerson.email || appUser.email || '',
        role: shift.role,
        date: shift.date,
        shiftDate: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: 'available',
        restaurantId: appUser.restaurantId,
        listedAt: new Date().toISOString()
      });
      
      addToast('Listed', 'Shift is now on the Trade Board.');
      setSubTab('trade-board');

      // 2. Trigger the Universal Push Cannon
      try {
        await secureFetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            restaurantId: appUser.restaurantId,
            type: 'trade', // This tells the cannon to respect the notifTrades toggle
            title: '🔄 Shift up for grabs!',
            body: `${appUser.name.split(' ')[0]} just posted a ${shift.role} shift on ${formatDisplayDate(shift.date)}.`,
            textContent: '', // Not a message, so no keyword scanning needed
            isCritical: false
          })
        });
      } catch (err) {
        console.error("Failed to trigger push:", err);
      }

    } catch (e) {
      addToast('Error', e.message);
    }
  };

  const masterMonthBounds = getScheduleMonthBoundsForKey(monthStr);
  const scheduleRosterPerson = getSchedulePersonForAppUser(appUser, users);
  const isMyMasterPublishedShift = (shift = {}) => {
    if (isDeletedScheduleShift(shift) || !isScheduleShiftPublished(shift)) return false;
    return shiftMatchesPerson(shift, schedulePerson, users) || shiftMatchesPerson(shift, scheduleRosterPerson, users);
  };
  const isMyMasterUpcomingShift = (shift = {}) => isMyMasterPublishedShift(shift) && isShiftStillCurrentOrUpcoming(shift, scheduleNow);
  const myMonthShifts = dedupeScheduleShiftsByDatePersonTime((shifts || [])
    .filter(shift => {
      const d = getShiftDateKey(shift);
      return isMyMasterPublishedShift(shift) && d >= masterMonthBounds.start && d <= masterMonthBounds.end;
    }))
    .sort(compareShiftsByStartDateTime);
  const myNextShift = (shifts || [])
    .filter(isMyMasterUpcomingShift)
    .sort(compareShiftsByStartDateTime)[0] || null;
  const activeMonthShifts = dedupePublishedScheduleShiftsForDisplay((shifts || [])
    .filter(s => !isDeletedScheduleShift(s) && getShiftDateKey(s).startsWith(monthStr) && isScheduleShiftPublished(s)), users)
    .sort((a,b) => getShiftDateKey(a) === getShiftDateKey(b) ? (a.startTime || '').localeCompare(b.startTime || '') : getShiftDateKey(a).localeCompare(getShiftDateKey(b)));

  const effectiveActivePunch = clockActionBusy && clockActionType === 'out' ? (clockActionPunch || activePunch) : (activePunch && !(clockActionBusy && clockActionType === 'in') ? activePunch : null);

  return (
    <div className="schedule-desktop max-w-7xl mx-auto space-y-4 pb-24">
      
      <Modal isOpen={isTipModalOpen} onClose={() => setIsTipModalOpen(false)} title="Declare Tips">
        <form onSubmit={finalizeClockOut} className="space-y-4">
          <p className="text-xs text-slate-300 font-bold mb-2">Please declare your tips for this shift before clocking out. Enter 0 if you did not receive tips.</p>
          <div>
            <label className={T.label}>Cash Tips ($)</label>
            <input type="number" step="0.01" min="0" value={tipCash} onChange={e=>setTipCash(e.target.value)} className={T.input} placeholder="0.00"/>
          </div>
          <div>
            <label className={T.label}>Credit Card Tips ($)</label>
            <input type="number" step="0.01" min="0" value={tipCredit} onChange={e=>setTipCredit(e.target.value)} className={T.input} placeholder="0.00"/>
          </div>
          <button type="submit" disabled={clockActionBusy} className={`clock-action-button no-compact w-full ${T.btn} disabled:opacity-60 disabled:cursor-not-allowed`}>{clockActionBusy ? 'Finalizing...' : 'Finalize Clock Out'}</button>
        </form>
      </Modal>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 border-b border-[#2A353D] mb-4 pb-2">
        {['my-schedule', 'full-schedule', 'month-view', 'time-off', 'availability', ...((appUser?.isAdmin || appUser?.permissions?.schedule) && scheduleBuilderProps ? ['schedule-builder'] : [])].map((tab) => (
          <button key={tab} onClick={() => setSubTab(tab)} className={`px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all sm:flex-1 ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>
            {tab === 'time-off' ? 'Request Off' : tab === 'availability' ? 'Availability' : tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {subTab === 'schedule-builder' && scheduleBuilderProps && (
        <div className="animate-[slideIn_0.2s_ease-out]">
          <TabScheduleWorkbench {...scheduleBuilderProps} availabilityRecords={availabilityRecords} />
        </div>
      )}

      {subTab === 'my-schedule' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          {events.filter(e => e.type === 'note' && e.isImportant).slice(0,1).map(alert => (
            <div key={alert.id} className="bg-gradient-to-r from-[#7A4F31]/30 to-[#1A2126] border border-[#B88764]/40 p-3 rounded-xl flex gap-3 shadow-lg">
              <Bell size={24} className="text-red-500 flex-shrink-0" />
              <div>
                <span className="text-[9px] font-black uppercase text-[#D4A381] tracking-widest block">System Alert</span>
                <p className="text-xs text-slate-200 font-medium leading-snug">{alert.title}</p>
              </div>
            </div>
          ))}
          <div className={`${T.grad} rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-[#D4A381]/30`}>
            <div className="absolute -top-4 -right-4 text-8xl font-black text-slate-900/10">86</div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900/60 mb-1">My Schedule</h3>
            {myNextShift ? (
              <div className="mb-6"><div className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">Next: {myNextShift.role}</div><div className="text-sm font-bold text-slate-900/80 flex items-center gap-1.5">{formatDisplayDate(getShiftDateKey(myNextShift))}   {formatShortTime(myNextShift.startTime)} - {formatShortTime(myNextShift.endTime)} {myNextShift.endTime === 'CLOSE' && <span className="bg-slate-900 text-[#D4A381] text-[9px] px-1.5 py-0.5 rounded ml-1 uppercase tracking-wider">Close</span>}</div></div>
            ) : (<div className="mb-6 text-slate-900 font-bold">No upcoming shifts scheduled.</div>)}
            
            {effectiveActivePunch ? (
              <div className="space-y-2 relative z-10">
                <button onClick={initiateClockOut} disabled={clockActionBusy} className="clock-action-button no-compact w-full py-4 bg-red-900/80 text-red-100 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:bg-red-800 border border-red-500/50 transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed">
                  <span>{clockActionBusy && clockActionType === 'out' ? 'CLOCKING OUT...' : 'CLOCK OUT'}</span>
                  <span className="clock-action-meta text-[10px] text-red-300 font-medium normal-case tracking-normal">Clocked in at {formatClockTime(effectiveActivePunch.clockInTime)}</span>
                </button>
                {mergeWorkspaceSettings(appUser, clientData).breaks && (
                  effectiveActivePunch.status === 'on_break' ? (
                    <button onClick={handleEndBreak} className="clock-action-button no-compact w-full py-3 bg-blue-900/80 text-blue-100 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-800 border border-blue-500/50 transition-all">END BREAK</button>
                  ) : (
                    <button onClick={handleStartBreak} className="clock-action-button no-compact w-full py-3 bg-slate-800/50 text-slate-900 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 hover:text-white border border-slate-700 transition-all">START UNPAID BREAK</button>
                  )
                )}
              </div>
            ) : (
              <button onClick={handleClockIn} disabled={clockActionBusy} className="clock-action-button no-compact w-full py-4 bg-emerald-600/20 text-emerald-400 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:bg-emerald-600/30 border border-emerald-500/50 transition-all relative z-10 disabled:opacity-60 disabled:cursor-not-allowed">
                {clockActionBusy && clockActionType === 'in' ? 'CLOCKING IN...' : 'CLOCK IN'}
              </button>
            )}

          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setSubTab('trade-board')} className={`${T.card} p-4 flex flex-col items-center justify-center gap-2 hover:bg-[#2A353D] transition-colors relative`}>
              <Repeat size={24} className={T.copper}/>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Trade Board</span>
              {availableSwaps.length > 0 && <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg">{availableSwaps.length}</span>}
            </button>
            <button onClick={() => setSubTab('time-off')} className={`${T.card} p-4 flex flex-col items-center justify-center gap-2 hover:bg-[#2A353D] transition-colors`}>
              <Calendar size={24} className={T.copper}/>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Request Off</span>
            </button>
          </div>

          <div className={`${T.card} overflow-hidden mt-4`}>
            <div className={T.th}>My Published Schedule</div>
            <div className={`divide-y ${T.border}`}>
              {myMonthShifts.length === 0 ? (
                <div className={`p-4 text-center text-xs font-bold ${T.muted}`}>No published shifts found for this month.</div>
              ) : (
                myMonthShifts.map(s => {
                  const isPastShift = isShiftInPast(s, scheduleNow);
                  const isOffered = shiftSwaps.some(swap => swap.shiftId === s.id && swap.status === 'available');

                  return (
                    <div key={s.id} className={`${T.row} flex justify-between items-center transition-colors ${isPastShift ? 'bg-[#0B0E11]/70 opacity-50 grayscale' : ''}`}>
                      <div>
                        <div className={`font-bold text-sm ${isPastShift ? 'text-slate-500' : 'text-white'}`}>{formatDisplayDate(getShiftDateKey(s))}</div>
                        <div className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isPastShift ? 'text-slate-600' : T.copper}`}>{s.role}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-xs font-mono font-bold px-2 py-1 rounded-md border ${isPastShift ? 'bg-[#0B0E11] text-slate-500 border-[#1F2933]' : `bg-[#12161A] ${T.copper} ${T.border}`}`}>
                          {formatShortTime(s.startTime)} - {formatShortTime(s.endTime)}
                        </div>
                        {isPastShift ? (
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 border border-[#1F2933] px-2 py-1 rounded">Ended</span>
                        ) : (
                          isOffered ? (
                            <span className="text-[8px] font-black uppercase tracking-widest text-orange-400 bg-orange-900/20 border border-orange-900/50 px-2 py-1 rounded">Listed</span>
                          ) : (
                            <button onClick={() => handleOfferSwap(s)} className="text-[8px] font-black uppercase tracking-widest bg-[#1A2126] text-slate-300 border border-[#2A353D] hover:text-[#D4A381] hover:border-[#D4A381]/50 px-2 py-1 rounded transition-colors shadow-sm">
                              Swap
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* THE TRADE BOARD */}
      {subTab === 'trade-board' && (
        <div className="animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}><Repeat size={18} /> Trade Board</h3>
              <button onClick={() => setSubTab('my-schedule')} className="text-xs font-bold text-slate-400 hover:text-white border border-[#2A353D] px-3 py-1.5 rounded-lg">Back to Dashboard</button>
            </div>
            
            <div className={`divide-y ${T.border}`}>
              {availableSwaps.length === 0 ? (
                <div className={`p-8 text-center text-sm font-bold ${T.muted}`}>No shifts currently available.</div>
              ) : (
                availableSwaps.map(swap => {
                  const isMine = shiftMatchesPerson({ employeeId: swap.originalEmployeeId, userId: swap.originalUserId, employeeName: swap.originalEmployeeName, employeeEmail: swap.originalEmployeeEmail }, schedulePerson, users) || swap.originalEmployeeId === appUser.id;
                  const originalEmp = users.find(u => u.id === swap.originalEmployeeId || normalizeScheduleIdentity(u.email) === normalizeScheduleIdentity(swap.originalEmployeeEmail));
                  
                  return (
                    <div key={swap.id} className={`${T.row} p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4`}>
                      <div>
                        <div className="font-bold text-white text-base">{formatDisplayDate(swap.shiftDate || swap.date)}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mt-0.5">
                          {swap.role}   {formatShortTime(swap.startTime)} - {formatShortTime(swap.endTime)}
                        </div>
                        <div className="text-xs text-slate-400 font-medium mt-1">Listed by {originalEmp?.name || 'Unknown Staff'}</div>
                      </div>
                      <div className="flex-shrink-0">
                        {isMine ? (
                          <button onClick={() => handleCancelSwap(swap.id)} className="w-full sm:w-auto px-4 py-2 bg-red-900/20 text-red-500 text-xs font-black uppercase tracking-widest rounded-lg border border-red-900/50 hover:bg-red-900/40 transition-colors">Revoke Listing</button>
                        ) : (
                          <button onClick={() => handleClaimShift(swap)} className="w-full sm:w-auto px-4 py-2 bg-emerald-900/20 text-emerald-400 text-xs font-black uppercase tracking-widest rounded-lg border border-emerald-900/50 hover:bg-emerald-900/40 transition-colors shadow-[0_0_10px_rgba(16,185,129,0.1)]">Claim Shift</button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

{subTab === 'full-schedule' && (() => {
        const filteredRosterShifts = activeMonthShifts.filter(s => rosterFilterDate ? s.date === rosterFilterDate : true);
        const rosterShiftsByDate = filteredRosterShifts.reduce((acc, shift) => {
          const key = shift?.date || '';
          if (!key) return acc;
          if (!acc[key]) acc[key] = [];
          acc[key].push(shift);
          return acc;
        }, {});
        const pickerMonth = fullSchedulePickerMonth || monthStr;
        const pickerDays = Array.from({ length: getDaysInMonth(pickerMonth) }).map((_, i) => `${pickerMonth}-${String(i + 1).padStart(2, '0')}`);
        const pickerFirstDayOffset = new Date(pickerMonth + '-01T12:00:00').getDay();
        const publishedShiftDays = new Set(shifts.filter(s => isScheduleShiftPublished(s) && String(s.date || s.scheduleDateKey || '').startsWith(pickerMonth)).map(s => getShiftDateKey(s))); 
        return (
          <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
            <div className="bg-[#12161A] p-3 border-b border-[#2A353D] flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <button type="button" onClick={() => setIsFullSchedulePickerOpen(prev => !prev)} className="flex items-center gap-2 text-left rounded-xl border border-[#2A353D] bg-[#0B0E11] px-3 py-2 hover:border-[#D4A381]/60 transition-colors">
                  <Calendar size={16} className={T.copper}/>
                  <div>
                    <h3 className={`text-xs font-black uppercase tracking-widest ${T.copper}`}>Active Roster</h3>
                    <span className="text-[10px] text-slate-300 font-black uppercase tracking-wider">{rosterFilterDate ? formatDisplayDate(rosterFilterDate) : formatDisplayMonth(monthStr)}</span>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  {rosterFilterDate && <button type="button" onClick={() => setRosterFilterDate('')} className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white border border-[#2A353D] rounded-xl px-3 py-2">Show Full Month</button>}
                  <button type="button" onClick={() => setIsFullSchedulePickerOpen(prev => !prev)} className={T.btnAlt}>Jump to Date</button>
                </div>
              </div>
              {isFullSchedulePickerOpen && (
                <div className="rounded-2xl border border-[#2A353D] bg-[#0B0E11] overflow-hidden shadow-2xl max-w-full sm:max-w-md">
                  <div className="bg-[#12161A] p-3 border-b border-[#2A353D] flex justify-between items-center">
                    <button type="button" onClick={() => changeFullSchedulePickerMonth(-1)} className={T.btnAlt}><ChevronLeft size={16}/></button>
                    <div className="font-black text-sm text-white tracking-tight text-center">{formatDisplayMonth(pickerMonth)}</div>
                    <button type="button" onClick={() => changeFullSchedulePickerMonth(1)} className={T.btnAlt}><ChevronRight size={16}/></button>
                  </div>
                  <div className="grid grid-cols-7 border-t border-[#2A353D]">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <div key={day} className={`py-1.5 text-center text-[9px] font-black ${T.copper} uppercase border-b border-[#2A353D] bg-[#12161A]`}>{day}</div>)}
                    {Array.from({ length: pickerFirstDayOffset }).map((_, i) => <div key={`full-empty-${i}`} className="min-h-[42px] border-b border-r border-[#2A353D] bg-[#1A2126]/60" />)}
                    {pickerDays.map(day => {
                      const hasShifts = publishedShiftDays.has(day);
                      const selected = day === rosterFilterDate;
                      const today = day === getToday();
                      return (
                        <button type="button" key={day} onClick={() => selectFullSchedulePickerDate(day)} className={`min-h-[48px] p-1 border-b border-r border-[#2A353D] flex flex-col items-center justify-center transition-colors ${selected ? 'bg-[#8F6040]/25 ring-1 ring-[#D4A381] text-[#D4A381]' : 'bg-[#10161B] hover:bg-[#1A2126] text-slate-300'}`}>
                          <span className={`text-xs font-black ${today ? T.copper : ''}`}>{Number(day.slice(-2))}</span>
                          {hasShifts && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#D4A381]" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="p-2 text-[10px] font-bold text-slate-500">Tap a day to jump straight to that date. Dots show published shifts.</div>
                </div>
              )}
            </div>
            <div className="divide-y divide-[#2A353D] max-h-[60vh] overflow-y-auto custom-scrollbar" tabIndex={0} role="region" aria-label="Full schedule shift list">
              {filteredRosterShifts.map((shift, index) => {
                 const emp = resolveScheduleShiftPersonForDisplay(shift, users);
                 const empName = getScheduleShiftDisplayName(shift, users);
                 const showDivider = index === 0 || shift.date !== filteredRosterShifts[index - 1].date;
                 const isPastShift = isShiftInPast(shift, scheduleNow);
                 const isPastDay = showDivider && isScheduleDateComplete(shift.date, rosterShiftsByDate[shift.date] || [], scheduleNow);
                 
                 return (
                   <React.Fragment key={shift.id}>
                     {showDivider && (
                       <div className={`${isPastDay ? 'bg-[#0B0E11] text-slate-600 opacity-80' : 'bg-[#1A2126] text-[#D4A381]'} px-3 py-2 border-y border-[#2A353D] text-[10px] font-black uppercase tracking-widest sticky top-0 z-10 shadow-sm flex flex-wrap items-center gap-2 transition-colors`}>
                         <span>{formatDisplayDate(shift.date)}</span>
                         {getHoliday(shift.date) && <span className="bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">{getHoliday(shift.date)}</span>}
                         {isPastDay && <span className="text-[8px] text-slate-600 border border-[#1F2933] px-1.5 py-0.5 rounded">PAST</span>}
                       </div>
                     )}
                     <div className={`${T.row} transition-colors ${isPastShift ? 'bg-[#0B0E11]/70 opacity-50 grayscale' : 'hover:bg-[#12161A]'}`}>
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3"><img src={getAvatar(empName, emp?.photoURL)} className={`w-8 h-8 rounded-full border object-cover ${isPastShift ? 'border-[#1F2933] opacity-60' : T.border}`} alt="avatar"/><div><div className={`text-sm font-bold ${isPastShift ? 'text-slate-500' : 'text-white'}`}>{empName}</div><div className={`text-[9px] font-bold uppercase ${isPastShift ? 'text-slate-600' : T.muted}`}>{shift.role}</div></div></div>
                         <div className={`text-xs font-mono font-bold px-2 py-1 rounded-md border ${isPastShift ? 'bg-[#0B0E11] text-slate-100 border-[#1F2933]' : `bg-[#12161A] ${T.copper} ${T.border}`}`}>{formatShortTime(shift.startTime)} - {formatShortTime(shift.endTime)}</div>
                       </div>
                     </div>
                   </React.Fragment>
                 )
              })}
              {filteredRosterShifts.length === 0 && <div className={`p-6 text-center text-xs font-bold ${T.muted}`}>No shifts found for this selection.</div>}
            </div>
          </div>
        );
      })()}

      {subTab === 'month-view' && <div className="animate-[slideIn_0.2s_ease-out]"><TabMonth currentDate={currentDate} users={users} shifts={shifts} appUser={appUser} /></div>}
      {subTab === 'time-off' && <div className="animate-[slideIn_0.2s_ease-out]"><TabTimeOff timeOffRequests={timeOffRequests} appUser={appUser} users={users} addToast={addToast} events={events} shifts={shifts} clientData={clientData} /></div>}
      {subTab === 'availability' && <div className="animate-[slideIn_0.2s_ease-out]"><TabAvailability availabilityRecords={availabilityRecords} appUser={appUser} users={users} addToast={addToast} clientData={clientData} /></div>}  
    </div>
  );
};

const TabSchedule = ({ currentDate, users, shifts, events, timeOffRequests, timePunches = [], addToast, appUser, clientData = null, initialSubTab = 'schedule', hideSubTabs = false, availabilityRecords = [] }) => {
  const [subTab, setSubTab] = useState(initialSubTab); 
  const [selectedEmp, setSelectedEmp] = useState(''); 
  const [assignDates, setAssignDates] = useState([]); 
  const [isAssigningShift, setIsAssigningShift] = useState(false); 
  const [presetShift, setPresetShift] = useState('Custom'); 
  const [startTime, setStartTime] = useState('16:00'); 
  const [endTime, setEndTime] = useState('21:00');
  
  const [isEventModalOpen, setIsEventModalOpen] = useState(false); 
const [eventDate, setEventDate] = useState(getToday()); 
  const [eventTime, setEventTime] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventImageFile, setEventImageFile] = useState(null);
  const [isEventUploading, setIsEventUploading] = useState(false);
  
// Repeating Events State
  const [isRepeating, setIsRepeating] = useState(false);
  const [repeatType, setRepeatType] = useState('weekly');
  const [repeatUntil, setRepeatUntil] = useState('');
  const [eventPushReminders, setEventPushReminders] = useState([]);
  const [newEventReminderOffset, setNewEventReminderOffset] = useState('60');
  const [newEventReminderMode, setNewEventReminderMode] = useState('offset');
  const [newEventReminderDate, setNewEventReminderDate] = useState(getToday());
  const [newEventReminderTime, setNewEventReminderTime] = useState('09:00');
  const [orderReminderEnabled, setOrderReminderEnabled] = useState(false);
  const [orderReminderDays, setOrderReminderDays] = useState([]);
  const [eventReminderRecipientMode, setEventReminderRecipientMode] = useState('creator');

  // --- EVENTS CALENDAR STATE ---
  const [eventsCalMonth, setEventsCalMonth] = useState(getMonthStr(currentDate));
  useEffect(() => { setEventsCalMonth(getMonthStr(currentDate)); }, [currentDate]);

  const changeEventsMonth = (offset) => {
    const d = new Date(eventsCalMonth + '-01T12:00:00');
    d.setMonth(d.getMonth() + offset);
    setEventsCalMonth(d.toISOString().substring(0, 7));
  };
  
  const eventsMonthDays = Array.from({length: getDaysInMonth(eventsCalMonth)}).map((_, i) => `${eventsCalMonth}-${String(i+1).padStart(2, '0')}`);
  const eventsFirstDayOffset = new Date(eventsCalMonth+'-01T12:00:00').getDay();
  const eventsCalEvents = events.filter(e => e.type === 'special_event' && e.date?.startsWith(eventsCalMonth));

  // --- AUTO-POPULATE STATE ---
  const [isAutoPopulateModalOpen, setIsAutoPopulateModalOpen] = useState(false);
  const [autoPopSourceMonth, setAutoPopSourceMonth] = useState('');
  const [autoFillVisibleShifts, setAutoFillVisibleShifts] = useState([]);
  const [localBuilderShiftEchoes, setLocalBuilderShiftEchoes] = useState([]);
  const [localBuilderDeletedShiftMarkers, setLocalBuilderDeletedShiftMarkers] = useState(() => readScheduleDeletedShiftMarkersFromStorage(appUser?.restaurantId));
  const [localBuilderPublishedShiftIds, setLocalBuilderPublishedShiftIds] = useState([]);
  const localBuilderDeleteRetryRef = useRef({});
  const [isPublishPickerOpen, setIsPublishPickerOpen] = useState(false);
  const [selectedPublishWeekKeys, setSelectedPublishWeekKeys] = useState([]);
  
  const monthStr = getMonthStr(currentDate); 
  const monthDays = Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => `${monthStr}-${String(i+1).padStart(2, '0')}`);
  const schedulePublishingSettings = getSchedulePublishingSettings(appUser, clientData);
  const schedulePerson = getSchedulePersonForAppUser(appUser, users);
  const scheduleRestaurantId = appUser?.restaurantId || '';

  useEffect(() => {
    if (!scheduleRestaurantId) return;
    const storedMarkers = readScheduleDeletedShiftMarkersFromStorage(scheduleRestaurantId);
    if (storedMarkers.length) {
      setLocalBuilderDeletedShiftMarkers(prev => mergeLocalShiftDeletionMarkers(prev, storedMarkers));
    }
  }, [scheduleRestaurantId]);

  useEffect(() => {
    if (!scheduleRestaurantId) return;
    writeScheduleDeletedShiftMarkersToStorage(scheduleRestaurantId, localBuilderDeletedShiftMarkers);
  }, [scheduleRestaurantId, localBuilderDeletedShiftMarkers]);
  useEffect(() => {
    if (!localBuilderShiftEchoes.length) return;
    const liveIds = new Set((shifts || []).map(shift => shift?.id).filter(Boolean));
    setLocalBuilderShiftEchoes(prev => prev.filter(shift => shift?.id && !liveIds.has(shift.id)));
  }, [shifts, localBuilderShiftEchoes.length]);

  useEffect(() => {
    if (!localBuilderDeletedShiftMarkers.length) return;
    const now = Date.now();
    setLocalBuilderDeletedShiftMarkers(prev => prev.filter(marker => {
      if (!marker?.key || Number(marker.expiresAt || 0) <= now) return false;
      if (String(marker.key).startsWith('id:')) return true;
      const stillVisibleInLiveSnapshot = (shifts || []).some(shift => scheduleShiftHasLocalDeleteKey(shift, marker.key));
      const stillInsideGraceWindow = now - Number(marker.createdAt || now) < SHIFT_LOCAL_DELETE_MARKER_GRACE_MS;
      return stillVisibleInLiveSnapshot || stillInsideGraceWindow;
    }));
  }, [shifts, localBuilderDeletedShiftMarkers.length]);

  useEffect(() => {
    if (!scheduleRestaurantId || !localBuilderDeletedShiftMarkers.length) return;
    const now = Date.now();
    const activeDeletedIds = new Set(localBuilderDeletedShiftMarkers
      .filter(marker => String(marker?.key || '').startsWith('id:') && Number(marker?.expiresAt || 0) > now)
      .map(marker => String(marker.shiftId || String(marker.key || '').replace(/^id:/, '')).trim())
      .filter(Boolean));
    if (!activeDeletedIds.size) return;
    (shifts || []).forEach(shift => {
      const id = String(shift?.id || '').trim();
      if (!id || !activeDeletedIds.has(id)) return;
      const shiftRestaurantId = String(shift?.restaurantId || shift?.workspaceId || scheduleRestaurantId || '');
      if (shiftRestaurantId && shiftRestaurantId !== scheduleRestaurantId) return;
      const lastRetryAt = Number(localBuilderDeleteRetryRef.current[id] || 0);
      if (now - lastRetryAt < SHIFT_SAVED_DELETE_RETRY_MS) return;
      localBuilderDeleteRetryRef.current[id] = now;
      deleteDoc(doc(db, 'shifts', id)).catch(err => {
        console.warn('[86chaos] Could not retry-delete tombstoned schedule shift', id, err?.message || err);
      });
    });
  }, [shifts, scheduleRestaurantId, localBuilderDeletedShiftMarkers]);

  const activeLocalDeleteMarkers = localBuilderDeletedShiftMarkers.filter(marker => Number(marker?.expiresAt || 0) > Date.now());
  const activeLocalDeleteMarkerMap = new Map(activeLocalDeleteMarkers.map(marker => [marker.key, marker]).filter(([key]) => Boolean(key)));
  const activeLocalDeleteKeySet = new Set(activeLocalDeleteMarkers.map(marker => marker.key).filter(Boolean));
  const localBuilderPublishedShiftIdSet = new Set((localBuilderPublishedShiftIds || []).filter(Boolean));
  const isBuilderShiftPublished = (shift = {}) => isScheduleShiftPublished(shift) || localBuilderPublishedShiftIdSet.has(getShiftWritableDocId(shift));
  const visibleSourceShifts = mergeVisibleScheduleShifts(
    (shifts || []).filter(shift => !isDeletedScheduleShift(shift)),
    autoFillVisibleShifts.filter(shift => shift?.restaurantId === appUser?.restaurantId && getShiftDateKey(shift).startsWith(monthStr) && !isDeletedScheduleShift(shift)),
    localBuilderShiftEchoes.filter(shift => shift?.restaurantId === appUser?.restaurantId && getShiftDateKey(shift).startsWith(monthStr) && !isDeletedScheduleShift(shift))
  );
  const visibleShifts = collapseScheduleDisplayShifts(visibleSourceShifts.filter(shift => !isDeletedScheduleShift(shift) && !shiftMatchesLocalDeleteMarkers(shift, activeLocalDeleteKeySet, activeLocalDeleteMarkerMap)), users);
  const schedulePeriodBounds = getSchedulePeriodBounds(currentDate, schedulePublishingSettings);
  const schedulePeriodDays = buildDateRange(schedulePeriodBounds.start, schedulePeriodBounds.end);
  const schedulePeriodLabel = getSchedulePeriodLabel(schedulePeriodBounds, schedulePublishingSettings);
  const publicationWeekBounds = getScheduleOuterWeekBounds(schedulePeriodBounds, schedulePublishingSettings);
  const publicationWeekDays = buildDateRange(publicationWeekBounds.start, publicationWeekBounds.end);
  const schedulePeriodShifts = visibleShifts.filter(s => { const d = getShiftDateKey(s); return d >= schedulePeriodBounds.start && d <= schedulePeriodBounds.end; });
  const scheduleBuilderActiveRosterForPublish = users.filter(u => u?.isActive !== false);
  const getScheduleBuilderRenderedShiftsForDaySet = (daySet = new Set()) => {
    if (!daySet || !daySet.size) return [];
    return mergeSchedulePublishCandidates(...scheduleBuilderActiveRosterForPublish.flatMap(person =>
      Array.from(daySet).map(day => schedulePeriodShifts.filter(s => getShiftDateKey(s) === day && shiftMatchesPerson(s, person, users)))
    ));
  };
  const publicationSourceShifts = collapseScheduleDisplayShifts(mergeSchedulePublishCandidates(
    (shifts || []).filter(shift => !isDeletedScheduleShift(shift)),
    visibleSourceShifts,
    autoFillVisibleShifts.filter(shift => shift?.restaurantId === appUser?.restaurantId && !isDeletedScheduleShift(shift)),
    localBuilderShiftEchoes.filter(shift => shift?.restaurantId === appUser?.restaurantId && !isDeletedScheduleShift(shift))
  ).filter(shift => !isDeletedScheduleShift(shift) && !shiftMatchesLocalDeleteMarkers(shift, activeLocalDeleteKeySet, activeLocalDeleteMarkerMap)), users);
  const publicationPeriodShifts = publicationSourceShifts.filter(s => { const d = getShiftDateKey(s); return d >= publicationWeekBounds.start && d <= publicationWeekBounds.end; });
  const renderedPublicationPeriodShifts = mergeSchedulePublishCandidates(publicationPeriodShifts, getScheduleBuilderRenderedShiftsForDaySet(new Set(publicationWeekDays)))
    .filter(shift => !isDeletedScheduleShift(shift) && !shiftMatchesLocalDeleteMarkers(shift, activeLocalDeleteKeySet, activeLocalDeleteMarkerMap));
  const schedulePeriodEvents = events.filter(e => e.type === 'special_event' && e.date >= schedulePeriodBounds.start && e.date <= schedulePeriodBounds.end).sort((a,b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || '') || (a.title || '').localeCompare(b.title || ''));
  const publishWeekOptions = [];
  for (let index = 0; index < publicationWeekDays.length; index += 7) {
    const days = publicationWeekDays.slice(index, index + 7);
    if (!days.length) continue;
    const daySet = new Set(days);
    const drafts = renderedPublicationPeriodShifts.filter(shift => getShiftWritableDocId(shift) && !isBuilderShiftPublished(shift) && daySet.has(getShiftDateKey(shift)));
    const live = renderedPublicationPeriodShifts.filter(shift => isBuilderShiftPublished(shift) && daySet.has(getShiftDateKey(shift)));
    const touchesVisiblePeriod = days.some(day => day >= schedulePeriodBounds.start && day <= schedulePeriodBounds.end);
    if (!touchesVisiblePeriod) continue;
    publishWeekOptions.push({
      key: `${days[0]}_${days[days.length - 1]}`,
      label: `Week ${publishWeekOptions.length + 1}`,
      start: days[0],
      end: days[days.length - 1],
      days,
      draftCount: drafts.length,
      liveCount: live.length
    });
  }
  const selectedPublishWeekSet = new Set(selectedPublishWeekKeys);
  const selectedPublishWeeks = publishWeekOptions.filter(option => selectedPublishWeekSet.has(option.key));
  const selectedPublishDays = Array.from(new Set(selectedPublishWeeks.flatMap(option => option.days))).sort();
  const selectedPublishDaySet = new Set(selectedPublishDays);
  const selectedPublishDrafts = renderedPublicationPeriodShifts.filter(shift => getShiftWritableDocId(shift) && !isBuilderShiftPublished(shift) && selectedPublishDaySet.has(getShiftDateKey(shift)));
  const fullPublishDrafts = renderedPublicationPeriodShifts.filter(shift => getShiftWritableDocId(shift) && !isBuilderShiftPublished(shift));
  const selectedPublishCandidateCount = renderedPublicationPeriodShifts.filter(shift => getShiftWritableDocId(shift) && selectedPublishDaySet.has(getShiftDateKey(shift))).length;
  const fullPublishCandidateCount = renderedPublicationPeriodShifts.filter(shift => getShiftWritableDocId(shift)).length;
  const publishDateLabel = (start, end) => start === end ? formatDisplayDate(start) : `${formatDisplayDate(start)} to ${formatDisplayDate(end)}`;
  const selectedPublishLabel = selectedPublishWeeks.length
    ? selectedPublishWeeks.map(option => `${option.label}: ${publishDateLabel(option.start, option.end)}`).join(', ')
    : 'No weeks selected';
  const openPublishPicker = () => {
    if (fullPublishCandidateCount === 0) {
      addToast('Notice', 'No schedule shifts found in this publishing window.');
      return;
    }
    const draftWeekKeys = publishWeekOptions.filter(option => option.draftCount > 0).map(option => option.key);
    setSelectedPublishWeekKeys(draftWeekKeys.length ? draftWeekKeys : publishWeekOptions.map(option => option.key));
    setIsPublishPickerOpen(true);
  };
  const togglePublishWeek = (key) => {
    setSelectedPublishWeekKeys(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]);
  };

  const fetchSchedulePublishCandidatesForDaySet = async (daySet = new Set(), localCandidates = []) => {
    const byId = new Map();
    const byIdentity = new Map();
    const addCandidate = (shift = {}) => {
      if (!shift || isDeletedScheduleShift(shift)) return;
      const dateKey = getShiftDateKey(shift);
      if (!dateKey || !daySet.has(dateKey)) return;
      const restaurantId = String(shift.restaurantId || shift.workspaceId || appUser?.restaurantId || '');
      if (appUser?.restaurantId && restaurantId && restaurantId !== String(appUser.restaurantId)) return;
      if (shiftMatchesLocalDeleteMarkers(shift, activeLocalDeleteKeySet, activeLocalDeleteMarkerMap)) return;
      const id = getShiftWritableDocId(shift);
      if (id) {
        byId.set(id, { ...shift, id });
        return;
      }
      const identity = getShiftPublishIdentity(shift);
      if (identity) byIdentity.set(identity, shift);
    };

    (localCandidates || []).forEach(addCandidate);

    if (!appUser?.restaurantId || !daySet?.size) {
      return mergeSchedulePublishCandidates(Array.from(byId.values()), Array.from(byIdentity.values()));
    }

    const days = Array.from(daySet).filter(Boolean).sort();
    for (const day of days) {
      try {
        const dateSnap = await getDocs(query(collection(db, 'shifts'), where('restaurantId', '==', appUser.restaurantId), where('date', '==', day)));
        dateSnap.forEach(docSnap => addCandidate({ id: docSnap.id, ...docSnap.data() }));
      } catch (err) {
        console.warn('[86chaos] Publish date lookup failed; using loaded schedule candidates for date', day, err?.message || err);
      }
      try {
        const scheduleDateSnap = await getDocs(query(collection(db, 'shifts'), where('restaurantId', '==', appUser.restaurantId), where('scheduleDateKey', '==', day)));
        scheduleDateSnap.forEach(docSnap => addCandidate({ id: docSnap.id, ...docSnap.data() }));
      } catch (err) {
        console.warn('[86chaos] Publish scheduleDateKey lookup failed; using loaded schedule candidates for date', day, err?.message || err);
      }
      try {
        const workspaceDateSnap = await getDocs(query(collection(db, 'shifts'), where('workspaceId', '==', appUser.restaurantId), where('date', '==', day)));
        workspaceDateSnap.forEach(docSnap => addCandidate({ id: docSnap.id, ...docSnap.data() }));
      } catch (err) {
        console.warn('[86chaos] Publish workspace/date lookup failed; using loaded schedule candidates for date', day, err?.message || err);
      }
      try {
        const workspaceScheduleDateSnap = await getDocs(query(collection(db, 'shifts'), where('workspaceId', '==', appUser.restaurantId), where('scheduleDateKey', '==', day)));
        workspaceScheduleDateSnap.forEach(docSnap => addCandidate({ id: docSnap.id, ...docSnap.data() }));
      } catch (err) {
        console.warn('[86chaos] Publish workspace/scheduleDateKey lookup failed; using loaded schedule candidates for date', day, err?.message || err);
      }
    }

    return mergeSchedulePublishCandidates(Array.from(byId.values()), Array.from(byIdentity.values()));
  };
  const eventsByScheduleDay = schedulePeriodDays.reduce((acc, d) => {
    acc[d] = schedulePeriodEvents.filter(e => e.date === d);
    return acc;
  }, {});
  const formatScheduleBuilderEventLabel = (event = {}) => {
    const title = String(event.title || event.eventName || event.name || event.label || event.summary || 'Event').trim() || 'Event';
    return `${event.time ? `${formatShortTime(event.time) || event.time} ` : ''}${title}`;
  };
  const formatScheduleBuilderRequestTime = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const formatted = formatShortTime(raw);
    return formatted && !/invalid/i.test(formatted) ? formatted : raw;
  };
  const formatScheduleBuilderRequestRange = (request = {}) => {
    const start = formatScheduleBuilderRequestTime(request.startTime);
    const end = formatScheduleBuilderRequestTime(request.endTime);
    if (start && end) return `${start}-${end}`;
    if (start || end) return start || end;
    return 'Partial day time missing';
  };
  const formatScheduleBuilderEventTitle = (event = {}) => {
    const parts = [
      event.title || event.eventName || event.name || event.label || event.summary || 'Event',
      event.date ? formatDisplayDate(event.date) : '',
      event.time ? formatShortTime(event.time) : '',
      event.notes ? `Notes: ${event.notes}` : '',
      event.orderReminder?.enabled ? `Order reminder: ${(event.orderReminder.cutoffDays || []).join(', ') || 'enabled'}` : ''
    ];
    return parts.filter(Boolean).join(' • ');
  };
  const monthShifts = visibleShifts.filter(s => String(s.date || '').startsWith(monthStr));
  const monthEvents = events.filter(e => e.type === 'special_event' && e.date.startsWith(monthStr)).sort((a,b) => (a.date || '').localeCompare(b.date || ''));

  // --- CUSTOM DROPDOWN TIME GENERATOR ---
  const TIME_OPTIONS = [];
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 60; j += 15) {
      TIME_OPTIONS.push(`${String(i).padStart(2, '0')}:${String(j).padStart(2, '0')}`);
    }
  }

  // --- CUSTOM SHIFT PRESETS LOGIC ---
  const BUILT_IN_SHIFT_PRESETS = useMemo(() => [
    { id: 'builtin-9-3', label: "9a-3p", start: "09:00", end: "15:00", builtIn: true },
    { id: 'builtin-10-4', label: "10a-4p", start: "10:00", end: "16:00", builtIn: true },
    { id: 'builtin-10-9', label: "10a-9p", start: "10:00", end: "21:00", builtIn: true },
    { id: 'builtin-11-3', label: "11a-3p", start: "11:00", end: "15:00", builtIn: true },
    { id: 'builtin-11-4', label: "11a-4p", start: "11:00", end: "16:00", builtIn: true },
    { id: 'builtin-4-9', label: "4p-9p", start: "16:00", end: "21:00", builtIn: true }
  ], []);
  const [customPresets, setCustomPresets] = useState([]);
  const [customPresetSyncStatus, setCustomPresetSyncStatus] = useState('idle');
  const [customPresetSyncMessage, setCustomPresetSyncMessage] = useState('');
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState(null);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetStart, setNewPresetStart] = useState('16:00');
  const [newPresetEnd, setNewPresetEnd] = useState('21:00');

  const normalizePresetClient = (preset = {}) => {
    const label = String(preset.label || preset.name || '').trim().replace(/\s+/g, ' ').slice(0, 48);
    const start = String(preset.start || preset.startTime || '').trim();
    const end = String(preset.end || preset.endTime || '').trim();
    const id = String(preset.id || preset.presetId || '').trim();
    if (!label || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start === end) return null;
    return { id, label, start, end };
  };
  const presetKeyClient = (p = {}) => `${String(p.label || '').toLowerCase()}|${p.start}|${p.end}`;
  const presetLabelKeyClient = (p = {}) => String(p.label || '').trim().toLowerCase();
  const dedupePresetClient = (rows = []) => {
    const seen = new Set();
    const out = [];
    for (const row of rows || []) {
      const p = normalizePresetClient(row);
      if (!p) continue;
      const key = presetKeyClient(p);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out.sort((a,b) => a.start.localeCompare(b.start) || a.label.localeCompare(b.label));
  };
  const customPresetCacheKey = `customPresets_${appUser?.restaurantId || 'unknown'}`;
  const customPresetMigrationKey = `customPresetsSharedMigration_${appUser?.restaurantId || 'unknown'}`;
  const fetchCustomPresetServer = async (options = {}) => {
    if (!appUser?.restaurantId) return [];
    const response = await secureFetch(`/api/custom-shift-presets?restaurantId=${encodeURIComponent(appUser.restaurantId)}`, options);
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.ok) throw new Error(json?.error || 'Custom Shift sync failed.');
    const rows = dedupePresetClient(json.presets || []);
    localStorage.setItem(customPresetCacheKey, JSON.stringify(rows));
    setCustomPresets(rows);
    return rows;
  };
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!appUser?.restaurantId) return;
      const localRows = (() => { try { return dedupePresetClient(JSON.parse(localStorage.getItem(customPresetCacheKey) || '[]')); } catch (_) { return []; } })();
      if (localRows.length) setCustomPresets(localRows);
      setCustomPresetSyncStatus('loading');
      setCustomPresetSyncMessage('Loading shared Custom Shifts...');
      try {
        const migrated = localStorage.getItem(customPresetMigrationKey) === 'done';
        if (!migrated && localRows.length) {
          const response = await secureFetch('/api/custom-shift-presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'merge', restaurantId: appUser.restaurantId, presets: localRows }) });
          const json = await response.json().catch(() => ({}));
          if (!response.ok || !json?.ok) throw new Error(json?.error || 'Custom Shift migration failed.');
          localStorage.setItem(customPresetMigrationKey, 'done');
          const rows = dedupePresetClient(json.presets || []);
          if (!cancelled) setCustomPresets(rows);
          localStorage.setItem(customPresetCacheKey, JSON.stringify(rows));
        } else {
          await fetchCustomPresetServer();
        }
        if (!cancelled) { setCustomPresetSyncStatus('synced'); setCustomPresetSyncMessage('Custom Shifts are shared for this restaurant.'); }
      } catch (error) {
        if (!cancelled) { setCustomPresetSyncStatus('offline'); setCustomPresetSyncMessage('Using the last saved Custom Shifts. New changes will need the server connection.'); }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [appUser?.restaurantId]);

  const SHIFT_PRESETS = useMemo(() => {
    const customRows = [...customPresets].sort((a,b) => a.start.localeCompare(b.start) || a.label.localeCompare(b.label));
    const customRowsByLabel = new Map();
    for (const preset of customRows) {
      const key = presetLabelKeyClient(preset);
      if (key && !customRowsByLabel.has(key)) customRowsByLabel.set(key, preset);
    }

    const usedLabels = new Set();
    const visibleRows = [];
    for (const preset of BUILT_IN_SHIFT_PRESETS) {
      const key = presetLabelKeyClient(preset);
      if (!key || usedLabels.has(key)) continue;
      visibleRows.push(customRowsByLabel.get(key) || preset);
      usedLabels.add(key);
    }
    for (const preset of customRows) {
      const key = presetLabelKeyClient(preset);
      if (!key || usedLabels.has(key)) continue;
      visibleRows.push(preset);
      usedLabels.add(key);
    }

    return [
      ...visibleRows,
      { id: 'custom', label: "Custom", start: "", end: "" }
    ];
  }, [BUILT_IN_SHIFT_PRESETS, customPresets]);

  const handlePresetChange = (e) => { 
    const val = e.target.value; 
    setPresetShift(val); 
    const p = SHIFT_PRESETS.find(x => x.label === val); 
    if (p && val !== 'Custom') { 
      setStartTime(p.start); 
      setEndTime(p.end); 
    } 
  };

  const handleSavePreset = async (e) => {
    e.preventDefault();
    if (!newPresetLabel || !newPresetStart || !newPresetEnd) return;
    setCustomPresetSyncStatus('saving');
    try {
      const payload = { label: newPresetLabel.trim(), start: newPresetStart, end: newPresetEnd, ...(editingPresetId ? { id: editingPresetId } : {}) };
      const response = await secureFetch('/api/custom-shift-presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: editingPresetId ? 'update' : 'create', restaurantId: appUser.restaurantId, preset: payload }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Custom Shift save failed.');
      const rows = dedupePresetClient(json.presets || []);
      setCustomPresets(rows);
      localStorage.setItem(customPresetCacheKey, JSON.stringify(rows));
      setCustomPresetSyncStatus('synced');
      setCustomPresetSyncMessage('Custom Shifts are shared for this restaurant.');
      addToast(editingPresetId ? 'Updated' : 'Saved', editingPresetId ? 'Shared Custom Shift updated.' : 'Shared Custom Shift saved.');
      cancelPresetEdit();
    } catch (error) {
      setCustomPresetSyncStatus('error');
      setCustomPresetSyncMessage('Custom Shift was not saved. Check your connection and permissions.');
      addToast('Not Saved', error.message || 'Custom Shift was not saved.');
    }
  };

  const handleEditPreset = (preset) => {
    if (preset.builtIn) return;
    setNewPresetLabel(preset.label);
    setNewPresetStart(preset.start);
    setNewPresetEnd(preset.end);
    setEditingPresetId(preset.id);
    document.getElementById('preset-modal-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelPresetEdit = () => {
    setNewPresetLabel('');
    setNewPresetStart('16:00');
    setNewPresetEnd('21:00');
    setEditingPresetId(null);
  };

  const handleDeletePreset = async (id) => {
    if(window.confirm('Delete this shared preset? Scheduled shifts that already exist will not be changed.')) {
      setCustomPresetSyncStatus('saving');
      try {
        const response = await secureFetch('/api/custom-shift-presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', restaurantId: appUser.restaurantId, id }) });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json?.ok) throw new Error(json?.error || 'Custom Shift delete failed.');
        const rows = dedupePresetClient(json.presets || []);
        setCustomPresets(rows);
        localStorage.setItem(customPresetCacheKey, JSON.stringify(rows));
        setCustomPresetSyncStatus('synced');
        setCustomPresetSyncMessage('Custom Shifts are shared for this restaurant.');
        addToast('Deleted', 'Shared Custom Shift deleted.');
      } catch (error) {
        setCustomPresetSyncStatus('error');
        setCustomPresetSyncMessage('Custom Shift was not deleted. Check your connection and permissions.');
        addToast('Not Deleted', error.message || 'Custom Shift was not deleted.');
      }
    }
  };

// --- PAYROLL DATE RANGE ---
  const [periodStart, setPeriodStart] = useState(`${monthStr}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${monthStr}-${String(getDaysInMonth(monthStr)).padStart(2, '0')}`);
  
  // --- PUNCH FILTERS ---
  const [punchFilterDate, setPunchFilterDate] = useState('');
  const [punchFilterEmp, setPunchFilterEmp] = useState('');

  // --- LABOR & FINANCIAL TARGETS ---
  const [isTargetSettingsOpen, setIsTargetSettingsOpen] = useState(false);
  const [targetSales, setTargetSales] = useState(appUser?.systemSettings?.targetSales || '0');
  const [targetLaborPct, setTargetLaborPct] = useState(appUser?.systemSettings?.targetLaborPct || '0');
  
  const handleSaveTargets = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "restaurants", appUser.restaurantId), {
        'systemSettings.targetSales': parseFloat(targetSales) || 0,
        'systemSettings.targetLaborPct': parseFloat(targetLaborPct) || 0,
        'systemSettings.enableTargets': true
      });
      addToast('Saved', 'Financial and labor targets updated.');
      setIsTargetSettingsOpen(false);
    } catch (err) { addToast('Error', err.message); }
  };

  useEffect(() => {
    setPeriodStart(`${monthStr}-01`);
    setPeriodEnd(`${monthStr}-${String(getDaysInMonth(monthStr)).padStart(2, '0')}`);
  }, [monthStr]);

  const activeRoster = users.filter(u => u.isActive !== false);

  const displayUsers = [...activeRoster].sort((a,b) => {
    const roleA = a.role || 'Unassigned';
    const roleB = b.role || 'Unassigned';
    const nameA = a.name || 'Unknown';
    const nameB = b.name || 'Unknown';
    return roleA === roleB ? nameA.localeCompare(nameB) : roleA.localeCompare(roleB);
  });
  
  const groupedUsers = activeRoster.reduce((acc, user) => {
    const role = user.role || 'Unassigned';
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {});
  const sortedRoles = Object.keys(groupedUsers).sort();

  const getRoleColors = (role, isPublished) => {
    if (!isPublished) return 'bg-slate-400 text-slate-900';
    const palette = ['bg-blue-400 text-blue-950', 'bg-emerald-400 text-emerald-950', 'bg-pink-400 text-pink-950', 'bg-purple-400 text-purple-950', 'bg-cyan-400 text-cyan-950', 'bg-amber-400 text-amber-950', 'bg-[#D4A381] text-slate-900'];
    const clean = String(role || 'Unassigned');
    const hash = clean.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return palette[hash % palette.length];
  };

  const rescueEditableMonths = Array.from(new Set([
    ...(Array.isArray(clientData?.scheduleRescueDraftMonths) ? clientData.scheduleRescueDraftMonths : []),
    ...(Array.isArray(clientData?.scheduleRescueBuilderOverwriteMonths) ? clientData.scheduleRescueBuilderOverwriteMonths : []),
    ...(Array.isArray(clientData?.scheduleRescueProtectedMonths) ? clientData.scheduleRescueProtectedMonths : [])
  ].filter(Boolean)));
  const currentScheduleMonth = getMonthStr(currentDate);
  const isRescueEditableMonth = (month = currentScheduleMonth) => rescueEditableMonths.includes(month);
  const canEditRescueMonth = (month = currentScheduleMonth) => isRescueEditableMonth(month) && !!(appUser?.isSuperAdmin || appUser?.isAdmin || appUser?.permissions?.schedule || appUser?.permissions?.team);
  const canEditScheduleDate = (d) => !(d < getToday()) || canEditRescueMonth(getMonthStr(d));

  const getScheduleBuilderPerson = (empId) => activeRoster.find(u => u.id === empId) || users.find(u => u.id === empId) || null;
  const normalizeShiftFingerprintValue = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  const getScheduleShiftDateKey = (shift = {}) => String(shift.date || shift.scheduleDateKey || '');
  const getScheduleShiftDedupeKey = (shift = {}) => {
    const startMinutes = parseScheduleClockMinutes(shift.startTime);
    const endMinutes = parseScheduleClockMinutes(shift.endTime);
    return [
      getScheduleShiftDateKey(shift),
      startMinutes === null ? normalizeShiftFingerprintValue(shift.startTime) : `s${startMinutes}`,
      endMinutes === null ? normalizeShiftFingerprintValue(shift.endTime) : `e${endMinutes}`
    ].join('|');
  };
  const dedupeScheduleShiftsForSamePerson = (shiftList = []) => {
    const seen = new Set();
    return (shiftList || []).filter(shift => {
      const key = getScheduleShiftDedupeKey(shift);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const getScheduleBuilderRawShiftsForPersonDate = (dateKey, person) => schedulePeriodShifts.filter(s => getScheduleShiftDateKey(s) === dateKey && shiftMatchesPerson(s, person, users));
  const getScheduleBuilderShiftsForPersonDate = (dateKey, person) => dedupeScheduleShiftsForSamePerson(getScheduleBuilderRawShiftsForPersonDate(dateKey, person));
  const scheduledHoursTrackerSourceShifts = mergeVisibleScheduleShifts((shifts || []).filter(shift => !isDeletedScheduleShift(shift)), localBuilderShiftEchoes.filter(shift => !isDeletedScheduleShift(shift))).filter(shift => !isDeletedScheduleShift(shift) && !shiftMatchesLocalDeleteMarkers(shift, activeLocalDeleteKeySet, activeLocalDeleteMarkerMap));
  const getScheduledHoursTrackerRawShiftsForPersonDate = (dateKey, person) => scheduledHoursTrackerSourceShifts.filter(s => getScheduleShiftDateKey(s) === dateKey && shiftMatchesPerson(s, person, users));

  const getScheduleShiftLogicalDeleteIdentity = (sourceShift = {}, sourcePerson = null, fallbackDateKey = '') => {
    const date = String(fallbackDateKey || getScheduleShiftDateKey(sourceShift) || '').trim();
    const restaurantId = String(sourceShift?.restaurantId || sourceShift?.workspaceId || appUser?.restaurantId || '').trim();
    const startMinutes = parseScheduleClockMinutes(sourceShift?.startTime);
    const endMinutes = parseScheduleClockMinutes(sourceShift?.endTime);
    const start = startMinutes === null ? normalizeShiftFingerprintValue(sourceShift?.startTime) : `m${startMinutes}`;
    const end = endMinutes === null ? normalizeShiftFingerprintValue(sourceShift?.endTime) : `m${endMinutes}`;
    if (!restaurantId || !date || !start || !end || !sourcePerson) return null;
    return { restaurantId, date, start, end, person: sourcePerson };
  };

  const scheduleShiftMatchesLogicalDeleteIdentity = (candidate = {}, identity = null) => {
    if (!candidate || !identity || isDeletedScheduleShift(candidate)) return false;
    const candidateRestaurantId = String(candidate?.restaurantId || candidate?.workspaceId || appUser?.restaurantId || '').trim();
    if (!candidateRestaurantId || candidateRestaurantId !== identity.restaurantId) return false;
    if (getScheduleShiftDateKey(candidate) !== identity.date) return false;
    const candidateStartMinutes = parseScheduleClockMinutes(candidate?.startTime);
    const candidateEndMinutes = parseScheduleClockMinutes(candidate?.endTime);
    const candidateStart = candidateStartMinutes === null ? normalizeShiftFingerprintValue(candidate?.startTime) : `m${candidateStartMinutes}`;
    const candidateEnd = candidateEndMinutes === null ? normalizeShiftFingerprintValue(candidate?.endTime) : `m${candidateEndMinutes}`;
    if (candidateStart !== identity.start || candidateEnd !== identity.end) return false;
    return shiftMatchesPerson(candidate, identity.person, users);
  };

  const fetchSavedScheduleBuilderDeleteTargetsForPersonDate = async (dateKey, person, visibleCandidates = [], options = {}) => {
    const byId = new Map();
    const seedVisibleCandidates = options.seedVisibleCandidates !== false;
    const serverOnly = options.serverOnly === true;
    const logicalIdentities = (options.logicalIdentities || (visibleCandidates || []).map(shift => getScheduleShiftLogicalDeleteIdentity(shift, person, dateKey)))
      .filter(Boolean);
    const matchesDeleteScope = (candidate = {}) => {
      if (logicalIdentities.length) return logicalIdentities.some(identity => scheduleShiftMatchesLogicalDeleteIdentity(candidate, identity));
      return !isDeletedScheduleShift(candidate) && getScheduleShiftDateKey(candidate) === dateKey && shiftMatchesPerson(candidate, person, users);
    };
    if (seedVisibleCandidates) {
      (visibleCandidates || []).forEach(shift => {
        if (!isDeletedScheduleShift(shift) && matchesDeleteScope(shift)) {
          const id = getShiftWritableDocId(shift);
          if (id) byId.set(String(id), { ...shift, id });
        }
      });
    }
    const collectSnapshotMatches = (snap) => {
      snap.forEach(docSnap => {
        const shift = { id: docSnap.id, ...docSnap.data() };
        if (matchesDeleteScope(shift)) byId.set(String(docSnap.id), shift);
      });
    };
    const baseCollection = collection(db, 'shifts');
    const restaurantId = appUser?.restaurantId;
    if (!restaurantId || !dateKey || !person) return Array.from(byId.values()).filter(shift => !isDeletedScheduleShift(shift));
    const runQuery = serverOnly ? getDocsFromServer : getDocs;
    try {
      const dateSnap = await runQuery(query(baseCollection, where('restaurantId', '==', restaurantId), where('date', '==', dateKey)));
      collectSnapshotMatches(dateSnap);
      const scheduleDateSnap = await runQuery(query(baseCollection, where('restaurantId', '==', restaurantId), where('scheduleDateKey', '==', dateKey)));
      collectSnapshotMatches(scheduleDateSnap);
    } catch (err) {
      if (serverOnly) throw err;
      console.warn('Schedule delete target lookup fell back to visible shifts only', err);
    }
    return Array.from(byId.values()).filter(shift => !isDeletedScheduleShift(shift) && matchesDeleteScope(shift));
  };

  const verifySavedScheduleBuilderDeleteScopeCleared = async (dateKey, person, deleteIdentity) => {
    if (!deleteIdentity) return [];
    return fetchSavedScheduleBuilderDeleteTargetsForPersonDate(dateKey, person, [], {
      seedVisibleCandidates: false,
      serverOnly: true,
      logicalIdentities: [deleteIdentity]
    });
  };

  const tombstoneAndDeleteScheduleBuilderShiftTargets = async (targets = [], deleteScope = {}) => {
    const byId = new Map();
    (targets || []).forEach(shift => {
      const id = getShiftWritableDocId(shift);
      if (id) byId.set(id, { ...shift, id });
    });
    const targetList = Array.from(byId.values());
    if (!targetList.length) return { targetList: [], deletedCount: 0, failedCount: 0 };

    const deletedAtIso = new Date().toISOString();
    const tombstonePayload = {
      deleted: true,
      isDeleted: true,
      scheduleDeleted: true,
      recordStatus: 'deleted',
      status: 'deleted',
      publishStatus: 'deleted',
      isPublished: false,
      published: false,
      deletedAt: deletedAtIso,
      deletedBy: appUser?.id || appUser?.uid || appUser?.email || 'schedule-builder',
      deletedByName: appUser?.name || appUser?.email || '',
      deleteScope: deleteScope.scope || 'schedule-builder',
      updatedAt: deletedAtIso
    };

    const tombstoneResults = await Promise.allSettled(targetList.map(shift => updateDoc(doc(db, 'shifts', shift.id), tombstonePayload)));
    const deleteResults = await Promise.allSettled(targetList.map(shift => deleteDoc(doc(db, 'shifts', shift.id))));
    const succeededIds = targetList
      .filter((_, index) => tombstoneResults[index]?.status === 'fulfilled' || deleteResults[index]?.status === 'fulfilled')
      .map(shift => shift.id);
    const failedCount = targetList.length - succeededIds.length;
    if (!succeededIds.length && targetList.length) {
      const firstFailure = deleteResults.find(r => r.status === 'rejected')?.reason || tombstoneResults.find(r => r.status === 'rejected')?.reason;
      throw firstFailure || new Error('No selected schedule shifts could be removed.');
    }
    if (failedCount) console.warn('[86chaos] Some schedule delete targets could not be removed', { failedCount, targetList });
    return { targetList, deletedCount: succeededIds.length, failedCount };
  };

  const handleDeleteSpecificShift = async (event, shift, person, dateKey) => {
    event?.stopPropagation?.();
    const label = `${formatShortTime(shift?.startTime)}-${formatShortTime(shift?.endTime)}`;
    if (!window.confirm(`Delete only ${label} for ${person?.name || 'this employee'} on ${formatDisplayDate(dateKey)}?`)) return;
    try {
      const deleteIdentity = getScheduleShiftLogicalDeleteIdentity(shift, person, dateKey);
      const allTargets = await fetchSavedScheduleBuilderDeleteTargetsForPersonDate(dateKey, person, [shift]);
      const exactTargets = deleteIdentity
        ? allTargets.filter(candidate => scheduleShiftMatchesLogicalDeleteIdentity(candidate, deleteIdentity))
        : [];
      if (!exactTargets.length) throw new Error('No saved matching shift records were found. Refresh the schedule and try again.');
      const result = await tombstoneAndDeleteScheduleBuilderShiftTargets(exactTargets, { scope: 'single-shift-logical-group' });
      let remainingActiveMatches = deleteIdentity ? await verifySavedScheduleBuilderDeleteScopeCleared(dateKey, person, deleteIdentity) : [];
      if (remainingActiveMatches.length) {
        const cleanupResult = await tombstoneAndDeleteScheduleBuilderShiftTargets(remainingActiveMatches, { scope: 'single-shift-post-delete-duplicate-cleanup' });
        remainingActiveMatches = await verifySavedScheduleBuilderDeleteScopeCleared(dateKey, person, deleteIdentity);
        result.deletedCount = (result.deletedCount || 0) + (cleanupResult.deletedCount || 0);
        result.failedCount = (result.failedCount || 0) + (cleanupResult.failedCount || 0);
        result.targetList = mergeVisibleScheduleShifts(result.targetList, cleanupResult.targetList);
      }
      if (remainingActiveMatches.length) {
        throw new Error(`${result.deletedCount || 0} matching record(s) were removed, but ${remainingActiveMatches.length} active duplicate still exists. Refresh and try again before publishing.`);
      }
      const markerSource = mergeVisibleScheduleShifts(exactTargets, result.targetList, [shift]);
      const deletedMarkers = buildLocalShiftDeletionMarkers(markerSource);
      const deletedKeySet = new Set(deletedMarkers.map(marker => marker.key).filter(Boolean));
      const localPruneKeySet = new Set(markerSource.flatMap(getScheduleShiftLocalPruneKeys).filter(Boolean));
      const shouldPruneDeletedLogicalShift = (item = {}) => {
        if (deleteIdentity && scheduleShiftMatchesLogicalDeleteIdentity(item, deleteIdentity)) return true;
        if (localPruneKeySet.size && shiftMatchesLocalDeletePruneKeys(item, localPruneKeySet)) return true;
        if (deletedKeySet.size && shiftMatchesLocalDeleteMarkers(item, deletedKeySet)) return true;
        return false;
      };
      if (deletedMarkers.length) setLocalBuilderDeletedShiftMarkers(prev => mergeLocalShiftDeletionMarkers(prev, deletedMarkers));
      setLocalBuilderShiftEchoes(prev => prev.filter(item => !shouldPruneDeletedLogicalShift(item)));
      setAutoFillVisibleShifts(prev => prev.filter(item => !shouldPruneDeletedLogicalShift(item)));
      addToast('Shift Deleted', result.deletedCount === 1 ? 'That shift was removed.' : `${result.deletedCount} hidden duplicate shift records were removed from that one chip.`);
    } catch (err) {
      addToast('Delete Failed', err?.message || 'Could not remove that shift.');
    }
  };

  const handleCellClick = async (d, empId) => {
    if (isAssigningShift) return;
    if (!canEditScheduleDate(d)) return addToast("Locked", "Cannot edit past dates.");
    const emp = getScheduleBuilderPerson(empId);
    if (!emp) return addToast('Staff Missing', 'This row no longer matches an active staff profile. Refresh the page and try again.');
    const existingShifts = getScheduleBuilderRawShiftsForPersonDate(d, emp);
    setSelectedEmp(empId);
    setAssignDates(prev => {
      const base = selectedEmp && selectedEmp !== empId ? [] : prev;
      return base.includes(d) ? base.filter(x => x !== d) : [...base, d];
    });
    if (existingShifts.length) {
      addToast('Date Selected', 'Tap an individual shift chip to delete only that shift. This date is selected for adding another shift.');
    }
  };

  const handleAssign = async () => {
    if (isAssigningShift) return;
    if (!selectedEmp || assignDates.length === 0) return;
    const emp = getScheduleBuilderPerson(selectedEmp);
    if (!emp?.id) return addToast('Staff Missing', 'Select one active staff member before assigning shifts.');
    const uniqueAssignDates = [...new Set(assignDates)].filter(Boolean);
    setIsAssigningShift(true);
    try {
      const validDates = [];
      const availabilityOverrides = {};
      for (const d of uniqueAssignDates) { 
        const existingShift = visibleShifts.find(s => (s.date || s.scheduleDateKey) === d && shiftMatchesPerson(s, emp, users));
        if (existingShift) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} is already scheduled on ${formatDisplayDate(d)}.`); return; }
        
        const req = timeOffRequests.find(r => r.date === d && timeOffMatchesPerson(r, emp) && !['cancelled','canceled','archived','processed','denied','rejected'].includes(String(r.status || '').toLowerCase()));
        if (req) {
          if (!req.isPartial) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} requested ${formatDisplayDate(d)} off.`); return; } 
          else { const reqEnd = req.endTime || '23:59'; if ((startTime < reqEnd) && (endTime > req.startTime)) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} is unavailable from ${formatShortTime(req.startTime)} to ${formatShortTime(req.endTime)} on ${formatDisplayDate(d)}.`); return; } }
        }
        const availabilityRecord = getActiveAvailabilityForDate(emp.id, d, availabilityRecords);
        const availabilityCheck = getAvailabilityConflict(availabilityRecord, d, startTime, endTime);
        if (availabilityCheck && ['unavailable', 'outside'].includes(availabilityCheck.level)) {
          const reason = window.prompt(`${emp.name || 'Employee'} is outside approved availability on ${formatDisplayDate(d)}. Enter an override reason to continue, or cancel.`);
          if (!reason) {
            addToast('Availability Warning', 'Assignment cancelled until an override reason is entered.');
            return;
          }
          availabilityOverrides[d] = { reason, warning: availabilityCheck.message, availabilityId: availabilityRecord?.id || '' };
          await logAudit(appUser, 'AVAILABILITY_OVERRIDE_SCHEDULE', emp.name || emp.id, `${d} ${startTime}-${endTime}: ${reason}`);
        }
        validDates.push(d);
      }
      const savedShiftEchoes = [];
      for (const d of validDates) {
        const nowIso = new Date().toISOString();
        const shiftMonth = getMonthStr(d);
        const rescueEdit = canEditRescueMonth(shiftMonth);
        const shiftData = {
          date: d,
          scheduleDateKey: d,
          scheduleMonth: shiftMonth,
          ...buildScheduleIdentityFields(emp),
          role: emp.role || 'Unassigned',
          startTime: startTime,
          endTime: endTime,
          isPublished: false,
          publishState: 'draft',
          scheduleBuilderDraft: true,
          readyToPublish: true,
          restaurantId: appUser.restaurantId,
          workspaceId: appUser.restaurantId,
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: appUser?.id || appUser?.email || 'schedule-builder',
          updatedBy: appUser?.id || appUser?.email || 'schedule-builder',
          assignmentSource: 'schedule-builder-stable-row'
        };
        if (availabilityOverrides[d]) {
          shiftData.availabilityOverrideReason = availabilityOverrides[d].reason;
          shiftData.availabilityWarning = availabilityOverrides[d].warning;
          shiftData.availabilityRecordId = availabilityOverrides[d].availabilityId;
          shiftData.scheduledOutsideAvailability = true;
        }
        if (rescueEdit) {
          shiftData.rescueProtected = true;
          shiftData.rescueEditable = true;
          shiftData.rescueMode = 'schedule_builder_manual_edit';
          shiftData.rescueMonth = shiftMonth;
          shiftData.restoreSourceKey = `manual-after-rescue-${shiftMonth}`;
          shiftData.sourceKey = `manual-schedule-builder-edit-${shiftMonth}`;
          shiftData.source = 'Schedule Builder manual edit after emergency rescue';
        }
        const savedRef = await addDoc(collection(db, "shifts"), shiftData);
        savedShiftEchoes.push({ ...shiftData, id: savedRef.id, localEcho: true });
      }
      if (savedShiftEchoes.length) {
        setLocalBuilderShiftEchoes(prev => mergeVisibleScheduleShifts(prev, savedShiftEchoes));
      }
      setAssignDates([]); addToast('Assigned', `Added ${validDates.length} shift${validDates.length === 1 ? '' : 's'} for ${emp.name || 'selected staff'}.`);
    } finally {
      setIsAssigningShift(false);
    }
  };

const handlePublish = async (scope = 'selected-weeks') => { 
    const publishAll = scope === 'full-period';
    const selectedWeeksForPublish = publishAll ? publishWeekOptions : selectedPublishWeeks;
    const publishDays = publishAll ? publicationWeekDays : selectedPublishDays;
    const publishDaySet = new Set(publishDays);
    const localPublishCandidateSources = mergeSchedulePublishCandidates(renderedPublicationPeriodShifts, publicationPeriodShifts, visibleSourceShifts, autoFillVisibleShifts, localBuilderShiftEchoes, getScheduleBuilderRenderedShiftsForDaySet(publishDaySet))
      .filter(shift => !isDeletedScheduleShift(shift) && !shiftMatchesLocalDeleteMarkers(shift, activeLocalDeleteKeySet, activeLocalDeleteMarkerMap));
    const publishCandidates = await fetchSchedulePublishCandidatesForDaySet(publishDaySet, localPublishCandidateSources);
    const selectedCandidates = publishCandidates
      .filter(shift => getShiftWritableDocId(shift) && !isDeletedScheduleShift(shift) && (publishAll || shiftIsInsideDaySet(shift, publishDaySet)))
      .filter(shift => publishDaySet.has(getShiftDateKey(shift)));
    const publishPeriodStart = publishAll ? publicationWeekBounds.start : (publishDays[0] || schedulePeriodBounds.start);
    const publishPeriodEnd = publishAll ? publicationWeekBounds.end : (publishDays[publishDays.length - 1] || schedulePeriodBounds.end);
    const publishPeriodLabel = publishAll
      ? schedulePeriodLabel
      : (selectedWeeksForPublish.length ? selectedWeeksForPublish.map(option => option.label).join(', ') : 'selected weeks');
    const publishSelectionLabel = publishAll ? schedulePeriodLabel : selectedPublishLabel;
    const publishedAtIso = new Date().toISOString();
    const scheduleId = `schedule_${appUser.restaurantId}_${publishPeriodStart}_${publishPeriodEnd}_${Date.now()}`;
    const publishWeekKeys = selectedWeeksForPublish.map(option => option.key);

    if (selectedCandidates.length === 0) {
      addToast('Notice', publishAll ? 'No shifts found in this publishing window.' : 'No shifts found in the selected weeks.');
      return;
    }

    const unresolved = [];
    const updatePlan = [];
    const alreadyValid = [];
    let draftCount = 0;
    let repairCount = 0;

    selectedCandidates.forEach(shift => {
      const shiftDocId = getShiftWritableDocId(shift);
      const dateKey = getShiftDateKey(shift);
      const resolved = resolveSchedulePersonForShift(shift, users);
      if (!shiftDocId || !dateKey || !resolved.ok || !resolved.person) {
        unresolved.push({ shift, reason: !dateKey ? 'missing date' : (resolved.reason || 'employee not matched') });
        return;
      }
      const canonical = buildCanonicalScheduleIdentityBlock(resolved.person, shift);
      const isLive = isBuilderShiftPublished(shift);
      const publishedFieldsOk = shift.isPublished === true && shift.published === true && String(shift.status || '').toLowerCase() === 'published' && String(shift.publishStatus || '').toLowerCase() === 'published';
      const identityOk = scheduleIdentityBlockMatchesPerson(shift, resolved.person);
      const dateOk = String(shift.date || shift.scheduleDateKey || '') === dateKey && String(shift.scheduleDateKey || shift.date || '') === dateKey;
      const needsWrite = !isLive || !publishedFieldsOk || !identityOk || !dateOk || !shift.scheduleId;
      if (!needsWrite) {
        alreadyValid.push(shiftDocId);
        return;
      }
      if (!isLive) draftCount += 1;
      else repairCount += 1;
      updatePlan.push({
        id: shiftDocId,
        shift,
        person: resolved.person,
        dateKey,
        wasPublished: isLive,
        update: {
          restaurantId: shift.restaurantId || appUser.restaurantId,
          workspaceId: shift.workspaceId || shift.restaurantId || appUser.restaurantId,
          date: dateKey,
          scheduleDateKey: dateKey,
          isPublished: true,
          published: true,
          status: 'published',
          publishStatus: 'published',
          publishState: 'published',
          schedulePublishStatus: 'published',
          visibility: 'published',
          scheduleBuilderDraft: false,
          readyToPublish: false,
          draft: false,
          isDraft: false,
          publishedAt: isLive && shift.publishedAt ? shift.publishedAt : publishedAtIso,
          publishedBy: shift.publishedBy || appUser?.id || appUser?.email || 'unknown',
          publishedByName: shift.publishedByName || appUser?.name || appUser?.email || 'Unknown',
          scheduleId: isLive && shift.scheduleId ? shift.scheduleId : scheduleId,
          schedulePeriodStart: shift.schedulePeriodStart || publishPeriodStart,
          schedulePeriodEnd: shift.schedulePeriodEnd || publishPeriodEnd,
          publishScope: publishAll ? 'full-period' : 'selected-weeks',
          publishWeekKeys,
          identityVerifiedAt: publishedAtIso,
          identityVerifiedBy: appUser?.id || appUser?.email || 'unknown',
          updatedAt: publishedAtIso,
          ...canonical
        }
      });
    });

    const unresolvedNames = Array.from(new Set(unresolved.map(item => item.shift?.employeeName || item.shift?.assignedName || item.shift?.name || item.shift?.role || 'unknown staff'))).slice(0, 8);
    if (updatePlan.length === 0) {
      if (unresolved.length) {
        addToast('Employee Match Needed', `${unresolved.length} shift${unresolved.length === 1 ? '' : 's'} were not published because their employee accounts could not be matched. Review employee links for ${unresolvedNames.join(', ')}.`);
        return;
      }
      addToast('Already Published', 'Schedule is already published and employee visibility is verified.');
      setIsPublishPickerOpen(false);
      return;
    }

    const confirmMessage = unresolved.length
      ? `Publish/repair ${updatePlan.length} shift${updatePlan.length === 1 ? '' : 's'} for ${publishSelectionLabel}? ${unresolved.length} shift${unresolved.length === 1 ? '' : 's'} will stay draft because employee accounts could not be matched: ${unresolvedNames.join(', ')}.`
      : `Publish/repair ${updatePlan.length} shift${updatePlan.length === 1 ? '' : 's'} for ${publishSelectionLabel}? Weeks not selected will stay as drafts.`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const restaurantPrefix = getRestaurantExportPrefix(appUser, appUser?.restaurantId || '86chaos');
      const now = new Date();
      const backupPayload = {
        app: '86chaos',
        type: 'schedule-publish-backup',
        version: CURRENT_VERSION,
        generatedAt: now.toISOString(),
        restaurantId: appUser?.restaurantId || null,
        restaurantName: appUser?.restaurantName || appUser?.systemSettings?.restaurantName || null,
        publishScope: publishAll ? 'full-period' : 'selected-weeks',
        publishWeekKeys,
        publishWeeks: selectedWeeksForPublish.map(option => ({ label: option.label, start: option.start, end: option.end, draftCount: option.draftCount, liveCount: option.liveCount })),
        publishPeriodStart,
        publishPeriodEnd,
        publishPeriodLabel,
        selectedShiftCount: selectedCandidates.length,
        updateCount: updatePlan.length,
        draftCount,
        repairCount,
        unresolvedCount: unresolved.length,
        updateShiftIds: updatePlan.map(item => item.id),
        selectedShifts: selectedCandidates.map(s => ({ ...s }))
      };
      const stamp = now.toISOString().replace(/[:.]/g, '-');
      downloadTextFile(`${restaurantPrefix}-Schedule-Publish-Backup-${publishPeriodStart}-to-${publishPeriodEnd}-${stamp}.json`, JSON.stringify(backupPayload, null, 2), 'application/json;charset=utf-8;');
    } catch (backupErr) {
      console.warn('Schedule publish backup download failed:', backupErr);
      if (!window.confirm('The local backup download failed. Continue publishing anyway?')) return;
    }

    addToast('Publishing...', `Verifying and publishing ${updatePlan.length} ${publishPeriodLabel} shift(s). Please wait.`);

    try {
      for (let i = 0; i < updatePlan.length; i += 450) {
        const batch = writeBatch(db);
        updatePlan.slice(i, i + 450).forEach(item => batch.update(doc(db, 'shifts', item.id), item.update));
        await batch.commit();
      }

      const verificationFailures = [];
      for (const item of updatePlan) {
        const snap = await getDoc(doc(db, 'shifts', item.id));
        if (!snap.exists()) {
          verificationFailures.push({ id: item.id, reason: 'missing after publish' });
          continue;
        }
        const data = { id: snap.id, ...snap.data() };
        const expectedRestaurantId = String(item.update.restaurantId || appUser.restaurantId || '');
        const actualRestaurantId = String(data.restaurantId || data.workspaceId || '');
        const statusOk = data.isPublished === true && data.published === true && String(data.status || '').toLowerCase() === 'published' && String(data.publishStatus || '').toLowerCase() === 'published';
        const dateOk = getShiftDateKey(data) === item.dateKey;
        const personOk = shiftMatchesPerson(data, item.person, users) && scheduleIdentityBlockMatchesPerson(data, item.person);
        const scheduleIdOk = item.wasPublished || Boolean(data.scheduleId);
        if (actualRestaurantId !== expectedRestaurantId || !statusOk || !dateOk || !personOk || !scheduleIdOk) {
          verificationFailures.push({ id: item.id, reason: 'published read-back did not match expected fields' });
        }
      }

      if (verificationFailures.length) {
        console.warn('[86chaos] Schedule publish verification failed', verificationFailures);
        addToast('Publish Needs Attention', `${verificationFailures.length} shift${verificationFailures.length === 1 ? '' : 's'} did not verify after saving. The publish window stayed open so you can retry.`);
        return;
      }

      const publishedShiftIds = updatePlan.map(item => item.id).filter(Boolean);
      if (publishedShiftIds.length) {
        setLocalBuilderPublishedShiftIds(prev => Array.from(new Set([...(prev || []), ...publishedShiftIds])).slice(-1000));
      }

      const inRangeRequests = (timeOffRequests || []).filter(r => publishDaySet.has(String(r?.date || '')) && String(r.restaurantId || r.workspaceId || appUser.restaurantId) === String(appUser.restaurantId));
      const processedRequests = inRangeRequests.filter(r => ['approved', 'denied'].includes(String(r.status || '').toLowerCase()) && r.archived !== true && r.processed !== true);
      const pendingPublishedOverlap = inRangeRequests.filter(r => String(r.status || '').toLowerCase() === 'pending');
      await Promise.all(processedRequests.map(r => updateDoc(doc(db, 'timeOffRequests', r.id), {
        previousStatus: r.status || '', status: 'processed', processed: true, archived: true,
        processedAt: publishedAtIso, processedBy: appUser?.id || appUser?.email || '', processedByName: appUser?.name || appUser?.email || '',
        scheduleId, schedulePeriodStart: publishPeriodStart, schedulePeriodEnd: publishPeriodEnd,
        publishedAt: publishedAtIso, publishedBy: appUser?.id || appUser?.email || '', publishedByName: appUser?.name || appUser?.email || ''
      })));
      await Promise.all(pendingPublishedOverlap.map(r => updateDoc(doc(db, 'timeOffRequests', r.id), {
        overlapsPublishedSchedule: true, unresolvedPublishedOverlap: true, scheduleId,
        schedulePeriodStart: publishPeriodStart, schedulePeriodEnd: publishPeriodEnd, updatedAt: publishedAtIso
      })));
      if (processedRequests.length) await logAudit(appUser, 'TIME_OFF_AUTO_ARCHIVED_ON_PUBLISH', `${processedRequests.length} request-offs`, scheduleId);
      if (pendingPublishedOverlap.length) await logAudit(appUser, 'TIME_OFF_PENDING_OVERLAPS_PUBLISHED_SCHEDULE', `${pendingPublishedOverlap.length} pending request-offs`, scheduleId);

      setIsPublishPickerOpen(false);
      setSelectedPublishWeekKeys([]);
      const title = unresolved.length ? 'Published with Employee Review Needed' : (repairCount ? 'Published and Visibility Repaired' : 'Published');
      const detailParts = [`${publishedShiftIds.length} shift${publishedShiftIds.length === 1 ? '' : 's'} verified for ${publishPeriodLabel}`];
      if (draftCount) detailParts.push(`${draftCount} new`);
      if (repairCount) detailParts.push(`${repairCount} employee visibility repaired`);
      if (unresolved.length) detailParts.push(`${unresolved.length} still need employee links`);
      addToast(title, `${detailParts.join('. ')}. Weeks not selected stayed as drafts.`);
      logAudit(appUser, 'PUBLISH_SCHEDULE', 'Master Roster', `Verified ${publishedShiftIds.length}/${selectedCandidates.length} shifts for ${publishSelectionLabel}.`);

      try {
        addToast('Pinging Server', 'Sending schedule update notifications...');
        const pushRes = await secureFetch('/api/send-schedule-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurantId: appUser.restaurantId, restaurantName: appUser.restaurantName || 'Your restaurant', scheduleId, publishScope: publishAll ? 'full-period' : 'selected-weeks', publishPeriodStart, publishPeriodEnd, publishWeekKeys })
        });
        const pushData = await pushRes.json();
        if (pushData.message) addToast('Server Reply', pushData.message);
        else if (pushData.success) addToast('Alerts Sent!', `Schedule saved. Notifications sent to ${pushData.sentCount} device${pushData.sentCount === 1 ? '' : 's'}.`);
        else addToast('Notifications Not Sent', pushData.error || 'Schedule published, but notification delivery needs attention.');
      } catch (pushErr) {
        console.error('Failed to send schedule push notifications:', pushErr);
        addToast('Notifications Not Sent', 'Schedule published, but notifications could not be sent.');
      }
    } catch (err) {
      console.error('[86chaos] Schedule publish failed', err);
      addToast('Publishing Failed', err?.message || 'Schedule publishing failed before every selected shift could be verified.');
    }
  };
  
const eventReminderOptions = [
  { label: 'At event time', minutes: 0 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '2 hours before', minutes: 120 },
  { label: '1 day before', minutes: 1440 },
  { label: '2 days before', minutes: 2880 },
  { label: '1 week before', minutes: 10080 }
];
const orderReminderWeekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const getEventStartDateTime = (dateKey = eventDate, timeValue = eventTime) => {
  if (!dateKey) return null;
  const safeTime = timeValue || '09:00';
  const d = new Date(`${dateKey}T${safeTime}:00`);
  return Number.isFinite(d.getTime()) ? d : null;
};
const getEventReminderKey = (rem = {}) => rem.id || rem.reminderKey || (rem.scheduledAt ? `absolute:${rem.scheduledAt}` : `offset:${Number(rem.minutesBefore || 0)}`);
const getEventReminderSortTime = (rem = {}) => {
  if (rem.scheduledAt) { const d = new Date(rem.scheduledAt); if (Number.isFinite(d.getTime())) return d.getTime(); }
  const start = getEventStartDateTime();
  return start ? start.getTime() - Number(rem.minutesBefore || 0) * 60000 : 0;
};
const labelEventReminder = (rem = {}) => {
  if (rem.scheduledAt) {
    const dateKey = rem.absoluteDate || String(rem.scheduledAt).slice(0, 10);
    const timeKey = rem.absoluteTime || String(rem.scheduledAt).slice(11, 16);
    return rem.label || `${formatDisplayDate(dateKey)} at ${formatShortTime(timeKey)}`;
  }
  return rem.label || eventReminderOptions.find(o => Number(o.minutes) === Number(rem.minutesBefore))?.label || `${rem.minutesBefore} minutes before`;
};
const addEventReminderOffset = () => {
  if (newEventReminderMode === 'absolute') {
    if (!newEventReminderDate || !newEventReminderTime) return addToast?.('Reminder Needs Time', 'Choose the reminder day and time.');
    const scheduled = new Date(`${newEventReminderDate}T${newEventReminderTime}:00`);
    if (!Number.isFinite(scheduled.getTime())) return addToast?.('Invalid Reminder', 'Choose a valid reminder day and time.');
    const eventStart = getEventStartDateTime();
    if (eventStart && scheduled.getTime() > eventStart.getTime()) return addToast?.('Reminder After Event', 'Choose a reminder time before or at the event start.');
    const reminder = {
      id: `absolute:${newEventReminderDate}:${newEventReminderTime}`,
      reminderType: 'absolute',
      scheduledAt: scheduled.toISOString(),
      absoluteDate: newEventReminderDate,
      absoluteTime: newEventReminderTime,
      label: `${formatDisplayDate(newEventReminderDate)} at ${formatShortTime(newEventReminderTime)}`
    };
    setEventPushReminders(prev => prev.some(r => getEventReminderKey(r) === reminder.id || r.scheduledAt === reminder.scheduledAt) ? prev : [...prev, reminder].sort((a,b) => getEventReminderSortTime(a) - getEventReminderSortTime(b)));
    return;
  }
  const minutes = Number(newEventReminderOffset);
  if (!Number.isFinite(minutes) || minutes < 0) return;
  const reminder = { id: `offset:${minutes}`, reminderType: 'offset', minutesBefore: minutes, label: eventReminderOptions.find(o => o.minutes === minutes)?.label || `${minutes} minutes before` };
  setEventPushReminders(prev => prev.some(r => Number(r.minutesBefore) === minutes && !r.scheduledAt) ? prev : [...prev, reminder].sort((a,b) => getEventReminderSortTime(a) - getEventReminderSortTime(b)));
};
const removeEventReminderOffset = (reminderOrMinutes) => setEventPushReminders(prev => prev.filter(r => {
  if (typeof reminderOrMinutes === 'object') return getEventReminderKey(r) !== getEventReminderKey(reminderOrMinutes);
  return !(Number(r.minutesBefore) === Number(reminderOrMinutes) && !r.scheduledAt);
}));
const toggleOrderReminderDay = (day) => setOrderReminderDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
const getEventReminderRecipientRecords = () => {
  const isManagerish = (u) => u?.isAdmin || u?.permissions?.events || u?.permissions?.schedule || u?.permissions?.inventory;
  let recipients = [];
  if (eventReminderRecipientMode === 'managers') recipients = users.filter(isManagerish);
  else if (eventReminderRecipientMode === 'team' && (appUser?.isAdmin || appUser?.permissions?.events || appUser?.permissions?.schedule)) recipients = users.filter(u => u?.isActive !== false);
  else recipients = [appUser].filter(Boolean);
  const seen = new Set();
  return recipients.filter(Boolean).filter(u => {
    const key = String(u?.id || u?.uid || u?.userId || u?.email || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const getEventReminderRecipientIds = () => getEventReminderRecipientRecords().map(u => u?.id || u?.uid || u?.userId).filter(Boolean);
const getEventReminderRecipientEmails = () => getEventReminderRecipientRecords().map(u => String(u?.email || '').toLowerCase().trim()).filter(Boolean);
const getEventReminderPushTokens = () => {
  const tokens = new Set();
  getEventReminderRecipientRecords().forEach(u => {
    if (u?.fcmToken) tokens.add(u.fcmToken);
    if (Array.isArray(u?.fcmTokens)) u.fcmTokens.forEach(t => t && tokens.add(t));
    if (Array.isArray(u?.pushTokens)) u.pushTokens.forEach(t => t && tokens.add(typeof t === 'string' ? t : t?.token));
    if (u?.pushDevices && typeof u.pushDevices === 'object') {
      Object.values(u.pushDevices).forEach(device => {
        if (typeof device === 'string') tokens.add(device);
        if (device?.token) tokens.add(device.token);
        if (device?.fcmToken) tokens.add(device.fcmToken);
      });
    }
  });
  return [...tokens].filter(Boolean);
};
const getEventReminderRecipientSnapshots = () => getEventReminderRecipientRecords().map(u => ({
  id: u?.id || '',
  uid: u?.uid || u?.userId || '',
  email: String(u?.email || '').toLowerCase().trim(),
  name: u?.name || u?.displayName || ''
}));
const cancelFutureEventReminders = async (eventId) => {
  if (!eventId || !appUser?.restaurantId) return;
  const snap = await getDocs(query(collection(db, 'eventReminders'), where('restaurantId', '==', appUser.restaurantId), where('eventId', '==', eventId)));
  const nowIso = new Date().toISOString();
  await Promise.all(snap.docs.map(d => {
    const data = d.data();
    if (['sent','completed','dismissed'].includes(String(data.status || '').toLowerCase())) return Promise.resolve();
    return updateDoc(doc(db, 'eventReminders', d.id), { status:'cancelled', dispatchEligible: false, nextDispatchAt: null, cancelledAt: nowIso, cancelledBy: appUser?.id || '' });
  }));
};
const saveEventReminderDocs = async (eventId, eventData) => {
  if (!eventId || !eventData?.date) return;
  const recipients = getEventReminderRecipientIds();
  const recipientEmails = getEventReminderRecipientEmails();
  const recipientSnapshots = getEventReminderRecipientSnapshots();
  const recipientPushTokens = getEventReminderPushTokens();
  const eventStart = new Date(`${eventData.date}T${eventData.time || '09:00'}:00`);
  if (!Number.isFinite(eventStart.getTime())) return;
  const now = new Date();
  const docs = [];
  const remindersToSave = Array.isArray(eventData?.pushReminders) ? eventData.pushReminders : eventPushReminders;
  remindersToSave.forEach(rem => {
    const scheduled = rem.scheduledAt ? new Date(rem.scheduledAt) : new Date(eventStart.getTime() - (Number(rem.minutesBefore || 0) * 60000));
    if (scheduled >= now) docs.push({
      type:'eventReminder',
      scheduledAt: scheduled.toISOString(),
      minutesBefore: rem.scheduledAt ? null : Number(rem.minutesBefore || 0),
      reminderType: rem.scheduledAt ? 'absolute' : 'offset',
      absoluteDate: rem.absoluteDate || (rem.scheduledAt ? String(rem.scheduledAt).slice(0, 10) : ''),
      absoluteTime: rem.absoluteTime || (rem.scheduledAt ? String(rem.scheduledAt).slice(11, 16) : ''),
      label: labelEventReminder(rem)
    });
  });
  if (orderReminderEnabled && orderReminderDays.length) {
    const cursor = new Date(eventStart);
    cursor.setDate(cursor.getDate() - 7);
    cursor.setHours(9, 0, 0, 0);
    const end = new Date(eventStart);
    end.setHours(23, 59, 59, 0);
    while (cursor <= end) {
      const dayName = orderReminderWeekdays[cursor.getDay()];
      if (orderReminderDays.includes(dayName) && cursor >= now) docs.push({ type:'orderReminder', scheduledAt: cursor.toISOString(), cutoffDay: dayName, label: `Order reminder: ${dayName}` });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const nowIso = new Date().toISOString();
  await Promise.all(docs.map(rem => addDoc(collection(db, 'eventReminders'), {
    restaurantId: appUser.restaurantId,
    workspaceId: appUser.restaurantId,
    eventId,
    eventTitle: eventData.title || eventTitle.trim(),
    eventDate: eventData.date,
    eventTime: eventData.time || eventTime || '',
    reminderType: rem.type,
    type: rem.type,
    label: rem.label,
    scheduledAt: rem.scheduledAt,
    scheduledLocalDate: String(rem.scheduledAt || '').slice(0, 10),
    scheduledLocalTime: String(rem.scheduledAt || '').slice(11, 16),
    minutesBefore: rem.minutesBefore ?? null,
    cutoffDay: rem.cutoffDay || '',
    recipientMode: eventReminderRecipientMode,
    recipientUserIds: recipients,
    recipientEmails,
    recipientUsers: recipientSnapshots,
    recipientPushTokens,
    tokenSnapshotCount: recipientPushTokens.length,
    status: 'scheduled',
    dispatchEligible: true,
    nextDispatchAt: rem.scheduledAt,
    dispatchAttemptAt: null,
    dispatchLeaseUntil: null,
    dispatchAttemptCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: appUser?.id || '',
    createdByEmail: String(appUser?.email || '').toLowerCase().trim(),
    createdByName: appUser?.name || appUser?.email || ''
  })));
  return docs.length;
};
const resetEventReminderSettings = () => { setEventPushReminders([]); setNewEventReminderOffset('60'); setNewEventReminderMode('offset'); setNewEventReminderDate(getToday()); setNewEventReminderTime('09:00'); setOrderReminderEnabled(false); setOrderReminderDays([]); setEventReminderRecipientMode('creator'); };
const isPastEventDate = (dateKey) => !!dateKey && dateKey < getToday();
const getSafeEventCreateDate = (dateKey) => isPastEventDate(dateKey) ? getToday() : (dateKey || getToday());
const openNewEventModalForDate = (dateKey, options = {}) => {
  const safeDate = getSafeEventCreateDate(dateKey);
  const isPastSelection = isPastEventDate(dateKey);
  if (isPastSelection) {
    addToast('Past Date Locked', 'Events can only be added for today or a future date.');
    if (!options.allowTodayFallback) return;
  }
  setEventDate(safeDate);
  setEventTime('');
  setEventTitle('');
  setEventNotes('');
  setEditingEventId(null);
  setEventImageFile(null);
  setIsRepeating(false);
  setRepeatUntil('');
  resetEventReminderSettings();
  setNewEventReminderDate(safeDate);
  setIsEventModalOpen(true);
};

const handleAddEvent = async (e) => { 
    e.preventDefault(); 
    if(!eventTitle.trim()) return; 
    if (!editingEventId && isPastEventDate(eventDate)) {
      addToast('Past Date Locked', 'Events can only be added for today or a future date.');
      return;
    }
    if (!editingEventId && isRepeating && repeatUntil && repeatUntil < getToday()) {
      addToast('Past Date Locked', 'Repeating events must end today or later.');
      return;
    }
    if (!editingEventId && isRepeating && repeatUntil && repeatUntil < eventDate) {
      addToast('Check Repeat Dates', 'The repeat-until date must be the same day or later than the event date.');
      return;
    }
    setIsEventUploading(true);

    let photoUrl = null;
    if (eventImageFile) {
      try {
        const fileRef = ref(storage, `events/${appUser.restaurantId}/${Date.now()}_${eventImageFile.name}`);
        await uploadBytes(fileRef, eventImageFile);
        photoUrl = await getDownloadURL(fileRef);
      } catch (error) {
        addToast('Error', 'Image upload failed. Check connection.');
        setIsEventUploading(false);
        return;
      }
    }

    const cleanPushReminders = eventPushReminders.map(rem => ({
      id: getEventReminderKey(rem),
      reminderType: rem.scheduledAt ? 'absolute' : 'offset',
      minutesBefore: rem.scheduledAt ? null : Number(rem.minutesBefore || 0),
      scheduledAt: rem.scheduledAt || '',
      absoluteDate: rem.absoluteDate || (rem.scheduledAt ? String(rem.scheduledAt).slice(0, 10) : ''),
      absoluteTime: rem.absoluteTime || (rem.scheduledAt ? String(rem.scheduledAt).slice(11, 16) : ''),
      label: labelEventReminder(rem)
    }));
    const baseEventData = { type: 'special_event', time: eventTime, title: eventTitle.trim(), notes: eventNotes.trim(), addedBy: appUser.name, restaurantId: appUser.restaurantId, pushReminders: cleanPushReminders, orderReminder: { enabled: orderReminderEnabled, cutoffDays: orderReminderDays, recipientMode: eventReminderRecipientMode, startsDaysBefore: 7 }, reminderSettingsUpdatedAt: new Date().toISOString() };
    if (photoUrl) baseEventData.imageUrl = photoUrl; 

    if (editingEventId) {
      const updatedEvent = { ...baseEventData, date: eventDate, ...(photoUrl && { imageUrl: photoUrl }) };
      await updateDoc(doc(db, "events", editingEventId), updatedEvent);
      await cancelFutureEventReminders(editingEventId);
      const scheduledReminderCount = await saveEventReminderDocs(editingEventId, updatedEvent);
      if ((eventPushReminders.length || orderReminderDays.length) && scheduledReminderCount === 0) addToast('Event Updated', 'Event saved, but no future push reminders were scheduled. Check the reminder day/time.');
      else addToast('Updated', 'Event modified successfully.');
    } else {
      if (isRepeating && repeatUntil) {
        const seriesId = Date.now().toString();
        let currentDateObj = new Date(eventDate + 'T12:00:00');
        const endDateObj = new Date(repeatUntil + 'T12:00:00');
        const promises = [];
        let count = 0;

        while (currentDateObj <= endDateObj && count < 365) { // Hard cap at 365 events to prevent DB crash loops
          const dateStr = currentDateObj.toISOString().split('T')[0];
          const eventPayload = { ...baseEventData, date: dateStr, seriesId };
          promises.push(addDoc(collection(db, "events"), eventPayload).then(ref => saveEventReminderDocs(ref.id, eventPayload)));
          
          if (repeatType === 'daily') currentDateObj.setDate(currentDateObj.getDate() + 1);
          else if (repeatType === 'weekly') currentDateObj.setDate(currentDateObj.getDate() + 7);
          else if (repeatType === 'bi-weekly') currentDateObj.setDate(currentDateObj.getDate() + 14);
          else if (repeatType === 'monthly') currentDateObj.setMonth(currentDateObj.getMonth() + 1);
          else if (repeatType === 'yearly') currentDateObj.setFullYear(currentDateObj.getFullYear() + 1);
          count++;
        }
        await Promise.all(promises);
        addToast('Events Generated', `Created ${count} recurring events.`);
      } else {
        const eventPayload = { ...baseEventData, date: eventDate };
        const eventRef = await addDoc(collection(db, "events"), eventPayload);
        const scheduledReminderCount = await saveEventReminderDocs(eventRef.id, eventPayload);
        if ((eventPushReminders.length || orderReminderDays.length) && scheduledReminderCount === 0) addToast('Event Added', 'Event saved, but no future push reminders were scheduled. Check the reminder day/time.');
        else addToast('Event Added', 'Calendar updated.');
      }
    }
    setEventTitle(''); setEventTime(''); setEventNotes(''); setEditingEventId(null); setEventImageFile(null); setIsEventUploading(false); setIsEventModalOpen(false); setIsRepeating(false); setRepeatUntil(''); resetEventReminderSettings(); 
  };

  const openEditEventModal = (ev) => {
    setEventDate(ev.date); setEventTime(ev.time || ''); setEventTitle(ev.title || ''); setEventNotes(ev.notes || ''); setEditingEventId(ev.id); setEventImageFile(null); setEventPushReminders(Array.isArray(ev.pushReminders) ? ev.pushReminders : []); setNewEventReminderDate(ev.date || getToday()); setNewEventReminderTime(ev.time || '09:00'); setOrderReminderEnabled(!!ev.orderReminder?.enabled); setOrderReminderDays(Array.isArray(ev.orderReminder?.cutoffDays) ? ev.orderReminder.cutoffDays : []); setEventReminderRecipientMode(ev.orderReminder?.recipientMode || 'creator'); setIsEventModalOpen(true);
  };

  const openNewEventModal = () => {
    openNewEventModalForDate(currentDate, { allowTodayFallback: true });
  };

  const handleDeleteEvent = async (ev) => {
    if (!ev?.id || !window.confirm('Delete event? Future event and order reminders will be cancelled.')) return;
    await cancelFutureEventReminders(ev.id);
    await deleteDoc(doc(db, 'events', ev.id));
    addToast('Event Deleted', 'Event removed and future reminders cancelled.');
  };

  // --- AUTO-POPULATE SCHEDULE ENGINE ---
  const handleAutoPopulate = async () => {
    if (!autoPopSourceMonth) return addToast('Error', 'Please select a source month.');
    const sourceBounds = getScheduleMonthBoundsForKey(autoPopSourceMonth);
    if (!sourceBounds.start || !sourceBounds.end) return addToast('Error', 'Please select a valid source month.');
    let sourceShifts = [];
    try {
      const sourceSnapshot = await getDocs(query(
        collection(db, 'shifts'),
        where('restaurantId', '==', appUser.restaurantId),
        where('date', '>=', sourceBounds.start),
        where('date', '<=', sourceBounds.end),
        orderBy('date', 'asc'),
        firestoreLimit(900)
      ));
      const fetchedSourceShifts = sourceSnapshot.docs.map(sourceDoc => ({ id: sourceDoc.id, ...sourceDoc.data() }));
      const alreadyLoadedSourceShifts = shifts.filter(s => String(s?.date || '').startsWith(autoPopSourceMonth));
      sourceShifts = mergeVisibleScheduleShifts(fetchedSourceShifts, alreadyLoadedSourceShifts);
    } catch (err) {
      console.warn('Auto-Fill source month load failed, falling back to currently loaded shifts:', err?.code || err?.message || err);
      sourceShifts = shifts.filter(s => String(s?.date || '').startsWith(autoPopSourceMonth));
    }
    if (sourceShifts.length === 0) return addToast('Empty', 'No shifts found in the selected month.');

    const targetMonth = getMonthStr(currentDate);
    if (autoPopSourceMonth === targetMonth) return addToast('Error', 'Cannot copy to the exact same month.');

    let sMon = new Date(autoPopSourceMonth + '-01T12:00:00');
    while(sMon.getDay() !== 1) sMon.setDate(sMon.getDate() + 1);

    let tMon = new Date(targetMonth + '-01T12:00:00');
    while(tMon.getDay() !== 1) tMon.setDate(tMon.getDate() + 1);

    const dayOffset = Math.round((tMon - sMon) / (1000 * 60 * 60 * 24));

    const existingFingerprints = new Set(
      visibleShifts
        .filter(shift => String(shift?.date || '').startsWith(targetMonth))
        .map(buildShiftFingerprint)
        .filter(Boolean)
    );
    const sourceFingerprints = new Set();
    const batches = [];
    let batch = writeBatch(db);
    let batchSize = 0;
    let addedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    let outsideTargetMonthCount = 0;
    let committedCount = 0;
    let successfulBatchCount = 0;
    const queuedVisibleShifts = [];

    const queueShift = (payload) => {
      const ref = doc(collection(db, 'shifts'));
      batch.set(ref, payload);
      queuedVisibleShifts.push({ id: ref.id, ...payload });
      batchSize += 1;
      if (batchSize >= 450) {
        batches.push({ batch, count: batchSize });
        batch = writeBatch(db);
        batchSize = 0;
      }
    };

    for (const rawSourceShift of sourceShifts) {
      const legacyIdentityResolution = resolveAmbiguousNameOnlyShiftIdentity(rawSourceShift, users);
      if (!legacyIdentityResolution.ok) {
        invalidCount += 1;
        continue;
      }
      const rosterIdentity = findAutoFillRosterPersonForShift(legacyIdentityResolution.shift, users);
      const sourceShift = rosterIdentity.ok
        ? { ...legacyIdentityResolution.shift, ...buildScheduleIdentityFields(rosterIdentity.person) }
        : legacyIdentityResolution.shift;
      const sourceFingerprint = buildShiftFingerprint(sourceShift);
      if (!sourceFingerprint || !/^\d{4}-\d{2}-\d{2}$/.test(String(sourceShift.date || '')) || !getStableShiftEmployeeKey(sourceShift) || !normalizeShiftTimeForFingerprint(sourceShift.startTime) || !normalizeShiftTimeForFingerprint(sourceShift.endTime) || !String(sourceShift.role || '').trim()) {
        invalidCount += 1;
        continue;
      }
      if (sourceFingerprints.has(sourceFingerprint)) {
        duplicateCount += 1;
        continue;
      }
      sourceFingerprints.add(sourceFingerprint);

      const sDate = new Date(sourceShift.date + 'T12:00:00');
      if (!Number.isFinite(sDate.getTime())) {
        invalidCount += 1;
        continue;
      }
      sDate.setDate(sDate.getDate() + dayOffset);
      const newDateStr = sDate.toISOString().split('T')[0];

      if (!newDateStr.startsWith(targetMonth)) {
        outsideTargetMonthCount += 1;
        continue;
      }

      const payload = buildAutoPopulateShift(sourceShift, newDateStr, appUser.restaurantId, appUser, autoPopSourceMonth, rosterIdentity.ok ? rosterIdentity.person : null);
      const newFingerprint = buildShiftFingerprint(payload);
      if (!newFingerprint) {
        invalidCount += 1;
        continue;
      }
      if (existingFingerprints.has(newFingerprint)) {
        duplicateCount += 1;
        continue;
      }
      existingFingerprints.add(newFingerprint);
      queueShift(payload);
      addedCount += 1;
    }

    if (batchSize > 0) batches.push({ batch, count: batchSize });
    try {
      for (const pendingBatch of batches) {
        await pendingBatch.batch.commit();
        successfulBatchCount += 1;
        committedCount += pendingBatch.count;
      }
    } catch (err) {
      const detail = err?.message || 'Could not commit the copied schedule batch.';
      addToast(
        committedCount > 0 ? 'Auto-Fill Partially Saved' : 'Auto-Fill Failed',
        committedCount > 0
          ? `${committedCount} shift(s) were saved before a later batch failed. Refresh the schedule before retrying so duplicate protection can include the committed batch. Error: ${detail}`
          : detail
      );
      return;
    }

    const committedVisibleShifts = queuedVisibleShifts.slice(0, committedCount);
    const visibleCommittedCount = committedVisibleShifts.filter(shift => {
      const d = String(shift.date || shift.scheduleDateKey || '');
      return d >= schedulePeriodBounds.start && d <= schedulePeriodBounds.end && users.some(user => shiftMatchesPerson(shift, user, users));
    }).length;
    if (committedVisibleShifts.length) {
      setAutoFillVisibleShifts(prev => mergeVisibleScheduleShifts(prev, committedVisibleShifts));
    }
    setIsAutoPopulateModalOpen(false);
    setAutoPopSourceMonth('');
    addToast(
      visibleCommittedCount > 0 ? 'Populated' : 'Auto-Fill Saved Outside View',
      visibleCommittedCount > 0
        ? `Drafted ${committedCount} shifts across ${successfulBatchCount} batch(es). ${visibleCommittedCount} are visible in this schedule window. Checked ${sourceShifts.length} source shift(s). ${duplicateCount} duplicate(s), ${invalidCount} invalid, ${outsideTargetMonthCount} outside target month skipped.`
        : `Drafted ${committedCount} shifts, but none land in the currently visible schedule window (${formatDisplayDate(schedulePeriodBounds.start)} - ${formatDisplayDate(schedulePeriodBounds.end)}). Change the schedule date/window to view them. Checked ${sourceShifts.length} source shift(s). ${duplicateCount} duplicate(s), ${invalidCount} invalid.`
    );
  };

  // --- LABOR PROJECTION ENGINE ---
  const MAX_REASONABLE_SCHEDULE_SHIFT_MINUTES = 18 * 60;
  const parseScheduleClockInfo = (value) => {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim().toLowerCase().replace(/\s+/g, '');
    if (!raw) return null;
    if (['close', 'cl', 'closing'].includes(raw)) {
      return { minutes: (23 * 60) + 59, meridiem: '', raw, isClose: true, isOpen: false, hasMeridiem: false, is24Hour: true };
    }
    if (['open', 'opening'].includes(raw)) {
      return { minutes: 0, meridiem: '', raw, isClose: false, isOpen: true, hasMeridiem: false, is24Hour: true };
    }

    // Accept saved 24-hour values like 15:00 plus legacy/display values like 3p, 10a, 10:30pm.
    // The returned meridiem lets us reject impossible same-meridiem pairs like 10p-3p instead of adding 24 hours.
    const match = raw.match(/^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/);
    if (!match) return null;

    let hour = parseInt(match[1], 10);
    const minute = match[2] !== undefined ? parseInt(match[2], 10) : 0;
    const meridiem = match[3]?.startsWith('a') ? 'a' : match[3]?.startsWith('p') ? 'p' : '';
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return null;

    if (meridiem === 'p' && hour < 12) hour += 12;
    if (meridiem === 'a' && hour === 12) hour = 0;
    if (!meridiem && hour === 24) hour = 0;
    if (hour < 0 || hour > 23) return null;

    return { minutes: (hour * 60) + minute, meridiem, raw, isClose: false, isOpen: false, hasMeridiem: !!meridiem, is24Hour: !meridiem };
  };

  const parseScheduleClockMinutes = (value) => parseScheduleClockInfo(value)?.minutes ?? null;

  const getScheduleShiftTimeStatus = (shift = {}) => {
    const hasStart = shift.startTime !== undefined && shift.startTime !== null && String(shift.startTime).trim() !== '';
    const hasEnd = shift.endTime !== undefined && shift.endTime !== null && String(shift.endTime).trim() !== '';
    const startInfo = parseScheduleClockInfo(shift.startTime);
    const endInfo = parseScheduleClockInfo(shift.endTime);
    const displayRange = `${formatShortTime(shift.startTime) || shift.startTime || '?'}-${formatShortTime(shift.endTime) || shift.endTime || '?'}`;

    // 16.0.18: Bad schedule time ranges should be flagged for correction, not guessed or auto-repaired.
    // Example: 10p-3p is invalid because the end is before the start without a true overnight AM end.
    if (!hasStart || !hasEnd) {
      return { valid: false, interval: null, reason: 'Missing start or end time', displayRange };
    }
    if (!startInfo || !endInfo) {
      return { valid: false, interval: null, reason: 'Cannot read this time format', displayRange };
    }

    let startMinutes = startInfo.minutes;
    let endMinutes = endInfo.minutes;
    if (endMinutes <= startMinutes) {
      const explicitlyOvernight = shift.isOvernight === true || shift.overnight === true || shift.endsNextDay === true || shift.crossesMidnight === true;
      const meridiemOvernight = startInfo.meridiem === 'p' && endInfo.meridiem === 'a' && (startMinutes >= (18 * 60) || endMinutes <= (6 * 60));
      const twentyFourHourOvernight = startInfo.is24Hour && endInfo.is24Hour && startMinutes >= (18 * 60) && endMinutes <= (10 * 60);
      if (explicitlyOvernight || meridiemOvernight || twentyFourHourOvernight) {
        endMinutes += 24 * 60;
      } else {
        return { valid: false, interval: null, reason: 'Invalid time range: end time is before start time. Check AM/PM.', displayRange };
      }
    }

    const totalMinutes = endMinutes - startMinutes;
    if (totalMinutes <= 0) {
      return { valid: false, interval: null, reason: 'Invalid time range: shift has no hours.', displayRange };
    }
    if (totalMinutes >= MAX_REASONABLE_SCHEDULE_SHIFT_MINUTES) {
      return { valid: false, interval: null, reason: 'Invalid time range: shift is 18 hours or longer. Check AM/PM.', displayRange };
    }
    return { valid: true, interval: { start: startMinutes, end: endMinutes, minutes: totalMinutes }, reason: '', displayRange };
  };

  const getScheduleShiftInterval = (shift = {}) => getScheduleShiftTimeStatus(shift).interval;

  const calculateShiftHours = (start, end, shiftData = null) => {
    const interval = getScheduleShiftInterval(shiftData ? { ...shiftData, startTime: start, endTime: end } : { startTime: start, endTime: end });
    return interval ? interval.minutes / 60 : 0;
  };

  const getUniqueScheduledMinutesForShifts = (shiftList = []) => {
    const intervals = (shiftList || [])
      .map(getScheduleShiftInterval)
      .filter(Boolean)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    if (!intervals.length) return 0;

    const merged = [];
    intervals.forEach(interval => {
      const last = merged[merged.length - 1];
      if (last && interval.start <= last.end) {
        last.end = Math.max(last.end, interval.end);
      } else {
        merged.push({ start: interval.start, end: interval.end });
      }
    });
    return merged.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
  };

  const getUniqueScheduledHoursForShifts = (shiftList = []) => getUniqueScheduledMinutesForShifts(shiftList) / 60;

  let projectedMonthLabor = 0;
  const projectedDailyLabor = {};
  schedulePeriodDays.forEach(d => projectedDailyLabor[d] = 0);

  schedulePeriodDays.forEach(d => {
    displayUsers.forEach(emp => {
      const dayHours = getUniqueScheduledHoursForShifts(getScheduleBuilderRawShiftsForPersonDate(d, emp));
      if (!dayHours) return;
      const wage = parseFloat(emp?.wage || 0) || 0;
      const cost = dayHours * wage;
      projectedMonthLabor += cost;
      projectedDailyLabor[d] += cost;
    });
  });

  const periodPunches = timePunches.filter(p => p.date >= periodStart && p.date <= periodEnd).sort((a,b) => new Date(a.clockInTime || 0) - new Date(b.clockInTime || 0));
  
  const calculatePunchHours = (inTime, outTime, breakMins = 0) => {
      if (!inTime || !outTime) return 0;
      const rawMins = (new Date(outTime) - new Date(inTime)) / 60000;
      return Math.max(0, (rawMins - breakMins) / 60);
  };

  const getWeekStart = (dateString) => {
      const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
      const startDayInt = daysMap[appUser?.preferences?.payPeriodStart || 'Monday'];
      let d = new Date(dateString + 'T12:00:00');
      while (d.getDay() !== startDayInt) { d.setDate(d.getDate() - 1); }
      return d.toISOString().split('T')[0];
  };
  const payrollSummary = {};
  const weeklyHours = {}; 
  const OT_THRESHOLD = parseFloat(appUser?.systemSettings?.overtime || 40);

  periodPunches.forEach(p => {
      if (p.status === 'clocked_in' || !p.clockOutTime) return;
      
      const emp = users.find(u => u.id === p.employeeId);
      if (!payrollSummary[p.employeeId]) {
          payrollSummary[p.employeeId] = {
              name: p.employeeName || 'Unknown', regHours: 0, otHours: 0, cashTips: 0, creditTips: 0, rate: emp?.wage || 0, pay: 0
          };
      }
      
      const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
      const weekKey = `${p.employeeId}_${getWeekStart(p.date)}`;
      const prevWeeklyHours = weeklyHours[weekKey] || 0;
      const newWeeklyHours = prevWeeklyHours + hours;
      
      let reg = 0; let ot = 0;
      if (prevWeeklyHours >= OT_THRESHOLD) { ot = hours; } else if (newWeeklyHours > OT_THRESHOLD) { reg = OT_THRESHOLD - prevWeeklyHours; ot = newWeeklyHours - OT_THRESHOLD; } else { reg = hours; }
      
      weeklyHours[weekKey] = newWeeklyHours;
      payrollSummary[p.employeeId].regHours += reg; payrollSummary[p.employeeId].otHours += ot;
      payrollSummary[p.employeeId].cashTips += (parseFloat(p.cashTips) || 0); payrollSummary[p.employeeId].creditTips += (parseFloat(p.creditTips) || 0);
      
      const rate = emp?.wage || 0;
      payrollSummary[p.employeeId].pay += (reg * rate) + (ot * rate * 1.5);
  });
  
  const summaryList = Object.values(payrollSummary).sort((a, b) => a.name.localeCompare(b.name));
  const actualPeriodLabor = summaryList.reduce((acc, s) => acc + s.pay, 0);

  const handleForceClockOut = async (punch) => {
      if (!window.confirm(`Force clock out ${punch.employeeName}?`)) return;
      await updateDoc(doc(db, "timePunches", punch.id), { clockOutTime: new Date().toISOString(), status: 'clocked_out' });
      addToast('Updated', `Punched out ${punch.employeeName}.`);
  };

  const handleDeletePunch = async (id) => {
      if (!window.confirm("Delete this time punch permanently?")) return;
      await deleteDoc(doc(db, "timePunches", id));
      addToast('Deleted', 'Time punch removed.');
  };

const [isPunchModalOpen, setIsPunchModalOpen] = useState(false);
  const [editingPunch, setEditingPunch] = useState(null);
  const [editPunchEmpId, setEditPunchEmpId] = useState(''); // NEW: For creating punches
  const [editPunchIn, setEditPunchIn] = useState('');
  const [editPunchOut, setEditPunchOut] = useState('');
  const [editBreakMins, setEditBreakMins] = useState('');
  const [editCash, setEditCash] = useState('');
  const [editCredit, setEditCredit] = useState('');

  const openEditPunchModal = (punch) => {
    setEditingPunch(punch);
    const formatForInput = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    };
    setEditPunchIn(formatForInput(punch.clockInTime));
    setEditPunchOut(punch.clockOutTime && punch.status === 'clocked_out' ? formatForInput(punch.clockOutTime) : '');
    setEditBreakMins(punch.breakMinutes || 0);
    setEditCash(punch.cashTips || 0);
    setEditCredit(punch.creditTips || 0);
    setIsPunchModalOpen(true);
  };

  const openAddPunchModal = () => {
    setEditingPunch(null);
    setEditPunchEmpId('');
    setEditPunchIn('');
    setEditPunchOut('');
    setEditBreakMins('0');
    setEditCash('0');
    setEditCredit('0');
    setIsPunchModalOpen(true);
  };

  const handleSavePunchEdit = async (e) => {
    e.preventDefault();
    try {
      if (editingPunch) {
        if (!editPunchIn) return;
        const updateData = { clockInTime: new Date(editPunchIn).toISOString(), breakMinutes: parseFloat(editBreakMins) || 0, cashTips: parseFloat(editCash) || 0, creditTips: parseFloat(editCredit) || 0 };
        if (editPunchOut) { updateData.clockOutTime = new Date(editPunchOut).toISOString(); updateData.status = 'clocked_out'; } else { updateData.clockOutTime = null; updateData.status = 'clocked_in'; }
        await updateDoc(doc(db, "timePunches", editingPunch.id), updateData);
        addToast('Updated', 'Time punch modified successfully.');
      } else {
        if (!editPunchEmpId || !editPunchIn) return addToast('Error', 'Employee and Clock In Time required.');
        const emp = users.find(u => u.id === editPunchEmpId);
        const newData = {
          employeeId: emp.id,
          employeeName: emp.name,
          clockInTime: new Date(editPunchIn).toISOString(),
          breakMinutes: parseFloat(editBreakMins) || 0,
          cashTips: parseFloat(editCash) || 0,
          creditTips: parseFloat(editCredit) || 0,
          date: editPunchIn.split('T')[0], // Extract YYYY-MM-DD
          restaurantId: appUser.restaurantId
        };
        if (editPunchOut) { newData.clockOutTime = new Date(editPunchOut).toISOString(); newData.status = 'clocked_out'; } 
        else { newData.clockOutTime = null; newData.status = 'clocked_in'; }
        await addDoc(collection(db, "timePunches"), newData);
        addToast('Added', 'Missing time punch created.');
      }
      setIsPunchModalOpen(false);
      setEditingPunch(null);
    } catch (err) { addToast('Error', err.message); }
  };

const handleExportTimesheets = () => {
    if (periodPunches.length === 0) return addToast("Empty", "No punches to export for this period.");
    const pStartStr = new Date(periodStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const pEndStr = new Date(periodEnd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // Header for the Payroll Summary
    let csv = `"--- PAYROLL SUMMARY ---"\n"Pay Period: ${pStartStr} - ${pEndStr}"\n\n"Employee Name","Reg Hours","OT Hours","Hourly Rate","Total Gross Pay","Declared Cash Tips","Declared Credit Tips"\n`;
    summaryList.forEach(s => { 
      csv += `"${s.name}","${s.regHours.toFixed(2)}","${s.otHours.toFixed(2)}","$${s.rate.toFixed(2)}","$${s.pay.toFixed(2)}","$${s.cashTips.toFixed(2)}","$${s.creditTips.toFixed(2)}"\n`; 
    });
    
    // Header for Individual Punches
    csv += '\n"--- INDIVIDUAL PUNCHES ---"\n"Employee Name","Date","Clock In","Clock Out","Break (Mins)","Total Hours","Hourly Rate","Total Pay","Cash Tips","Credit Tips"\n';
    
    const sortedPunches = [...periodPunches].sort((a,b) => new Date(b.clockInTime || 0) - new Date(a.clockInTime || 0));
    sortedPunches.forEach(p => {
       const emp = users.find(u => u.id === p.employeeId); 
       const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0); 
       const rate = emp?.wage || 0; 
       const estCost = hours * rate; 
       const inStr = p.clockInTime ? formatClockTime(p.clockInTime) : 'Unknown';
       const outStr = p.status === 'clocked_in' ? 'ON CLOCK' : (p.clockOutTime ? formatClockTime(p.clockOutTime) : 'Unknown');
       
       csv += `"${p.employeeName || 'Unknown'}","${p.date || 'Unknown'}","${inStr}","${outStr}","${p.breakMinutes||0}","${hours.toFixed(2)}","$${rate.toFixed(2)}","$${estCost.toFixed(2)}","$${parseFloat(p.cashTips||0).toFixed(2)}","$${parseFloat(p.creditTips||0).toFixed(2)}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); 
    link.setAttribute("href", url); 
    link.setAttribute("download", `${getRestaurantExportPrefix(appUser)}-Payroll-Export-${periodStart}-to-${periodEnd}.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
    URL.revokeObjectURL(url); 
    addToast('Exported', 'Spreadsheet generated with the restaurant name in the filename.');
  };

  const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
  const startDayInt = daysMap[appUser?.preferences?.payPeriodStart || 'Monday'];
  const endDayInt = startDayInt === 0 ? 6 : startDayInt - 1;

  const addScheduleDays = (dateKey, offset) => {
    const date = new Date(`${dateKey}T12:00:00`);
    date.setDate(date.getDate() + offset);
    return formatDate(date);
  };
  const getScheduledHoursWeekStart = (dateKey) => {
    const date = new Date(`${dateKey}T12:00:00`);
    while (date.getDay() !== startDayInt) date.setDate(date.getDate() - 1);
    return formatDate(date);
  };
  const formatScheduledHoursWeekRange = (week) => {
    if (!week?.start || !week?.end) return '';
    const start = new Date(`${week.start}T12:00:00`);
    const end = new Date(`${week.end}T12:00:00`);
    const sameMonth = week.start.substring(0, 7) === week.end.substring(0, 7);
    if (sameMonth) return `${start.getDate()}-${end.getDate()}`;
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };
  const formatScheduledHoursWeekRangeCompact = (week) => {
    if (!week?.start || !week?.end) return '';
    const start = new Date(`${week.start}T12:00:00`);
    const end = new Date(`${week.end}T12:00:00`);
    return `${start.getMonth() + 1}/${start.getDate()}-${end.getMonth() + 1}/${end.getDate()}`;
  };

  const maxDateKey = (a = '', b = '') => String(a || '') >= String(b || '') ? String(a || '') : String(b || '');
  const minDateKey = (a = '', b = '') => String(a || '') <= String(b || '') ? String(a || '') : String(b || '');

  const scheduledHoursWeekBlocks = [];
  let hoursWeekStart = getScheduledHoursWeekStart(schedulePeriodBounds.start);
  const lastHoursWeekStart = getScheduledHoursWeekStart(schedulePeriodBounds.end);
  while (hoursWeekStart <= lastHoursWeekStart && scheduledHoursWeekBlocks.length < 12) {
    const fullWeekStart = hoursWeekStart;
    const fullWeekEnd = addScheduleDays(hoursWeekStart, 6);
    const visibleWeekStart = maxDateKey(fullWeekStart, schedulePeriodBounds.start);
    const visibleWeekEnd = minDateKey(fullWeekEnd, schedulePeriodBounds.end);
    if (visibleWeekStart <= visibleWeekEnd) {
      scheduledHoursWeekBlocks.push({
        // Scheduled Hours Tracker follows pay-period weeks, not just visible month days.
        // Example: August Week 1 may need to count Jul 27-Jul 31 plus Aug 1-Aug 2.
        start: fullWeekStart,
        end: fullWeekEnd,
        visibleStart: visibleWeekStart,
        visibleEnd: visibleWeekEnd,
        fullStart: fullWeekStart,
        fullEnd: fullWeekEnd,
        days: buildDateRange(fullWeekStart, fullWeekEnd)
      });
    }
    hoursWeekStart = addScheduleDays(hoursWeekStart, 7);
  }
  const getScheduledHoursDayAudit = (dateKey, person) => {
    const rawShifts = getScheduledHoursTrackerRawShiftsForPersonDate(dateKey, person);
    const visibleShifts = dedupeScheduleShiftsForSamePerson(rawShifts);
    const validShifts = visibleShifts.map(shift => ({ shift, status: getScheduleShiftTimeStatus(shift) })).filter(item => item.status.valid);
    const invalidShifts = visibleShifts.map(shift => ({ shift, status: getScheduleShiftTimeStatus(shift) })).filter(item => !item.status.valid);
    const hours = getUniqueScheduledHoursForShifts(visibleShifts);
    return { date: dateKey, rawShifts, visibleShifts, validShifts, invalidShifts, hours };
  };

  const formatScheduledHoursDayAuditLine = (audit = {}) => {
    const dayLabel = audit.date ? new Date(`${audit.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }) : 'Unknown day';
    const counted = audit.validShifts?.map(({ status }) => status.displayRange).join(', ') || 'none';
    const invalid = audit.invalidShifts?.map(({ status }) => `${status.displayRange} INVALID`).join(', ');
    return `${dayLabel}: ${audit.hours.toFixed(1)}h counted (${counted})${invalid ? ` | Not counted: ${invalid}` : ''}`;
  };

  const formatScheduledHoursWeekAudit = (person, week, totalHours = 0) => {
    const dayAudits = (week?.days || []).map(d => getScheduledHoursDayAudit(d, person)).filter(audit => audit.visibleShifts.length || audit.invalidShifts.length);
    const lines = [`${person?.name || 'Employee'} Pay-period week ${formatScheduledHoursWeekRange(week)} total: ${totalHours.toFixed(1)}h`];
    if (!dayAudits.length) lines.push('No scheduled shift hours counted for this week.');
    dayAudits.forEach(audit => lines.push(formatScheduledHoursDayAuditLine(audit)));
    return lines.join('\n');
  };

  const scheduledHours = displayUsers.map(u => {
     const weekly = scheduledHoursWeekBlocks.map(week => week.days.reduce((sum, d) => {
       const audit = getScheduledHoursDayAudit(d, u);
       return sum + audit.hours;
     }, 0));
     return { id: u.id, name: u.name, person: u, weekly, total: weekly.reduce((a,b)=>a+b,0) };
  }).filter(u => u.total > 0);

  const pendingTimeOffAlertRequests = timeOffRequests.filter(r => r.status === 'pending' && r.date >= schedulePeriodBounds.start && r.date <= schedulePeriodBounds.end);
  const pendingTimeOffAlertMemory = useRememberedAlert({
    user: appUser,
    workspaceId: clientData?.id || clientData?.restaurantId || appUser?.restaurantId,
    alertId: 'pending-time-off-manager-warning',
    fingerprint: buildAlertFingerprint(
      schedulePeriodBounds.start,
      schedulePeriodBounds.end,
      pendingTimeOffAlertRequests
        .map(request => `${request.id || ''}:${request.date || ''}:${request.updatedAt || request.createdAt || ''}`)
        .sort()
    )
  });

  return (
    <div className="space-y-4 pb-12 w-full">

{/* MANAGER EXPLANATION BANNER */}
      {pendingTimeOffAlertRequests.length > 0 && !pendingTimeOffAlertMemory.isDismissed && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl flex items-center justify-between gap-4 shadow-lg animate-[slideIn_0.2s_ease-out]">
          <div className="flex items-center gap-3 min-w-0">
            <Shield className="text-red-500 flex-shrink-0" size={24} />
            <div className="min-w-0">
              <h3 className="text-red-400 font-black text-sm uppercase tracking-widest">Time-Off Requests Waiting</h3>
              <p className="text-xs text-red-200/80 font-medium mt-0.5">
                {pendingTimeOffAlertRequests.length} request{pendingTimeOffAlertRequests.length === 1 ? '' : 's'} need review. Go to <strong className="text-white">My Shift {'->'} Request Off</strong> when you are ready.
              </p>
            </div>
          </div>
          <button type="button" onClick={pendingTimeOffAlertMemory.dismiss} className="flex-shrink-0 rounded-xl border border-red-500/40 bg-red-950/50 p-2 text-red-200 hover:bg-red-900/60 hover:text-white" title="Dismiss this warning"><X size={18}/></button>
        </div>
      )}

    
      {/* --- AUTO POPULATE MODAL --- */}
      <Modal isOpen={isAutoPopulateModalOpen} onClose={() => setIsAutoPopulateModalOpen(false)} title="Auto-Populate Schedule">
        <div className="space-y-4">
          <p className="text-xs text-slate-300 font-bold leading-relaxed">
            Select a previous month to copy shifts from. <br/><br/>
            <span className="text-[#D4A381]">Smart Mapping:</span> Days will automatically align to match the correct day of the week (e.g. 1st Monday to 1st Monday). All copied shifts will be added as unpublished drafts.
          </p>
          <div>
            <label className={T.label}>Source Month</label>
            <input type="month" value={autoPopSourceMonth} onChange={e=>setAutoPopSourceMonth(e.target.value)} className={T.input} />
          </div>
          <button onClick={handleAutoPopulate} className={`w-full ${T.btn} py-3`}>Copy Schedule</button>
        </div>
      </Modal>

      <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title={editingEventId ? "Edit Special Event" : "Add Special Event"}>
        <form onSubmit={handleAddEvent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={T.label}>Date</label><input type="date" min={!editingEventId ? getToday() : undefined} value={eventDate} onChange={e=>{ const nextDate = e.target.value; if (!editingEventId && isPastEventDate(nextDate)) { addToast('Past Date Locked', 'Events can only be added for today or a future date.'); setEventDate(getToday()); setNewEventReminderDate(getToday()); return; } setEventDate(nextDate); if (!editingEventId) setNewEventReminderDate(nextDate || getToday()); }} className={T.input} required/></div>
         <div>
              <label className={T.label}>Time (Optional)</label>
              <input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} className={T.input}/>
            </div>
          </div>
<div><label className={T.label}>Event Title</label><input type="text" value={eventTitle} onChange={e=>setEventTitle(e.target.value)} className={T.input} placeholder="e.g., Packers Playoff Game" required/></div>
        
        {!editingEventId && (
          <div className="bg-[#12161A] p-3 rounded-xl border border-[#2A353D]">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer mb-2">
              <input type="checkbox" checked={isRepeating} onChange={e => setIsRepeating(e.target.checked)} className="w-4 h-4 rounded bg-[#1A2126] border-[#2A353D] accent-[#8F6040]" />
              Make this a repeating event
            </label>
            
            {isRepeating && (
              <div className="grid grid-cols-2 gap-3 mt-3 animate-[slideIn_0.2s_ease-out]">
                <div>
                  <label className={T.label}>Repeats Every</label>
                  <select value={repeatType} onChange={e => setRepeatType(e.target.value)} className={T.input}>
                    <option value="daily">Day</option>
                    <option value="weekly">Week</option>
                    <option value="bi-weekly">Two Weeks</option>
                    <option value="monthly">Month</option>
                    <option value="yearly">Year</option>
                  </select>
                </div>
                <div>
                  <label className={T.label}>Until Date</label>
                  <input type="date" min={eventDate} value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} className={T.input} required={isRepeating} />
                </div>
              </div>
            )}
          </div>
        )}

          <div className="bg-[#12161A] p-3 rounded-xl border border-[#2A353D] space-y-3">
            <div className="flex flex-col gap-3">
              <div>
                <label className={T.label}>Push Reminders</label>
                <p className={`text-[10px] font-bold ${T.muted}`}>Add reminder offsets or pick the exact day and time the push should fire.</p>
              </div>
              <div>
                <label className={T.label}>Who Gets Event Pushes</label>
                <select value={eventReminderRecipientMode} onChange={e=>setEventReminderRecipientMode(e.target.value)} className={T.input}>
                  <option value="creator">Just me</option>
                  <option value="managers">Managers / ordering users</option>
                  {(appUser?.isAdmin || appUser?.permissions?.schedule || appUser?.permissions?.events) && <option value="team">Entire active team</option>}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[.7fr_1fr_auto] gap-2 items-end">
                <div>
                  <label className={T.label}>Reminder Type</label>
                  <select value={newEventReminderMode} onChange={e=>setNewEventReminderMode(e.target.value)} className={T.input}>
                    <option value="offset">Before event</option>
                    <option value="absolute">Specific day/time</option>
                  </select>
                </div>
                {newEventReminderMode === 'offset' ? (
                  <div>
                    <label className={T.label}>When</label>
                    <select value={newEventReminderOffset} onChange={e=>setNewEventReminderOffset(e.target.value)} className={T.input}>{eventReminderOptions.map(opt => <option key={opt.minutes} value={opt.minutes}>{opt.label}</option>)}</select>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={T.label}>Reminder Day</label><input type="date" value={newEventReminderDate} onChange={e=>setNewEventReminderDate(e.target.value)} className={T.input}/></div>
                    <div><label className={T.label}>Reminder Time</label><input type="time" value={newEventReminderTime} onChange={e=>setNewEventReminderTime(e.target.value)} className={T.input}/></div>
                  </div>
                )}
                <button type="button" onClick={addEventReminderOffset} className={T.btnAlt}>Add</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">{eventPushReminders.length === 0 && <span className="text-xs font-bold text-slate-500">No push reminders yet.</span>}{eventPushReminders.map(rem => <button type="button" key={getEventReminderKey(rem)} onClick={() => removeEventReminderOffset(rem)} className="text-[10px] font-black uppercase tracking-widest rounded-full border border-[#2A353D] bg-[#0B0E11] text-slate-300 px-3 py-1 text-left">{labelEventReminder(rem)} ×</button>)}</div>
          </div>

          <div className="bg-[#12161A] p-3 rounded-xl border border-[#2A353D] space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer"><input type="checkbox" checked={orderReminderEnabled} onChange={e=>setOrderReminderEnabled(e.target.checked)} className="w-4 h-4 rounded bg-[#1A2126] border-[#2A353D] accent-[#8F6040]" />Order Reminder</label>
            {orderReminderEnabled && <><p className={`text-[10px] font-bold ${T.muted}`}>Starts one week before the event and fires only on selected cutoff days. Uses the same recipients selected in Push Reminders.</p><div className="flex flex-wrap gap-2">{orderReminderWeekdays.map(day => <button type="button" key={day} onClick={() => toggleOrderReminderDay(day)} className={orderReminderDays.includes(day) ? T.btn : T.btnAlt}>{day.slice(0,3)}</button>)}</div></>}
          </div>

          <div>
            <label className={T.label}>Notes & Photo (Optional)</label>
            <textarea rows="2" value={eventNotes} onChange={e=>setEventNotes(e.target.value)} className={`${T.input} mb-2`} placeholder="Extra details..."/>
            
            {eventImageFile && (
              <div className="text-xs text-emerald-400 font-bold bg-emerald-900/20 p-2 rounded-lg border border-emerald-900/50 flex justify-between items-center mb-2">
                <span className="truncate pr-2">📷 {eventImageFile.name} attached</span>
                <button type="button" onClick={()=>setEventImageFile(null)} className="text-red-400 hover:text-red-300 p-1"><X size={14}/></button>
              </div>
            )}
            
            <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full">
              <div className={`flex flex-1 sm:flex-none bg-[#12161A] border border-[#2A353D] rounded-xl overflow-hidden shadow-sm h-12 ${isEventUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="flex-1 sm:w-16 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors border-r border-[#2A353D] text-[#D4A381]" title="Take Photo">
                    <Camera size={20} />
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => setEventImageFile(e.target.files[0])} className="hidden" disabled={isEventUploading} />
                 </label>
                 <label className="flex-1 sm:w-20 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors text-[#D4A381]" title="Upload Photo">
                    <span className="text-[10px] font-black uppercase tracking-wider">Upload</span>
                    <input type="file" accept="image/*" onChange={(e) => setEventImageFile(e.target.files[0])} className="hidden" disabled={isEventUploading} />
                 </label>
              </div>
              <button type="submit" disabled={isEventUploading || !eventTitle.trim()} className={`flex-1 sm:flex-1 ${T.btn} h-12 disabled:opacity-50 flex items-center justify-center`}>
                {isEventUploading ? <Loader2 className="animate-spin" size={20}/> : (editingEventId ? 'Update Event' : 'Save Event')}
              </button>
            </div>
          </div>
        </form>
      </Modal>

<Modal isOpen={isPunchModalOpen} onClose={()=>setIsPunchModalOpen(false)} title={editingPunch ? `Edit Punch: ${editingPunch?.employeeName}` : "Add Missing Time Punch"}>
        <form onSubmit={handleSavePunchEdit} className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
          {!editingPunch && (
            <div>
              <label className={T.label}>Select Employee</label>
              <select value={editPunchEmpId} onChange={e=>setEditPunchEmpId(e.target.value)} className={T.input} required>
                <option value="">-- Select Staff Member --</option>
                {users.filter(u => u.isActive !== false).sort((a,b) => a.name.localeCompare(b.name)).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={T.label}>Clock In Time</label>
              <input type="datetime-local" value={editPunchIn} onChange={e=>setEditPunchIn(e.target.value)} className={T.input} required/>
            </div>
            <div>
              <label className={T.label}>Clock Out Time (Leave blank if currently on clock)</label>
              <input type="datetime-local" value={editPunchOut} onChange={e=>setEditPunchOut(e.target.value)} className={T.input}/>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={T.label}>Break (Mins)</label>
              <input type="number" min="0" value={editBreakMins} onChange={e=>setEditBreakMins(e.target.value)} className={T.input}/>
            </div>
            <div>
              <label className={T.label}>Cash Tips ($)</label>
              <input type="number" step="0.01" min="0" value={editCash} onChange={e=>setEditCash(e.target.value)} className={T.input}/>
            </div>
            <div>
              <label className={T.label}>Credit Tips ($)</label>
              <input type="number" step="0.01" min="0" value={editCredit} onChange={e=>setEditCredit(e.target.value)} className={T.input}/>
            </div>
          </div>
          <button type="submit" className={`w-full ${T.btn}`}>{editingPunch ? 'Save Changes' : 'Create Time Punch'}</button>
        </form>
      </Modal>

      {/* --- PRESET MANAGER MODAL --- */}
      <Modal isOpen={isPresetModalOpen} onClose={() => { setIsPresetModalOpen(false); cancelPresetEdit(); }} title="Manage Custom Shifts">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 pb-10">
            {customPresetSyncMessage && <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${customPresetSyncStatus === 'error' ? 'border-red-800/60 bg-red-950/20 text-red-100' : customPresetSyncStatus === 'offline' ? 'border-amber-700/50 bg-amber-950/20 text-amber-100' : 'border-emerald-800/50 bg-emerald-950/20 text-emerald-100'}`}>{customPresetSyncMessage}</div>}
            <form id="preset-modal-form" onSubmit={handleSavePreset} className="space-y-3 p-4 bg-[#1A2126] border border-[#2A353D] rounded-xl">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-black text-[#D4A381] uppercase tracking-widest">{editingPresetId ? 'Edit Preset' : 'Add New Preset'}</h4>
                    {editingPresetId && <button type="button" onClick={cancelPresetEdit} className="text-xs font-bold text-slate-400 hover:text-white transition-colors">Cancel ✖</button>}
                </div>
                <div>
                    <label className={T.label}>Label (e.g., "Mid Shift 12p-5p")</label>
                    <input type="text" value={newPresetLabel} onChange={e=>setNewPresetLabel(e.target.value)} className={T.input} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={T.label}>Start Time</label>
                        <select value={newPresetStart} onChange={e=>setNewPresetStart(e.target.value)} className={T.input} required>
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatShortTime(t)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={T.label}>End Time</label>
                        <select value={newPresetEnd} onChange={e=>setNewPresetEnd(e.target.value)} className={T.input} required>
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatShortTime(t)}</option>)}
                        </select>
                    </div>
                </div>
                <button type="submit" className={`w-full ${T.btn} py-3 text-sm flex items-center justify-center`}><Plus size={18} className="inline mr-2"/> {editingPresetId ? 'Update Preset' : 'Save Custom Time'}</button>
            </form>

            <div className="space-y-2 pt-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-[#2A353D] pb-2">Your Custom Shifts</h4>
                {customPresets.length === 0 && <p className="text-xs font-bold text-slate-500 text-center p-4 border border-dashed border-[#2A353D] rounded-xl">No custom times added yet.</p>}
                {customPresets.map(preset => (
                    <div key={preset.id} className="flex justify-between items-center bg-[#12161A] p-3 rounded-lg border border-[#2A353D]">
                        <div>
                            <div className="font-bold text-base text-white">{preset.label}</div>
                            <div className="text-xs font-mono font-bold text-[#D4A381]">{formatShortTime(preset.start)} - {formatShortTime(preset.end)}</div>
                        </div>
                        <div className="flex items-center gap-1 border-l border-[#2A353D] pl-2 ml-2">
                            <button type="button" onClick={() => handleEditPreset(preset)} className="p-2 text-slate-400 hover:text-[#D4A381] transition-colors bg-[#1A2126] rounded border border-[#2A353D]">
                                <Edit size={16}/>
                            </button>
                            <button type="button" onClick={() => handleDeletePreset(preset.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-[#1A2126] rounded border border-[#2A353D]">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </Modal>

      <Modal isOpen={isPublishPickerOpen} onClose={() => setIsPublishPickerOpen(false)} title="Choose What to Publish" sizeClass="max-w-2xl">
        <div className="space-y-4">
          <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Publish safely</div>
            <p className="mt-1 text-xs font-bold text-slate-300 leading-snug">Choose the weeks you want to publish. Any week you leave unchecked stays as a draft.</p>
            <div className="mt-2 text-[11px] font-black text-white">{fullPublishDrafts.length} draft shift{fullPublishDrafts.length === 1 ? '' : 's'} in {schedulePeriodLabel}</div>
          </div>

          <div className="space-y-2">
            {publishWeekOptions.map(option => {
              const checked = selectedPublishWeekKeys.includes(option.key);
              const disabled = option.draftCount === 0;
              return (
                <label key={option.key} className={`flex items-center gap-3 rounded-xl border p-3 transition ${checked ? 'border-[#D4A381] bg-[#D4A381]/10' : 'border-[#2A353D] bg-[#12161A]'} ${disabled ? 'opacity-55' : 'cursor-pointer hover:border-[#D4A381]/70'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => togglePublishWeek(option.key)}
                    className="h-5 w-5 accent-[#D4A381]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-white">{option.label}: {publishDateLabel(option.start, option.end)}</span>
                    <span className="block text-[11px] font-bold text-slate-400">{option.draftCount} draft • {option.liveCount} live</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="rounded-xl border border-[#2A353D] bg-[#0B0E11] p-3 text-xs font-bold text-slate-300">
            Selected: <span className="text-white">{selectedPublishCandidateCount}</span> shift{selectedPublishCandidateCount === 1 ? '' : 's'} to verify/publish
            {selectedPublishWeeks.length > 0 && <span className="block mt-1 text-[11px] text-slate-400">{selectedPublishLabel}</span>}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={() => handlePublish('selected-weeks')} disabled={selectedPublishCandidateCount === 0} className={`${T.btn} flex-1 py-3 disabled:opacity-50`}>Publish Selected Weeks</button>
            <button type="button" onClick={() => handlePublish('full-period')} disabled={fullPublishCandidateCount === 0} className={`${T.btnAlt} flex-1 py-3`}>Publish Full Schedule</button>
            <button type="button" onClick={() => setIsPublishPickerOpen(false)} className={`${T.btnAlt} flex-1 py-3`}>Cancel</button>
          </div>
        </div>
      </Modal>

{/* TOP NAVIGATION TOGGLE */}
      {!hideSubTabs && (
        <div className="flex flex-wrap gap-1.5 border-b border-[#2A353D] pb-2 mb-2">
          <button onClick={() => setSubTab('schedule')} className={`px-3 py-1.5 text-[10px] sm:text-xs font-black rounded-lg uppercase tracking-widest transition-all ${subTab === 'schedule' ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>Schedule Builder</button>
          <span className="text-[10px] font-bold text-slate-500 self-center">Labor and punch editing moved to the Labor tab.</span>
        </div>
      )}

      {subTab === 'schedule' && (
        <div className="schedule-builder-workbench space-y-3 animate-[slideIn_0.2s_ease-out]">
          
          <div className={`schedule-builder-publish-strip ${T.card} p-1.5 border-[#D4A381]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2`}>
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-[#D4A381]">Schedule Publishing Window</div>
              <div className="text-xs font-black text-white">{schedulePeriodLabel}</div>
              <div className="text-[10px] font-bold text-slate-500 mt-0.5">Change this in Settings → Workspace → Schedule Publishing.</div>
              <div className="text-[10px] font-bold text-slate-400 mt-0.5">Publish downloads a schedule backup. Time Clock / Labor exports CSV for payroll review.</div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-[#12161A] border border-[#2A353D] rounded-xl px-2 py-1.5">{schedulePeriodShifts.filter(s => !isScheduleShiftPublished(s)).length} draft • {schedulePeriodShifts.filter(s => isScheduleShiftPublished(s)).length} live • {schedulePeriodEvents.length} event{schedulePeriodEvents.length === 1 ? '' : 's'} shown</div>
          </div>

          <div className={`schedule-builder-control-deck ${T.card} p-1.5 sm:p-2 flex flex-col lg:flex-row gap-1.5 items-stretch lg:items-center justify-between`}>
            <div className="schedule-builder-assignment-row flex flex-wrap xl:flex-nowrap gap-1.5 w-full lg:w-auto items-center">
              
              {/* Staff Selector */}
              <select value={selectedEmp} onChange={e=>{setSelectedEmp(e.target.value); setAssignDates([]);}} className={`${T.input} schedule-builder-compact-control w-full sm:w-auto sm:flex-1 xl:w-36 py-1.5 px-2 text-xs font-bold h-9 shadow-inner shrink-0`}>
                <option value="">-- Select Staff --</option>
                {displayUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              
              {/* Preset Selector & Edit Button */}
              <div className="flex gap-2 items-center w-full sm:w-auto sm:flex-1 xl:w-auto shrink-0">
                <select value={presetShift} onChange={handlePresetChange} className={`${T.input} schedule-builder-compact-control w-full py-1.5 px-2 text-xs font-bold h-9 shadow-inner`}>
                  {SHIFT_PRESETS.map(p=><option key={p.id || p.label} value={p.label}>{p.label}</option>)}
                </select>
                <button onClick={() => setIsPresetModalOpen(true)} className="schedule-builder-icon-control px-2 bg-[#12161A] text-slate-400 hover:text-[#D4A381] border border-[#2A353D] rounded-xl transition-colors h-9 flex items-center justify-center shrink-0 shadow-sm" title="Edit Presets">
                  <Edit size={18} />
                </button>
              </div>

        {/* Custom Time Overrides */}
              <div className="schedule-builder-time-control-row flex gap-1.5 w-full sm:w-auto sm:flex-1 xl:w-auto shrink-0">
                <div className="schedule-builder-time-field relative flex-1 xl:w-32">
                    <span className="schedule-builder-time-label absolute -top-2.5 left-2 bg-[#1A2126] px-1 text-[9px] font-black text-[#D4A381] uppercase tracking-widest">In</span>
                    <input
                      type="time"
                      value={startTime}
                      aria-label={`Schedule Builder start time ${formatShortTime(startTime)}`}
                      title={`Start time: ${formatShortTime(startTime)}`}
                      onChange={e=>{setStartTime(e.target.value);setPresetShift('Custom');}}
                      className={`${T.input} schedule-builder-compact-control schedule-builder-time-input w-full py-1.5 px-3 text-sm font-black h-9 shadow-inner`}
                    />
                </div>
                <div className="schedule-builder-time-field relative flex-1 xl:w-32">
                    <span className="schedule-builder-time-label absolute -top-2.5 left-2 bg-[#1A2126] px-1 text-[9px] font-black text-[#D4A381] uppercase tracking-widest">Out</span>
                    <input
                      type="time"
                      value={endTime}
                      aria-label={`Schedule Builder end time ${formatShortTime(endTime)}`}
                      title={`End time: ${formatShortTime(endTime)}`}
                      onChange={e=>{setEndTime(e.target.value);setPresetShift('Custom');}}
                      className={`${T.input} schedule-builder-compact-control schedule-builder-time-input w-full py-1.5 px-3 text-sm font-black h-9 shadow-inner`}
                    />
                </div>
              </div>

              {/* Assign Button */}
              <button onClick={handleAssign} disabled={isAssigningShift||!selectedEmp||assignDates.length===0} className={`schedule-builder-assign-button w-full xl:w-auto ${T.btn} py-1.5 px-2 text-xs h-9 disabled:opacity-50 flex items-center justify-center shadow-lg shrink-0 whitespace-nowrap`}>{isAssigningShift ? 'Assigning…' : `Assign (${assignDates.length})`}</button>

            </div>
            
            {/* Action Row */}
            <div className="schedule-builder-action-row flex w-full lg:w-auto gap-2 items-center pt-1.5 lg:pt-0 border-t lg:border-t-0 border-[#2A353D]">
              <div className="schedule-builder-labor-pill hidden sm:flex flex-col items-end mr-2 bg-[#12161A] border border-[#2A353D] px-2 py-1 rounded-xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Proj. Period Labor</span>
                <span className="text-emerald-400 font-black text-base">${projectedMonthLabor.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
<button onClick={() => setIsAutoPopulateModalOpen(true)} className={`schedule-builder-action-button flex-1 lg:flex-none ${T.btnAlt} py-1.5 h-9 flex items-center justify-center font-black border-blue-900/50 text-blue-400`}>
                <Repeat size={16} className="mr-1"/> Auto-Fill
              </button>              <button onClick={openPublishPicker} className={`schedule-builder-action-button flex-1 lg:flex-none ${T.btnAlt} py-1.5 h-9 flex items-center justify-center font-black`}>Publish</button>
              <button onClick={openNewEventModal} className={`schedule-builder-action-button flex-1 lg:flex-none ${T.btnAlt} border-[#D4A381] text-[#D4A381] py-1.5 h-9 flex items-center justify-center font-black`}><Plus size={16} className="mr-1"/> Event</button>
            </div>
          </div>

          <div className={`schedule-builder-grid-card ${T.card} w-full overflow-hidden`}>
            <div className="overflow-x-auto w-full no-scrollbar">
              <table className="schedule-builder-desktop-table w-full text-left text-[10px] border-collapse table-fixed min-w-[1200px] xl:min-w-full" style={{ '--schedule-builder-min-width': `${82 + (schedulePeriodDays.length * 56)}px` }}>
                <thead>
                  <tr className="bg-[#12161A] border-b border-[#2A353D]">
                    <th className={`p-1 sm:p-2 font-bold bg-[#12161A] sticky left-0 z-20 w-16 sm:w-24 border-r border-[#2A353D] ${T.copper} truncate`}>Staff</th>
                    {schedulePeriodDays.map(d => {
                      const holiday = getHoliday(d);
                      const dayEvents = schedulePeriodEvents.filter(e => e.date === d);
                      const hasAlert = holiday || dayEvents.length > 0;
                      
                      return (
                      <th key={d} className={`p-0.5 sm:p-1 text-center border-r border-[#2A353D] align-top relative group cursor-help ${new Date(d+'T12:00').getDay()%6===0?'bg-[#1A2126]':''}`}>
                        <div className={`font-bold uppercase text-[8px] sm:text-[9px] tracking-tight ${T.muted}`}>{new Date(d+'T12:00').toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()}</div>
                        <div className={`text-xs sm:text-sm font-black mt-0.5 ${hasAlert ? (holiday ? 'text-amber-400' : 'text-red-400') : 'text-white'}`}>
                          {parseInt(d.split('-')[2])}
                        </div>
                        
                        {hasAlert && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-32 bg-[#1A2126] border border-[#D4A381] text-white text-[10px] p-2 rounded shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 pointer-events-none transition-all">
                            {holiday && <div className="text-amber-400 font-black mb-1 leading-tight">{holiday}</div>}
                            {dayEvents.map(ev => (
                              <div key={ev.id} className="text-red-400 font-bold leading-tight mt-1 border-t border-[#2A353D] pt-1">
                                {ev.title} {ev.time && <span className="block text-white opacity-80">{formatShortTime(ev.time)}</span>}
                                {ev.notes && <span className="block text-slate-300 font-normal mt-0.5">{ev.notes}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </th>
                    )})}
                  </tr>
                </thead>
              <tbody className="divide-y divide-[#2A353D]">
                  {schedulePeriodEvents.length > 0 && (
                    <tr className="schedule-builder-events-row bg-amber-950/10">
                      <td className="schedule-builder-events-label px-2 py-1 text-[8px] font-black uppercase tracking-widest text-amber-200 sticky left-0 z-10 border-r border-[#2A353D] bg-[#141920] shadow-md">
                        Events
                        <span className="block text-[7px] text-amber-400/80 tracking-normal normal-case">staff up</span>
                      </td>
                      {schedulePeriodDays.map(d => {
                        const dayEvents = eventsByScheduleDay[d] || [];
                        return (
                          <td key={`events-${d}`} className={`schedule-builder-events-cell p-0.5 border-r border-[#2A353D] align-top ${dayEvents.length ? 'bg-amber-900/10' : 'bg-[#0B0E11]/40'}`}>
                            <div className="flex flex-col gap-[2px] min-h-[20px]">
                              {dayEvents.slice(0, 2).map(ev => (
                                <button
                                  key={ev.id || `${d}-${ev.title}-${ev.time}`}
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); openEditEventModal(ev); }}
                                  className="schedule-builder-event-chip w-full min-w-[42px] min-h-[42px] rounded border border-amber-500/45 bg-amber-500/18 text-amber-100 font-black text-[7px] sm:text-[8px] leading-tight px-1 py-0.5 text-left truncate hover:bg-amber-500/30"
                                  title={formatScheduleBuilderEventTitle(ev)}
                                >
                                  {formatScheduleBuilderEventLabel(ev)}
                                </button>
                              ))}
                              {dayEvents.length > 2 && (
                                <div className="schedule-builder-event-more rounded bg-amber-900/40 text-amber-200 text-[7px] font-black text-center" title={dayEvents.map(formatScheduleBuilderEventTitle).join(' | ')}>+{dayEvents.length - 2} more</div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )}
                  {sortedRoles.map(role => (
                    <React.Fragment key={`role-group-${role}`}>
                      <tr className="bg-[#1A2126]">
                        <td colSpan={schedulePeriodDays.length + 1} className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest ${T.copper} border-b border-[#2A353D] sticky left-0 z-10`}>
                          {role}
                        </td>
                      </tr>
                      {groupedUsers[role].sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(u => (
                        <tr key={u.id} className={selectedEmp===u.id?'bg-[#12161A]/50':''}>
                          <td onClick={()=>{setSelectedEmp(u.id);setAssignDates([]);}} className={`px-2 py-1 text-xs font-bold sticky left-0 z-10 border-r border-[#2A353D] cursor-pointer truncate shadow-sm ${selectedEmp===u.id?`${T.grad} text-slate-900`:'bg-[#1A2126] text-white'}`}>{u.name || 'Unnamed'}</td>
                          {schedulePeriodDays.map(d => {
                            const dayShifts = getScheduleBuilderShiftsForPersonDate(d, u);
                            const req = timeOffRequests.find(r => r.date === d && timeOffMatchesPerson(r, u) && isActiveTimeOffRequest(r)); 
                            const sel = assignDates.includes(d) && selectedEmp===u.id;

                            // Conflict Check: Alert if a shift overlaps with ANY time-off request (pending or approved)
                            const allUserReqs = timeOffRequests.filter(r => r.date === d && timeOffMatchesPerson(r, u) && isActiveTimeOffRequest(r));
                            return (
                            <td key={d} onClick={()=>handleCellClick(d,u.id)} className={`p-0.5 border-r border-[#2A353D] cursor-pointer transition-all align-top h-7 sm:h-8 ${sel?'bg-[#8F6040] outline outline-2 outline-[#D4A381] shadow-inner z-0 relative':'hover:bg-[#12161A]'}`}>
                            <div className="flex flex-col gap-[1px] w-full justify-start overflow-visible">
                              {req && !req.isPartial && <div className="schedule-builder-time-chip w-full rounded font-black text-[7px] sm:text-[8px] py-0.5 text-center text-red-400 bg-red-900/40 uppercase tracking-tighter" title="Requested Off">Off</div>}
                              {req && req.isPartial && <div className="schedule-builder-time-chip schedule-builder-partial-off-chip w-full rounded font-black text-[7px] sm:text-[8px] py-0.5 text-center text-amber-400 bg-amber-900/40 uppercase tracking-tighter" title={`Requested off: ${formatScheduleBuilderRequestRange(req)}`}>{formatScheduleBuilderRequestRange(req)}</div>}
                              {dayShifts.map(shift => {
                                const shiftConflict = allUserReqs.some(r => {
                                  if (!r.isPartial) return true;
                                  return (shift.startTime < (r.endTime || '23:59')) && (shift.endTime > (r.startTime || '00:00'));
                                });
                                const timeStatus = getScheduleShiftTimeStatus(shift);
                                const invalidTimeRange = !timeStatus.valid;
                                return (
                                  <button 
                                    key={shift.id || `${d}-${u.id}-${shift.startTime}-${shift.endTime}`}
                                    type="button"
                                    onClick={(event) => handleDeleteSpecificShift(event, shift, u, d)}
                                    aria-label={`Delete shift ${timeStatus.displayRange} for ${u.name || u.email || 'employee'} on ${d}`}
                                    data-chaos-control-kind="destructive-mutation"
                                    data-chaos-workflow-id="schedule-delete-shift"
                                    className={`schedule-builder-time-chip w-full min-w-[42px] min-h-[42px] rounded font-bold text-[7px] sm:text-[8px] py-0.5 text-center ${invalidTimeRange ? 'bg-amber-950/70 text-amber-200 border border-amber-400/90 shadow-[0_0_8px_rgba(245,158,11,0.35)]' : getRoleColors(shift.role, isBuilderShiftPublished(shift))} ${shiftConflict ? 'border-2 border-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : ''}`} 
                                    title={`${timeStatus.displayRange} ${shiftConflict ? '(CONFLICT DETECTED)' : ''}${invalidTimeRange ? ` (INVALID TIME RANGE - NOT COUNTED: ${timeStatus.reason})` : ''} Tap to delete only this shift.`}
                                  >
                                    {invalidTimeRange ? 'INVALID TIME' : `${formatShortTime(shift.startTime)}-${formatShortTime(shift.endTime)}`}
                                  </button>
                                );
                              })}
                            </div>
                          </td>)
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  <tr className="bg-[#0B0E11] border-t-2 border-[#D4A381]/30">
                    <td className={`px-2 py-2 text-[8px] font-black uppercase tracking-widest text-[#D4A381] sticky left-0 z-10 border-r border-[#2A353D] text-right shadow-md whitespace-nowrap min-w-[96px]`}>
                      Proj. Cost
                    </td>
                    {schedulePeriodDays.map(d => (
                      <td key={`cost-${d}`} className={`p-1 border-r border-[#2A353D] text-center align-middle font-black text-[9px] sm:text-[10px] ${projectedDailyLabor[d] > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                        ${projectedDailyLabor[d].toFixed(0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className={`${T.card} overflow-hidden mt-6`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className={`font-black text-sm flex items-center gap-2 ${T.copper}`}><Clock className={T.copper} size={16}/> Scheduled Hours Tracker</h3>
              <span className={`text-[9px] font-bold ${T.muted} uppercase tracking-widest`}>OT Threshold: {appUser?.systemSettings?.overtime || 40}h</span>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="scheduled-hours-tracker-table w-full text-left text-xs border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-[#1A2126] border-b border-[#2A353D] text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <th className="p-3 border-r border-[#2A353D] sticky left-0 bg-[#1A2126] z-10 w-28 min-w-[112px] whitespace-nowrap">Employee</th>
                    {scheduledHoursWeekBlocks.map((w, i) => <th key={i} className="scheduled-hours-week-head p-3 text-center border-r border-[#2A353D] min-w-[108px] whitespace-nowrap" title={`Pay-period week counted: ${formatDisplayDate(w.start)} - ${formatDisplayDate(w.end)}`}>
                      <span className="scheduled-hours-week-kicker">WK {i+1}</span>
                      <span className="scheduled-hours-week-range">{formatScheduledHoursWeekRangeCompact(w)}</span>
                    </th>)}
                    <th className="scheduled-hours-total-head p-3 text-center text-[#D4A381] min-w-[112px] whitespace-nowrap">Period Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A353D]">
                  {scheduledHours.length === 0 && <tr><td colSpan={scheduledHoursWeekBlocks.length + 2} className="p-6 text-center text-slate-500 font-bold">No hours scheduled yet.</td></tr>}
                  {scheduledHours.map(u => (
                    <tr key={u.id} className="hover:bg-[#12161A]/50 transition-colors">
                      <td className="p-3 font-bold text-white border-r border-[#2A353D] sticky left-0 bg-[#1A2126] z-10 truncate min-w-[112px]">{u.name || 'Unnamed'}</td>
                      {u.weekly.map((hrs, i) => (
                        <td key={i} title={formatScheduledHoursWeekAudit(u.person || u, scheduledHoursWeekBlocks[i], hrs)} className={`p-3 text-center font-black border-r border-[#2A353D] min-w-[86px] whitespace-nowrap ${hrs > parseFloat(appUser?.systemSettings?.overtime || 40) ? 'text-red-500 bg-red-900/10' : hrs > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {hrs > 0 ? hrs.toFixed(1) : '-'}
                        </td>
                      ))}
                      <td className="p-3 text-center font-black text-[#D4A381] bg-[#12161A]/30 min-w-[86px] whitespace-nowrap">{u.total.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

{/* --- THE NEW EVENTS LEDGER SUB-TAB --- */}
      {subTab === 'events' && (
        <div className="animate-[slideIn_0.2s_ease-out] space-y-6">
          
          {/* INTERACTIVE CALENDAR */}
          <div className={`${T.card} overflow-hidden shadow-2xl`}>
            <div className={`bg-[#12161A] p-3 border-b ${T.border} flex justify-between items-center`}>
              <button onClick={() => changeEventsMonth(-1)} className={T.btnAlt}><ChevronLeft size={16}/></button>
              <h3 className="font-black text-base text-white tracking-tight">{formatDisplayMonth(eventsCalMonth)}</h3>
              <button onClick={() => changeEventsMonth(1)} className={T.btnAlt}><ChevronRight size={16}/></button>
            </div>
            <div className={`grid grid-cols-7 border-t ${T.border}`}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`py-1.5 text-center text-[9px] font-black ${T.copper} uppercase border-b border-[#2A353D] bg-[#12161A]`}>{d}</div>)}
              {Array.from({length: eventsFirstDayOffset}).map((_,i) => <div key={`empty-${i}`} className={`p-1 border-b border-r ${T.border} bg-[#1A2126] min-h-[45px]`} />)}
              {eventsMonthDays.map(d => {
                const holiday = getHoliday(d);
                const dayEvents = eventsCalEvents.filter(e => e.date === d);
                const isPastCalendarDay = isPastEventDate(d);

                return (
                  <div key={d} onClick={() => {
                    if (isPastCalendarDay) { addToast('Past Date Locked', 'Events can only be added for today or a future date.'); return; }
                    openNewEventModalForDate(d);
                  }} className={`p-1 border-b border-r ${T.border} min-h-[70px] flex flex-col items-center justify-start pt-1 transition-colors group ${isPastCalendarDay ? 'bg-[#0B0E11]/60 opacity-60 cursor-not-allowed' : 'hover:bg-[#12161A]/50 cursor-pointer'}`}>
                    <span className={`text-xs font-black ${d === getToday() ? T.copper : isPastCalendarDay ? 'text-slate-600' : 'text-slate-300'}`}>{parseInt(d.split('-')[2])}</span>
                    
                    {holiday && <span className="text-[6px] sm:text-[7px] text-amber-500 font-bold uppercase text-center leading-tight mt-0.5 px-0.5">{holiday}</span>}
                    {isPastCalendarDay && <span className="text-[6px] sm:text-[7px] text-slate-600 font-black uppercase text-center leading-tight mt-0.5 px-0.5">Past</span>}
                    {dayEvents.map(ev => (
                      <span key={ev.id} className="text-[6px] sm:text-[7px] text-blue-400 font-bold uppercase text-center leading-tight mt-1 px-1 py-0.5 w-full truncate bg-blue-900/20 border border-blue-900/50 rounded" title={ev.title}>
                        {ev.time ? `${formatShortTime(ev.time)} ` : ''}{ev.title}
                      </span>
                    ))}
                    {!isPastCalendarDay && <div className="mt-auto pt-1 opacity-0 group-hover:opacity-100 text-[8px] text-slate-500 font-bold uppercase transition-opacity pb-1">
                      + Add
                    </div>}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex justify-between items-end">
             <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}><Star className={T.copper}/> Events Ledger</h3>
             <button onClick={openNewEventModal} className={`${T.btn} flex items-center justify-center gap-2 py-2 px-4 text-xs`}><Plus size={14}/> Add Event</button>
          </div>

          <div className={`${T.card} overflow-hidden`}>
            <div className={`divide-y ${T.border}`}>
              {eventsCalEvents.length === 0 && <div className={`p-6 text-center text-sm font-bold ${T.muted}`}>No special events scheduled this month.</div>}
              {eventsCalEvents.sort((a,b) => (a.date || '').localeCompare(b.date || '')).map(ev => (
                <div key={ev.id} className={`${T.row} flex flex-col sm:flex-row justify-between sm:items-center gap-4`}>
                  <div className="flex items-start sm:items-center gap-4">
                    <div className={`bg-[#12161A] border ${T.border} ${T.copper} font-black text-center rounded-xl p-2 w-14 shadow-sm flex-shrink-0`}>
                      <div className="text-[10px] uppercase">{new Date(ev.date+'T12:00').toLocaleDateString('en-US',{month:'short'})}</div><div className="text-lg leading-tight">{parseInt(ev.date.split('-')[2])}</div>
                    </div>
                  <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white">{ev.title} {ev.time && <span className="text-[#D4A381] ml-2">@ {formatShortTime(ev.time)}</span>}</h4>
                      {ev.notes && <p className="text-xs text-slate-300 mt-1 font-medium bg-[#12161A] p-2 rounded-lg border border-[#2A353D] whitespace-pre-wrap">{ev.notes}</p>}
                      {(ev.pushReminders?.length > 0 || ev.orderReminder?.enabled) && <div className="mt-2 flex flex-wrap gap-1">{(ev.pushReminders || []).map(rem => <span key={getEventReminderKey(rem)} className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded border border-[#2A353D] bg-[#12161A] text-[#D4A381]">Push: {labelEventReminder(rem)}</span>)}{ev.orderReminder?.enabled && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded border border-amber-900/50 bg-amber-900/20 text-amber-300">Order: {(ev.orderReminder.cutoffDays || []).join(', ')}</span>}</div>}
                      {ev.imageUrl && (
                        <div className="mt-2 overflow-hidden rounded-xl border border-[#2A353D] shadow-inner bg-[#0B0E11] max-w-sm">
                          <img src={ev.imageUrl} alt="Attached" className="w-full max-h-48 object-contain" />
                        </div>
                      )}
                      <span className={`text-[10px] font-bold ${T.muted} block mt-1`}>Added by {ev.addedBy}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:self-end self-start">
                    <button onClick={() => openEditEventModal(ev)} className="p-2 text-slate-400 hover:text-[#D4A381] transition-colors bg-[#12161A] rounded-lg border border-[#2A353D]"><Edit size={14}/></button>
                    <button onClick={() => handleDeleteEvent(ev)} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-[#12161A] rounded-lg border border-[#2A353D]"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

{/* THE TIMESHEET SUB-TAB (Secured & Safed) */}
      {subTab === 'timesheets' && appUser?.isAdmin && (
        <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
          
          <div className={`bg-[#12161A] p-4 border-b ${T.border} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
            <div className="flex items-center gap-4 flex-wrap">
              <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}>Payroll</h3>
              <div className="flex items-center gap-2 bg-[#1A2126] border border-[#2A353D] p-1.5 rounded-lg shadow-inner">
                 <input type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} className="bg-transparent text-[#D4A381] text-xs font-bold outline-none cursor-pointer" />
                 <span className="text-slate-500 font-black text-[10px] uppercase">to</span>
                 <input type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} className="bg-transparent text-[#D4A381] text-xs font-bold outline-none cursor-pointer" />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={openAddPunchModal} className="bg-[#1A2126] border border-[#2A353D] text-slate-300 font-bold px-3 py-1.5 rounded-lg text-xs hover:text-[#D4A381] transition-colors flex items-center gap-2"><Plus size={14}/> Add Punch</button>
              <button onClick={handleExportTimesheets} className="bg-[#1A2126] border border-[#2A353D] text-slate-300 font-bold px-3 py-1.5 rounded-lg text-xs hover:text-emerald-400 transition-colors flex items-center gap-2">📋 Export CSV</button>
              <div className="bg-[#1A2126] border border-[#2A353D] px-3 py-1.5 rounded-lg flex flex-col items-end shadow-sm">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Period Labor</span>
                <span className="text-emerald-400 font-black text-sm">${actualPeriodLabor.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
            </div>
          </div>

{/* TARGETS DASHBOARD */}
          {appUser?.systemSettings?.enableTargets && (
            <div className="bg-[#0B0E11] p-4 border-b border-[#2A353D] flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="flex items-center gap-6">
                 <div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Period Sales</div>
                   <div className="text-lg font-black text-white">${parseFloat(appUser.systemSettings.targetSales || 0).toLocaleString()}</div>
                 </div>
                 <div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Labor %</div>
                   <div className="text-lg font-black text-white">{parseFloat(appUser.systemSettings.targetLaborPct || 0).toFixed(1)}%</div>
                 </div>
                 <div className="border-l border-[#2A353D] pl-6">
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Actual Period Labor %</div>
                   <div className={`text-lg font-black ${((actualPeriodLabor / parseFloat(appUser.systemSettings.targetSales || 1)) * 100) > parseFloat(appUser.systemSettings.targetLaborPct || 100) ? 'text-red-400' : 'text-emerald-400'}`}>
                     {appUser.systemSettings.targetSales > 0 ? ((actualPeriodLabor / parseFloat(appUser.systemSettings.targetSales)) * 100).toFixed(1) : '0.0'}%
                   </div>
                 </div>
              </div>
              <button onClick={() => setIsTargetSettingsOpen(!isTargetSettingsOpen)} className="text-xs font-bold text-slate-400 hover:text-[#D4A381] border border-[#2A353D] bg-[#1A2126] px-3 py-1.5 rounded-lg transition-colors">Configure Targets</button>
            </div>
          )}

          {!appUser?.systemSettings?.enableTargets && (
            <div className="bg-[#0B0E11] p-3 border-b border-[#2A353D] text-right">
              <button onClick={() => setIsTargetSettingsOpen(!isTargetSettingsOpen)} className="text-xs font-bold text-slate-400 hover:text-[#D4A381] transition-colors">Configure Financial Targets</button>
            </div>
          )}

          {isTargetSettingsOpen && (
            <form onSubmit={handleSaveTargets} className="p-4 bg-[#1A2126] border-b border-[#2A353D] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={T.label}>Period Sales Target ($)</label>
                  <input type="number" step="0.01" value={targetSales} onChange={e=>setTargetSales(e.target.value)} className={T.input} placeholder="e.g. 50000" />
                </div>
                <div>
                  <label className={T.label}>Target Labor Cost (%)</label>
                  <input type="number" step="0.1" value={targetLaborPct} onChange={e=>setTargetLaborPct(e.target.value)} className={T.input} placeholder="e.g. 25.5" />
                </div>
              </div>
              <div className="flex gap-2">
                 <button type="submit" className={`flex-1 ${T.btn} py-2 text-xs`}>Save Targets</button>
                 <button type="button" onClick={async () => { await updateDoc(doc(db, "restaurants", appUser.restaurantId), { 'systemSettings.enableTargets': false }); setIsTargetSettingsOpen(false); }} className={`px-4 bg-red-900/20 text-red-500 font-bold text-xs rounded-xl border border-red-900/50 hover:bg-red-900/40 transition-colors`}>Disable</button>
              </div>
            </form>
          )}

{summaryList.length > 0 && (
            <div className="p-4 border-b border-[#2A353D] bg-[#0B0E11]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3">Period Payroll Summary</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {summaryList.map(s => (
                  <div key={s.name} className="bg-[#1A2126] p-3 rounded-xl border border-[#2A353D] flex justify-between items-center shadow-sm hover:border-[#D4A381]/50 transition-colors">
                    <div>
                      <div className="font-bold text-white text-sm">{s.name}</div>
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-0.5">
                        REG: {s.regHours.toFixed(2)}h | OT: {s.otHours.toFixed(2)}h
                      </div>
                      <div className="text-[9px] font-black uppercase text-emerald-500 tracking-widest mt-0.5">
                        TIPS: ${(s.cashTips + s.creditTips).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-[#D4A381] font-black text-lg">${s.pay.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TIME PUNCH FILTERS */}
          <div className={`bg-[#12161A] p-3 border-b ${T.border} flex flex-col sm:flex-row gap-3 justify-between sm:items-center`}>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Filter Punches</h4>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <input type="date" value={punchFilterDate} onChange={e => setPunchFilterDate(e.target.value)} className={`${T.input} py-1.5 px-2 text-xs w-auto flex-1 sm:flex-none`} />
              <select value={punchFilterEmp} onChange={e => setPunchFilterEmp(e.target.value)} className={`${T.input} py-1.5 px-2 text-xs w-auto flex-1 sm:flex-none`}>
                <option value="">All Staff</option>
                {users.filter(u => u.isActive !== false).sort((a,b) => a.name.localeCompare(b.name)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {(punchFilterDate || punchFilterEmp) && <button onClick={() => { setPunchFilterDate(''); setPunchFilterEmp(''); }} className="p-1.5 text-slate-400 hover:text-red-400 border border-[#2A353D] bg-[#1A2126] rounded-lg transition-colors"><X size={14}/></button>}
            </div>
          </div>

          <div className={`divide-y ${T.border}`}>
            {periodPunches.filter(p => (punchFilterDate ? p.date === punchFilterDate : true) && (punchFilterEmp ? p.employeeId === punchFilterEmp : true)).length === 0 && <div className={`p-6 text-center text-sm font-bold ${T.muted}`}>No clock-ins found for this selection.</div>}
            
            {periodPunches.filter(p => (punchFilterDate ? p.date === punchFilterDate : true) && (punchFilterEmp ? p.employeeId === punchFilterEmp : true)).sort((a,b) => new Date(b.clockInTime || 0) - new Date(a.clockInTime || 0)).map(p => {
               const emp = users.find(u => u.id === p.employeeId);
               const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
               const cost = hours * (emp?.wage || 0);
               const isClockedIn = p.status === 'clocked_in' || p.status === 'on_break';
               
               const safeIn = p.clockInTime ? formatClockTime(p.clockInTime) : 'ERR';
               const safeOut = isClockedIn ? '---' : (p.clockOutTime ? formatClockTime(p.clockOutTime) : 'ERR');
               
               return (
                 <div key={p.id} className={`${T.row} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
                   <div>
<div className="font-bold text-white text-base">
  {p.employeeName || 'Unknown'}
  {p.isUnscheduled && !p.isApproved && <span className="ml-2 text-[8px] bg-amber-500 text-slate-900 px-1.5 py-0.5 rounded-sm uppercase tracking-widest font-black align-middle">Unscheduled</span>}
</div>                     <div className={`text-[10px] font-black uppercase tracking-widest ${T.muted} mt-0.5`}>
                       {p.date ? formatDisplayDate(p.date) : 'Unknown Date'}
                     </div>
                   </div>
                   <div className="flex items-center gap-6">
                     <div className="text-right">
                       <div className="text-xs font-mono text-slate-300">
                         <span className="text-emerald-400">IN:</span> {safeIn}
                       </div>
                       <div className="text-xs font-mono text-slate-300">
                         <span className="text-red-400">OUT:</span> {safeOut}
                       </div>
                     </div>
                     <div className="text-right border-l border-[#2A353D] pl-6 w-24">
                       <div className={`text-sm font-black ${isClockedIn ? 'text-amber-400 animate-pulse' : 'text-white'}`}>{isClockedIn ? 'ON CLOCK' : `${hours.toFixed(2)} hrs`}</div>
                       <div className="text-[10px] font-black text-[#D4A381] uppercase tracking-widest">${cost.toFixed(2)}</div>
                     </div>
                     <div className="flex gap-2 border-l border-[#2A353D] pl-4">
                       {isClockedIn && <button onClick={() => handleForceClockOut(p)} className="px-3 py-1 bg-red-900/20 text-red-500 text-[10px] font-black uppercase rounded-lg border border-red-900/50 hover:bg-red-900/40 transition-colors">Force Out</button>}
    {p.isUnscheduled && !p.isApproved && <button onClick={() => updateDoc(doc(db, "timePunches", p.id), { isApproved: true })} className="px-3 py-1 bg-amber-900/20 text-amber-400 text-[10px] font-black uppercase rounded-lg border border-amber-900/50 hover:bg-amber-900/40 transition-colors animate-pulse">Approve</button>}
                       <button onClick={() => openEditPunchModal(p)} className="p-2 text-slate-400 hover:text-[#D4A381] bg-[#12161A] rounded-lg border border-[#2A353D] transition-colors"><Edit size={14}/></button>
                       <button onClick={() => handleDeletePunch(p.id)} className="p-2 text-slate-400 hover:text-red-500 bg-[#12161A] rounded-lg border border-[#2A353D] transition-colors"><Trash2 size={14}/></button>
                     </div>
                   </div>
                 </div>
               )
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const TabMonth = ({ currentDate, users, shifts, appUser }) => {
  const [roleFilter, setRoleFilter] = useState('All');
  const activeUsers = useMemo(() => (Array.isArray(users) ? users : []).filter(u => u && u.isActive !== false), [users]);
  const uniqueRoles = useMemo(() => ['All', ...new Set(activeUsers.map(u => u.role).filter(Boolean))].sort(), [activeUsers]);

  const monthStr = getMonthStr(currentDate); 
  const firstDay = new Date(monthStr+'-01T12:00:00').getDay(); 
  const days = getDaysInMonth(monthStr);
  const monthSchedulePerson = useMemo(() => getSchedulePersonForAppUser(appUser, activeUsers), [appUser, activeUsers]);
  const visibleMonthShifts = useMemo(() => {
    const filtered = (Array.isArray(shifts) ? shifts : [])
      .filter(s => {
        const dateKey = getShiftDateKey(s);
        if (!dateKey || !dateKey.startsWith(monthStr)) return false;
        if (isDeletedScheduleShift(s) || !isScheduleShiftPublished(s)) return false;
        if (roleFilter === 'All') return true;
        if (roleFilter === 'ME') return shiftMatchesPerson(s, monthSchedulePerson, activeUsers);
        return String(s.role || s.targetRole || '') === String(roleFilter || '');
      });
    return collapseScheduleDisplayShifts(filtered, activeUsers).sort((a, b) => {
      const dateSort = getShiftDateKey(a).localeCompare(getShiftDateKey(b));
      if (dateSort) return dateSort;
      const roleSort = String(a.role || '').localeCompare(String(b.role || ''));
      if (roleSort) return roleSort;
      const timeSort = String(a.startTime || '').localeCompare(String(b.startTime || ''));
      if (timeSort) return timeSort;
      return getScheduleShiftDisplayName(a, activeUsers).localeCompare(getScheduleShiftDisplayName(b, activeUsers));
    });
  }, [shifts, monthStr, roleFilter, monthSchedulePerson, activeUsers]);

  const shiftsByDate = useMemo(() => {
    const grouped = new Map();
    visibleMonthShifts.forEach(shift => {
      const dateKey = getShiftDateKey(shift);
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey).push(shift);
    });
    return grouped;
  }, [visibleMonthShifts]);
  
  // Calculate how many weeks this month spans to perfectly stretch the grid rows on paper
  const totalCells = firstDay + days;
  const weeks = Math.ceil(totalCells / 7);

  const buildPrintableCalendarHtml = () => {
    const monthTitle = `${roleFilter !== 'All' ? `${roleFilter} - ` : ''}${formatDisplayMonth(monthStr)}`;
    const weekdayHeader = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => `<div class="weekday">${escapeSchedulePrintHtml(day)}</div>`).join('');
    const blanks = Array.from({ length: firstDay }).map(() => '<div class="day blank"></div>').join('');
    const dayCells = Array.from({ length: days }).map((_, index) => {
      const dayNumber = index + 1;
      const date = `${monthStr}-${String(dayNumber).padStart(2,'0')}`;
      const dayShifts = shiftsByDate.get(date) || [];
      const shiftRows = dayShifts.map(shift => `<div class="shift">${escapeSchedulePrintHtml(getScheduleShiftMonthLabels(shift, activeUsers).full)}</div>`).join('');
      return `<div class="day"><div class="date">${dayNumber}</div><div class="shiftStack">${shiftRows}</div></div>`;
    }).join('');
    return `<!doctype html><html><head><meta charset="utf-8" /><title>86 Chaos Schedule ${escapeSchedulePrintHtml(monthTitle)}</title><style>@page{size:letter landscape;margin:0.12in}*{box-sizing:border-box}html,body{width:10.76in;height:8.26in;margin:0;padding:0;overflow:hidden}body{color:#000;background:#fff;font-family:Arial,Helvetica,sans-serif}.calendar{width:100%;height:100%;display:grid;grid-template-rows:auto auto minmax(0,1fr);page-break-inside:avoid;break-inside:avoid-page}h1{margin:0 0 3px;text-align:center;font-size:17px;line-height:1.02;text-transform:uppercase;letter-spacing:.035em}.meta{margin:0 0 3px;display:flex;justify-content:space-between;gap:8px;font-size:9px;font-weight:800;color:#111}.grid{min-height:0;height:100%;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:18px repeat(${weeks},minmax(0,1fr));border-top:1.5px solid #000;border-left:1.5px solid #000}.weekday,.day{border-right:1.5px solid #000;border-bottom:1.5px solid #000}.weekday{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;text-transform:uppercase;background:#f1f5f9}.day{min-height:0;height:100%;padding:2px;overflow:hidden}.blank{background:#f8fafc}.date{text-align:right;font-size:11.5px;font-weight:900;margin-bottom:1px}.shiftStack{display:flex;flex-direction:column;gap:.5px}.shift{border:.8px solid #94a3b8;border-radius:2px;background:#f8fafc;padding:0 1px;font-family:"Arial Narrow",Arial,Helvetica,sans-serif;font-size:8.6px;line-height:1.03;font-weight:900;letter-spacing:-.035em;white-space:nowrap;overflow:hidden;text-overflow:clip;color:#000}</style></head><body><div class="calendar"><h1>86 Chaos Schedule ${escapeSchedulePrintHtml(monthTitle)}</h1><div class="meta"><span>${escapeSchedulePrintHtml(visibleMonthShifts.length)} published shifts</span><span>Printed ${escapeSchedulePrintHtml(new Date().toLocaleString())}</span></div><div class="grid">${weekdayHeader}${blanks}${dayCells}</div></div><script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},150);});</script></body></html>`;
  };

  const handlePrintCalendar = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildPrintableCalendarHtml());
    printWindow.document.close();
  };

  return (
    <div className={`${T.card} overflow-hidden print-container`}>
      <style>{`
        @media print {
          @page { size: letter landscape; margin: 0.12in; }
          body * { visibility: hidden; }
          
          /* Hijack the entire printed page */
          .print-container, .print-container * { visibility: visible; }
          .print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            display: flex !important;
            flex-direction: column !important;
            background: white !important;
            z-index: 999999 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: hidden !important; 
            page-break-inside: avoid !important;
          }
          
          .no-print { display: none !important; }
          
          /* The Header */
          .print-header { 
            display: block !important; 
            text-align: center !important; 
            font-size: 22px !important; 
            font-weight: 900 !important; 
            color: black !important; 
            margin-top: 0 !important;
            margin-bottom: 8px !important; 
            text-transform: uppercase !important; 
            height: 30px !important;
          }
          
          /* The Grid - Stretches to fill exact remaining space on the paper */
          .print-grid {
            flex-grow: 1 !important;
            display: grid !important;
            grid-template-rows: 25px repeat(${weeks}, 1fr) !important;
            border-top: 2px solid black !important;
            border-left: 2px solid black !important;
            height: calc(100vh - 45px) !important; /* Math: 100% minus the header
 height to prevent page 2 bleed */
            max-height: calc(100vh - 45px) !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
          }
          
          /* The Cells */
          .cell {
            border-right: 2px solid black !important;
            border-bottom: 2px solid black !important;
            background: white !important;
            color: black !important;
            min-height: 0 !important;
            padding: 3px !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            gap: 1px !important;
          }
          
          .cell-header-text { color: black !important; font-size: 11px !important; font-weight: 900 !important; }
          .cell-date { font-size: 13px !important; font-weight: 900 !important; color: black !important; margin-bottom: 2px !important; }
          
          /* The Shifts */
          .print-shift-stack {
            display: flex !important;
            flex-direction: column !important;
            gap: 1px !important;
            min-height: 0 !important;
            overflow: visible !important;
          }

          .print-shift {
            background: #f8fafc !important;
            color: black !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 3px !important;
            padding: 0 2px !important;
            font-size: 7.6px !important;
            font-weight: 900 !important;
            line-height: 1.05 !important;
            margin-bottom: 0 !important;
            min-height: 0 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: clip !important;
            flex: 0 0 auto !important;
          }

          .print-day-dense .print-shift {
            border-radius: 2px !important;
            padding: 0 1px !important;
            font-size: 7px !important;
            line-height: 1 !important;
          }

          .print-shift [class~="hidden"][class~="sm:inline"] { display: inline !important; }
          .print-shift [class~="sm:hidden"] { display: none !important; }
        }
      `}</style>
      
<div className="flex justify-between items-center p-2 no-print border-b border-[#2A353D] bg-[#12161A]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:inline">Filter Role:</span>
    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-[#1A2126] border border-[#2A353D] text-[#D4A381] text-xs font-bold rounded-lg px-2 py-1.5 outline-none cursor-pointer shadow-inner">
            <option value="All">Whole Schedule</option>
            <option value="ME">My Shifts Only</option>
            {uniqueRoles.filter(r => r !== 'All').map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button onClick={handlePrintCalendar} className={T.btnAlt}>🖨️ Print Calendar</button>
      </div>
      
      <div className="hidden print:block print-header">
        86chaos Schedule {roleFilter !== 'All' ? `- ${roleFilter}` : ''}   {formatDisplayMonth(monthStr)}
      </div>

      <div className={`grid grid-cols-7 border-t border-l ${T.border} print-grid`}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`p-1 bg-[#12161A] text-center font-black text-[10px] ${T.copper} border-b border-r ${T.border} uppercase cell`}><span className="print-text-dark cell-header-text">{d}</span></div>)}
        
        {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`} className={`bg-[#12161A]/50 border-b border-r ${T.border} min-h-[50px] cell`}/>)}
        
{Array.from({length:days}).map((_,i)=>{
          const date = `${monthStr}-${String(i+1).padStart(2,'0')}`; 
          const dayShifts = shiftsByDate.get(date) || [];
          return (
            <div key={date} className={`p-0.5 border-b border-r ${T.border} min-h-[50px] flex flex-col cell ${dayShifts.length >= 6 ? 'print-day-dense' : ''}`}>
              <span className={`text-right text-[9px] font-black ${T.muted} mb-0.5 cell-date`}>{i+1}</span>
              <div className="space-y-0.5 overflow-y-auto no-scrollbar flex-1 print-shift-stack" tabIndex={0} role="region" aria-label={`Shifts for ${formatDisplayDate(date)}`}>
                {dayShifts.map(s=>{
                  const labels = getScheduleShiftMonthLabels(s, activeUsers);
                  return (
                    <div key={getScheduleShiftDisplayDedupeKey(s, activeUsers) || s.id} className={`schedule-month-shift text-[8px] font-bold px-0.5 rounded leading-tight truncate bg-[#12161A] border ${T.border} text-[#D4A381] print-shift`}>
                      <span className="hidden sm:inline">{labels.full}</span>
                      <span className="sm:hidden">{labels.mobile}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

const TabAvailability = ({ availabilityRecords = [], appUser, users = [], addToast, clientData = null }) => {
  const [mode, setMode] = useState('mine');
  const [effectiveStartDate, setEffectiveStartDate] = useState(getToday());
  const [effectiveEndDate, setEffectiveEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [maxHoursPerWeek, setMaxHoursPerWeek] = useState('');
  const [maxShiftsPerWeek, setMaxShiftsPerWeek] = useState('');
  const [preferredDaysOff, setPreferredDaysOff] = useState([]);
  const [weeklyAvailability, setWeeklyAvailability] = useState(() => SCHEDULE_WEEKDAYS.reduce((acc, day) => ({ ...acc, [day]: { available: !['Sunday'].includes(day), start: '09:00', end: '17:00', preferred: false } }), {}));
  const [deletingAvailabilityId, setDeletingAvailabilityId] = useState('');

  const perms = appUser?.permissions || {};
  const canManage = !!(appUser?.isSuperAdmin || appUser?.isAdmin || perms.schedule || perms.team);
  const settings = mergeWorkspaceSettings(appUser, clientData);
  const approvalRequired = settings.requireAvailabilityApproval !== false;
  const availabilityAuthUid = auth?.currentUser?.uid || appUser?.authUid || appUser?.uid || appUser?.id || '';
  const myScheduleIdentity = { ...buildScheduleIdentityFields(getSchedulePersonForAppUser(appUser, users), appUser), authUid: availabilityAuthUid, userId: availabilityAuthUid };
  const myRecords = (availabilityRecords || []).filter(r => String(r.scheduleUserId || r.employeeId || r.userId || '') === String(myScheduleIdentity.scheduleUserId || '')).sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const visibleTeamRecords = canManage ? [...(availabilityRecords || [])].sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) : myRecords;
  const pendingRecords = visibleTeamRecords.filter(r => normalizeAvailabilityStatus(r.status) === 'pending' && r.archived !== true);
  const historyRecords = visibleTeamRecords.filter(r => ['approved','denied','archived'].includes(normalizeAvailabilityStatus(r.status)) || r.archived === true);

  const toggleDay = (day) => setWeeklyAvailability(prev => ({ ...prev, [day]: { ...(prev[day] || {}), available: !(prev[day]?.available !== false) } }));
  const updateDay = (day, field, value) => setWeeklyAvailability(prev => ({ ...prev, [day]: { ...(prev[day] || {}), [field]: value } }));
  const togglePreferredDayOff = (day) => setPreferredDaysOff(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  const submitAvailability = async (e) => {
    e.preventDefault();
    const status = approvalRequired && !canManage ? 'pending' : 'approved';
    const nowIso = new Date().toISOString();
    const payload = {
      restaurantId: appUser.restaurantId,
      workspaceId: appUser.restaurantId,
      ...myScheduleIdentity,
      weeklyAvailability,
      unavailableWindows: SCHEDULE_WEEKDAYS.filter(day => weeklyAvailability?.[day]?.available === false).map(day => ({ day, start: '00:00', end: '23:59', type: 'unavailable' })),
      preferredWindows: SCHEDULE_WEEKDAYS.filter(day => weeklyAvailability?.[day]?.preferred === true).map(day => ({ day, start: weeklyAvailability[day].start || '09:00', end: weeklyAvailability[day].end || '17:00', type: 'preferred' })),
      preferredDaysOff,
      maxHoursPerWeek: Number(maxHoursPerWeek) || null,
      maxShiftsPerWeek: Number(maxShiftsPerWeek) || null,
      effectiveStartDate,
      effectiveEndDate: effectiveEndDate || null,
      status,
      approvalRequired,
      notes: notes.trim(),
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: availabilityAuthUid,
      createdByName: appUser.name || appUser.email || ''
    };
    await addDoc(collection(db, 'availabilityRecords'), payload);
    await logAudit(appUser, 'AVAILABILITY_SUBMITTED', appUser.name || appUser.email || 'Availability', `${status} starting ${effectiveStartDate}`);
    addToast(status === 'pending' ? 'Availability Submitted' : 'Availability Saved', status === 'pending' ? 'A manager needs to approve it before Schedule Builder uses it.' : 'Schedule Builder can now use this availability.');
    setNotes('');
  };

  const updateAvailabilityStatus = async (record, status) => {
    const nowIso = new Date().toISOString();
    const update = { status, updatedAt: nowIso };
    if (status === 'approved') Object.assign(update, { approvedAt: nowIso, approvedBy: appUser.id || '', approvedByName: appUser.name || appUser.email || '' });
    if (status === 'denied') Object.assign(update, { deniedAt: nowIso, deniedBy: appUser.id || '', deniedByName: appUser.name || appUser.email || '' });
    if (status === 'archived') Object.assign(update, { archived: true, archivedAt: nowIso, archivedBy: appUser.id || '', previousStatus: record.status || 'approved' });
    if (status === 'restored') Object.assign(update, { status: record.previousStatus || 'pending', archived: false, restoredAt: nowIso, restoredBy: appUser.id || '' });
    await updateDoc(doc(db, 'availabilityRecords', record.id), update);
    await logAudit(appUser, `AVAILABILITY_${status.toUpperCase()}`, record.employeeName || record.employeeId || 'Availability', record.id);
    addToast('Availability Updated', `Availability ${status === 'restored' ? 'restored' : status}.`);
  };

  const deleteAvailabilityHistory = async (record) => {
    if (!record?.id || deletingAvailabilityId) return;
    const who = record.employeeName || record.userName || 'this employee';
    const start = formatDisplayDate(record.effectiveStartDate || getToday());
    const ok = window.confirm(`Delete availability history for ${who} starting ${start}?\n\nThis permanently deletes this availability history entry. It does not delete the employee, schedules, or Request Off records.`);
    if (!ok) return;
    setDeletingAvailabilityId(record.id);
    try {
      const response = await secureFetch('/api/availability-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: record.id, restaurantId: appUser?.restaurantId || record.restaurantId || record.workspaceId || '' })
      });
      const data = await parseRequestOffApiPayload(response);
      if (!response.ok || data?.ok === false) throw new Error(data?.error || `Availability delete failed (${response.status})`);
      addToast('Availability Deleted', 'Availability history entry was permanently deleted.');
    } catch (err) {
      addToast('Delete Failed', err?.message || 'Could not delete availability history.');
    } finally {
      setDeletingAvailabilityId('');
    }
  };

  const AvailabilityCard = ({ record, allowDelete = false }) => (
    <div className={`${T.row} items-start gap-3`}>
      <div className="flex-1 min-w-0">
        <div className="font-black text-white text-sm">{record.employeeName || 'Employee'}</div>
        <div className={`text-[10px] font-bold ${T.muted} mt-0.5`}>{formatDisplayDate(record.effectiveStartDate || getToday())}{record.effectiveEndDate ? ` to ${formatDisplayDate(record.effectiveEndDate)}` : ' onward'} • {record.status || 'pending'}</div>
        {record.notes && <p className="text-xs text-slate-400 font-bold mt-1 line-clamp-2">{record.notes}</p>}
        <div className="mt-2 flex flex-wrap gap-1">
          {SCHEDULE_WEEKDAYS.map(day => {
            const d = record.weeklyAvailability?.[day];
            if (!d) return null;
            return <span key={day} className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded border ${d.available === false ? 'bg-red-900/20 text-red-300 border-red-900/50' : d.preferred ? 'bg-emerald-900/20 text-emerald-300 border-emerald-900/50' : 'bg-[#12161A] text-slate-300 border-[#2A353D]'}`}>{day.slice(0,3)} {d.available === false ? 'off' : `${formatShortTime(d.start)}-${formatShortTime(d.end)}`}</span>;
          })}
        </div>
      </div>
      {canManage && (
        <div className="flex flex-wrap justify-end gap-2">
          {record.status === 'pending' && <button onClick={() => updateAvailabilityStatus(record, 'approved')} className="p-2 rounded-lg bg-emerald-900/20 text-emerald-300 border border-emerald-900/50"><Check size={14}/></button>}
          {record.status === 'pending' && <button onClick={() => updateAvailabilityStatus(record, 'denied')} className="p-2 rounded-lg bg-red-900/20 text-red-300 border border-red-900/50"><X size={14}/></button>}
          {record.archived || record.status === 'archived' ? <button onClick={() => updateAvailabilityStatus(record, 'restored')} className={T.btnAlt}>Restore</button> : <button onClick={() => updateAvailabilityStatus(record, 'archived')} className={T.btnAlt}>Archive</button>}
          {allowDelete && <button type="button" onClick={() => deleteAvailabilityHistory(record)} disabled={deletingAvailabilityId === record.id} className="p-2 rounded-lg bg-red-950/30 text-red-300 border border-red-900/50 disabled:opacity-50" aria-label={`Delete availability history for ${record.employeeName || 'employee'}`} title="Delete availability history"><Trash2 size={14}/></button>}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={`${T.card} p-4 xl:col-span-2`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div><h3 className="font-black text-white text-lg">My Availability</h3><p className={`text-xs font-bold ${T.muted}`}>Normal weekly availability is separate from one-time request-offs.</p></div>
            <div className="flex gap-2"><button onClick={() => setMode('mine')} className={mode === 'mine' ? T.btn : T.btnAlt}>Mine</button>{canManage && <button onClick={() => setMode('team')} className={mode === 'team' ? T.btn : T.btnAlt}>Team</button>}</div>
          </div>
          <form onSubmit={submitAvailability} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className={T.label}>Effective Start</label><input type="date" value={effectiveStartDate} onChange={e=>setEffectiveStartDate(e.target.value)} className={T.input} required /></div><div><label className={T.label}>Optional End</label><input type="date" value={effectiveEndDate} onChange={e=>setEffectiveEndDate(e.target.value)} className={T.input} /></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SCHEDULE_WEEKDAYS.map(day => {
                const row = weeklyAvailability[day] || {};
                return <div key={day} className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3 space-y-2"><label className="flex items-center gap-2 text-xs font-black text-white"><input type="checkbox" checked={row.available !== false} onChange={() => toggleDay(day)} className="accent-[#8F6040]" />{day}</label>{row.available !== false && <div className="grid grid-cols-2 gap-2"><input type="time" value={row.start || '09:00'} onChange={e=>updateDay(day,'start',e.target.value)} className={T.input}/><input type="time" value={row.end || '17:00'} onChange={e=>updateDay(day,'end',e.target.value)} className={T.input}/></div>}<label className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><input type="checkbox" checked={row.preferred === true} onChange={e=>updateDay(day,'preferred',e.target.checked)} className="accent-[#8F6040]" />Preferred shift window</label><label className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><input type="checkbox" checked={preferredDaysOff.includes(day)} onChange={() => togglePreferredDayOff(day)} className="accent-[#8F6040]" />Preferred day off</label></div>;
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className={T.label}>Max Shifts / Week</label><input value={maxShiftsPerWeek} onChange={e=>setMaxShiftsPerWeek(e.target.value)} type="number" min="0" className={T.input}/></div><div><label className={T.label}>Max Hours / Week</label><input value={maxHoursPerWeek} onChange={e=>setMaxHoursPerWeek(e.target.value)} type="number" min="0" className={T.input}/></div></div>
            <div><label className={T.label}>Optional Notes</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} className={T.input} rows="3" placeholder="School schedule, seasonal change, pickup needs, etc." /></div>
            <div className="rounded-xl border border-amber-900/40 bg-amber-900/10 p-3 text-xs font-bold text-amber-200">Approval is {approvalRequired ? 'required' : 'not required'} for employee availability changes in this workspace.</div>
            <button className={T.btn}>Submit Availability Change</button>
          </form>
        </div>
        <div className="space-y-4">
          <div className={`${T.card} p-4`}><h3 className="font-black text-white text-sm mb-3">Pending Availability Changes</h3><div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">{pendingRecords.length === 0 && <FriendlyEmpty title="Nothing waiting" text="Pending availability changes will land here." />}{pendingRecords.map(record => <AvailabilityCard key={record.id} record={record} allowDelete={false}/>)}</div></div>
          <div className={`${T.card} p-4`}><h3 className="font-black text-white text-sm mb-3">Availability History</h3><div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar">{historyRecords.length === 0 && <FriendlyEmpty title="No history yet" text="Approved, denied, archived, and restored availability stays here." />}{historyRecords.slice(0,80).map(record => <AvailabilityCard key={record.id} record={record} allowDelete={canManage}/>)}</div></div>
        </div>
      </div>
    </div>
  );
};


const isUserLevelGhostTimeOff = (user = {}) => Boolean(user?.isGhost === true && user?.ghostMode === 'user');
const requestOffTargetIdForUser = (user = {}) => String(user?.ghostTargetUserId || user?.authUid || user?.uid || user?.userId || user?.id || '').trim();
const requestOffCacheKey = (restaurantId = '', date = '', user = {}) => [restaurantId, date, requestOffTargetIdForUser(user), isUserLevelGhostTimeOff(user) ? 'ghost' : 'self'].join('|');
const parseRequestOffApiPayload = async (response) => {
  const contentType = String(response?.headers?.get?.('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) return response.json().catch(() => ({}));
  return {};
};
const requestOffConflictMessage = (dateKey = '', info = {}) => {
  const count = Number(info?.count || 0);
  const peopleText = count === 1 ? '1 person has' : `${count} people have`;
  const names = Array.isArray(info?.names) ? info.names.filter(Boolean) : [];
  const previewNames = names.slice(0, 4).join(', ');
  return `${formatDisplayDate(dateKey)} has already been requested off.\n\n${peopleText} requested this day off before you${previewNames ? ` (${previewNames}${count > 4 ? ', ...' : ''})` : ''}.\n\nIt might not be available. Do you still want to request it?`;
};
const normalizeConflictResult = (row = {}, dateKey = '') => ({
  date: row?.date || dateKey,
  hasConflict: row?.hasConflict === true || Number(row?.count || 0) > 0,
  count: Number(row?.count || 0) || 0,
  names: Array.isArray(row?.names) ? row.names.map(v => String(v || '').trim()).filter(Boolean).slice(0, 8) : []
});

const TabTimeOff = ({ timeOffRequests, appUser, users, addToast, events = [], shifts = [], clientData = null }) => {
  const [calMonth, setCalMonth] = useState(getToday().substring(0, 7));
  const [selectedDates, setSelectedDates] = useState([]);
  const [isPartial, setIsPartial] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [viewFilter, setViewFilter] = useState('needs-review');
  const [dateFilter, setDateFilter] = useState('all');
  const [customStart, setCustomStart] = useState(getToday());
  const [customEnd, setCustomEnd] = useState(getToday());
  const [selectedRequestIds, setSelectedRequestIds] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [bulkBusy, setBulkBusy] = useState('');
  const [ghostTimeOffRequests, setGhostTimeOffRequests] = useState([]);
  const [ghostListStatus, setGhostListStatus] = useState('idle');
  const [workflowApiRequests, setWorkflowApiRequests] = useState([]);
  const [workflowApiStatus, setWorkflowApiStatus] = useState('idle');
  const [checkingDate, setCheckingDate] = useState('');
  const [isSubmittingTimeOff, setIsSubmittingTimeOff] = useState(false);
  const [acknowledgedConflicts, setAcknowledgedConflicts] = useState({});
  const conflictCacheRef = useRef(new Map());
  const inFlightConflictRef = useRef(new Map());

  const requestOffGhostMode = isUserLevelGhostTimeOff(appUser);
  const perms = appUser?.permissions || {};
  const canManage = !requestOffGhostMode && !!(appUser?.isSuperAdmin || appUser?.isAdmin || perms.schedule || perms.team);
  const requestOffApi = useCallback(async (action, payload = {}) => {
    const response = await secureFetch('/api/time-off-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        restaurantId: appUser?.restaurantId,
        ...(requestOffGhostMode ? { ghostTargetUserId: appUser?.ghostTargetUserId || appUser?.id || '', targetUserId: appUser?.ghostTargetUserId || appUser?.id || '' } : {}),
        ...payload
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) {
      const err = new Error(data?.error || `Request Off API failed (${response.status})`);
      err.code = data?.code || `http-${response.status}`;
      throw err;
    }
    return data;
  }, [appUser?.restaurantId, appUser?.ghostTargetUserId, appUser?.id, requestOffGhostMode]);
  const getDateFilterRange = () => {
    const today = new Date(`${getToday()}T12:00:00`);
    const start = new Date(today);
    const end = new Date(today);
    if (dateFilter === 'this-week') { start.setDate(today.getDate() - today.getDay()); end.setDate(start.getDate() + 6); }
    if (dateFilter === 'next-week') { start.setDate(today.getDate() - today.getDay() + 7); end.setDate(start.getDate() + 6); }
    if (dateFilter === 'this-month') { const m = getMonthStr(getToday()); return { start: `${m}-01`, end: `${m}-${String(getDaysInMonth(m)).padStart(2,'0')}` }; }
    if (dateFilter === 'next-month') { const d = new Date(`${getToday()}T12:00:00`); d.setDate(1); d.setMonth(d.getMonth()+1); const m = getMonthStr(formatDate(d)); return { start: `${m}-01`, end: `${m}-${String(getDaysInMonth(m)).padStart(2,'0')}` }; }
    if (dateFilter === 'custom') {
      const startKey = customStart || '0000-01-01';
      const endKey = customEnd || '9999-12-31';
      return startKey <= endKey ? { start: startKey, end: endKey } : { start: endKey, end: startKey };
    }
    return { start: '0000-01-01', end: '9999-12-31' };
  };
  const range = getDateFilterRange();
  const workflowRequestRange = useMemo(() => {
    if (dateFilter === 'all') return { start: '0000-01-01', end: '9999-12-31' };
    return range;
  }, [dateFilter, range.start, range.end]);
  const workflowDateScopedRequests = useLiveCollection('timeOffRequests', appUser?.restaurantId, {
    enabled: canManage && !requestOffGhostMode && !!appUser?.restaurantId,
    whereClauses: [['date', '>=', workflowRequestRange.start], ['date', '<=', workflowRequestRange.end]],
    orderByField: 'date',
    orderDirection: 'asc',
    limitCount: dateFilter === 'all' ? 750 : 500,
    fallbackLimitCount: dateFilter === 'all' ? 180 : 120,
    debugLabel: `schedule:request-off-workflow:${dateFilter}`
  });
  useEffect(() => {
    if (!canManage || requestOffGhostMode || !appUser?.restaurantId) {
      setWorkflowApiRequests([]);
      setWorkflowApiStatus('idle');
      return undefined;
    }
    let cancelled = false;
    setWorkflowApiStatus('loading');
    requestOffApi('workflow-list', { startDate: workflowRequestRange.start, endDate: workflowRequestRange.end, dateFilter })
      .then(data => {
        if (cancelled) return;
        setWorkflowApiRequests(Array.isArray(data?.requests) ? data.requests : []);
        setWorkflowApiStatus('ready');
      })
      .catch(err => {
        if (cancelled) return;
        setWorkflowApiRequests([]);
        setWorkflowApiStatus('error');
        console.warn('Handled Request Off workflow-list failure', { operation: 'workflow-list', route: 'schedule/request-off', workspaceId: appUser?.restaurantId || '', dateFilter, code: err?.code || 'request-off-workflow-list-failed' });
      });
    return () => { cancelled = true; };
  }, [canManage, requestOffGhostMode, appUser?.restaurantId, workflowRequestRange.start, workflowRequestRange.end, dateFilter, requestOffApi]);
  const timeOffRequestRows = useMemo(() => requestOffGhostMode
    ? mergeRequestOffWorkflowRows(ghostTimeOffRequests)
    : mergeRequestOffWorkflowRows(timeOffRequests || [], workflowDateScopedRequests || [], workflowApiRequests || []),
    [requestOffGhostMode, ghostTimeOffRequests, timeOffRequests, workflowDateScopedRequests, workflowApiRequests]);
  const requestOffEmployeeOptions = useMemo(() => {
    const seenValues = new Set();
    const seenIdentityKeys = new Set();
    const byRole = new Map();
    const addOption = (person = {}) => {
      const value = String(person.scheduleUserId || person.authUid || person.uid || person.userId || person.id || person.email || person.employeeEmail || '').trim();
      if (!value || seenValues.has(value)) return;
      const identityKeys = personIdentityKeys(person);
      if ([...identityKeys].some(key => seenIdentityKeys.has(key))) return;
      seenValues.add(value);
      identityKeys.forEach(key => seenIdentityKeys.add(key));
      const role = cleanScheduleRoleName(person.role || person.scheduleRole || person.primaryRole || 'Other') || 'Other';
      const label = String(person.name || person.displayName || person.fullName || person.email || value).trim();
      if (!label) return;
      if (!byRole.has(role)) byRole.set(role, []);
      byRole.get(role).push({ value, label, person });
    };
    (users || [])
      .filter(u => u && u.isActive !== false)
      .forEach(addOption);
    if (canManage) {
      (timeOffRequestRows || [])
        .map(buildRequestOffSubjectFallbackPerson)
        .filter(Boolean)
        .forEach(addOption);
    }
    return Array.from(byRole.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([role, rows]) => ({ role, rows: rows.sort((a, b) => a.label.localeCompare(b.label)) }));
  }, [users, canManage, timeOffRequestRows]);
  const selectedRequestOffEmployee = useMemo(() => {
    if (!employeeFilter) return null;
    for (const group of requestOffEmployeeOptions) {
      const found = group.rows.find(row => row.value === employeeFilter);
      if (found) return found;
    }
    return null;
  }, [employeeFilter, requestOffEmployeeOptions]);
  const authUserId = requestOffGhostMode
    ? requestOffTargetIdForUser(appUser)
    : (auth?.currentUser?.uid || appUser?.authUid || appUser?.uid || appUser?.id || '');
  const myId = authUserId;
  const schedulePublishingSettings = getSchedulePublishingSettings(appUser, clientData);
  const schedulePerson = requestOffGhostMode ? { ...appUser, id: authUserId, userId: authUserId, authUid: authUserId, uid: authUserId } : getSchedulePersonForAppUser(appUser, users);
  const postPublishedTimeOffAllowed = schedulePublishingSettings.allowPostPublishedTimeOff;
  const monthDays = Array.from({length: getDaysInMonth(calMonth)}).map((_, i) => `${calMonth}-${String(i+1).padStart(2, '0')}`);
  const firstDayOffset = new Date(calMonth+'-01T12:00:00').getDay();
  const monthEvents = events.filter(e => e.type === 'special_event' && e.date?.startsWith(calMonth));
  const isArchivedRequest = (r = {}) => r.archived === true || r.processed === true || ['archived','processed','cancelled','canceled'].includes(String(r.status || '').toLowerCase());
  const normalizeStatus = (r = {}) => String(r.status || 'pending').toLowerCase();
  const visibleRequests = (timeOffRequestRows || []).filter(r => canManage || timeOffMatchesPerson(r, schedulePerson) || timeOffMatchesPerson(r, appUser));
  const myRequests = visibleRequests.filter(r => timeOffMatchesPerson(r, schedulePerson) || timeOffMatchesPerson(r, appUser)).sort((a,b) => new Date(requestOffDateKey(a) || 0) - new Date(requestOffDateKey(b) || 0));

  const dateFilteredRequests = visibleRequests.filter(r => {
    const requestDate = requestOffDateKey(r);
    return !requestDate || (requestDate >= range.start && requestDate <= range.end);
  });
  const statusFilteredRequests = dateFilteredRequests.filter(r => {
    const status = normalizeStatus(r);
    if (viewFilter === 'needs-review') return status === 'pending' && !isArchivedRequest(r);
    if (viewFilter === 'upcoming-approved') return status === 'approved' && !isArchivedRequest(r) && requestOffDateKey(r) >= getToday();
    if (viewFilter === 'archived') return isArchivedRequest(r);
    return true;
  });
  const filteredRequests = statusFilteredRequests
    .filter(r => !canManage || !selectedRequestOffEmployee || requestOffSubjectMatchesPerson(r, selectedRequestOffEmployee.person))
    .sort((a,b) => new Date(requestOffDateKey(a) || 0) - new Date(requestOffDateKey(b) || 0));
  const visibleRequestIds = filteredRequests.map(r => r.id).filter(Boolean);
  const activeEmployeeFilterLabel = selectedRequestOffEmployee?.label || '';

  const refreshGhostRequests = useCallback(async () => {
    if (!requestOffGhostMode || !appUser?.restaurantId) return;
    setGhostListStatus('loading');
    try {
      const data = await requestOffApi('ghost-list');
      setGhostTimeOffRequests(Array.isArray(data?.requests) ? data.requests : []);
      setGhostListStatus('ready');
    } catch (err) {
      setGhostListStatus('error');
      setGhostTimeOffRequests([]);
      addToast('Request Off unavailable', 'We could not load this employee’s Request Off records. Please try again.');
      console.warn('Handled Request Off ghost-list failure', { operation: 'ghost-list', route: 'schedule/request-off', workspaceId: appUser?.restaurantId || '', ghostMode: true, code: err?.code || 'request-off-ghost-list-failed' });
    }
  }, [requestOffGhostMode, requestOffApi, appUser?.restaurantId, addToast]);

  useEffect(() => {
    conflictCacheRef.current.clear();
    inFlightConflictRef.current.clear();
    setAcknowledgedConflicts({});
    if (requestOffGhostMode) refreshGhostRequests();
    else { setGhostTimeOffRequests([]); setGhostListStatus('idle'); }
  }, [requestOffGhostMode, appUser?.restaurantId, appUser?.ghostTargetUserId, authUserId, refreshGhostRequests]);

  const fetchConflictInfo = useCallback(async (dates = [], options = {}) => {
    const cleanDates = [...new Set((Array.isArray(dates) ? dates : [dates]).filter(Boolean))];
    const force = options?.force === true;
    const missing = force ? cleanDates : cleanDates.filter(d => !conflictCacheRef.current.has(requestOffCacheKey(appUser?.restaurantId || '', d, appUser)));
    if (missing.length) {
      const inFlightKey = missing.map(d => requestOffCacheKey(appUser?.restaurantId || '', d, appUser)).join('||');
      if (!inFlightConflictRef.current.has(inFlightKey)) {
        inFlightConflictRef.current.set(inFlightKey, requestOffApi('conflicts', { dates: missing }).then(data => {
          const rows = Array.isArray(data?.conflicts) ? data.conflicts : [];
          missing.forEach(dateKey => {
            const row = rows.find(item => item?.date === dateKey) || { date: dateKey, count: 0, names: [] };
            conflictCacheRef.current.set(requestOffCacheKey(appUser?.restaurantId || '', dateKey, appUser), normalizeConflictResult(row, dateKey));
          });
        }).finally(() => inFlightConflictRef.current.delete(inFlightKey)));
      }
      await inFlightConflictRef.current.get(inFlightKey);
    }
    return cleanDates.map(dateKey => conflictCacheRef.current.get(requestOffCacheKey(appUser?.restaurantId || '', dateKey, appUser)) || normalizeConflictResult({}, dateKey));
  }, [appUser, requestOffApi]);

  const changeMonth = (offset) => { const d = new Date(calMonth + '-01T12:00:00'); d.setMonth(d.getMonth() + offset); setCalMonth(d.toISOString().substring(0, 7)); };
  const updateRequest = async (r, update, action = 'TIME_OFF_UPDATED') => {
    await updateDoc(doc(db, 'timeOffRequests', r.id), { ...update, updatedAt: new Date().toISOString(), updatedBy: appUser.id || '' });
    await logAudit(appUser, action, r.userName || r.employeeName || r.userId || 'Request off', `${r.date || ''} ${r.id || ''}`);
  };
  const approveRequest = async (r) => { await updateRequest(r, { status:'approved', approvedAt:new Date().toISOString(), approvedBy: appUser.id || '', approvedByName: appUser.name || appUser.email || '' }, 'TIME_OFF_APPROVED'); addToast('Approved', 'Request-off approved.'); };
  const denyRequest = async (r) => { await updateRequest(r, { status:'denied', deniedAt:new Date().toISOString(), deniedBy: appUser.id || '', deniedByName: appUser.name || appUser.email || '' }, 'TIME_OFF_DENIED'); addToast('Denied', 'Request-off denied.'); };
  const archiveRequest = async (r) => { await updateRequest(r, { previousStatus: r.status || 'pending', status:'archived', archived:true, archivedAt:new Date().toISOString(), archivedBy: appUser.id || '', archivedByName: appUser.name || appUser.email || '' }, 'TIME_OFF_ARCHIVED'); addToast('Archived', 'Request moved to history.'); };
  const restoreRequest = async (r) => { await updateRequest(r, { status: r.previousStatus || 'pending', archived:false, processed:false, restoredAt:new Date().toISOString(), restoredBy: appUser.id || '' }, 'TIME_OFF_RESTORED'); addToast('Restored', 'Request restored to the active workflow.'); };
  const cancelRequest = async (r) => {
    if (requestOffGhostMode) {
      try {
        await requestOffApi('ghost-cancel', { requestId: r.id });
        await refreshGhostRequests();
        addToast('Canceled', 'Request was canceled and kept in history.');
      } catch (err) {
        addToast('Request not canceled', 'We could not cancel that Request Off entry. Please try again.');
        console.warn('Handled Request Off ghost-cancel failure', { operation: 'ghost-cancel', route: 'schedule/request-off', workspaceId: appUser?.restaurantId || '', ghostMode: true, code: err?.code || 'request-off-ghost-cancel-failed' });
      }
      return;
    }
    await updateRequest(r, { previousStatus: r.status || 'pending', status:'cancelled', archived:true, cancelledAt:new Date().toISOString(), cancelledBy: appUser.id || '' }, 'TIME_OFF_CANCELLED');
    addToast('Canceled', 'Request was canceled and kept in history.');
  };
  const archiveSelected = async () => {
    const selected = filteredRequests.filter(r => selectedRequestIds.includes(r.id));
    await Promise.all(selected.map(archiveRequest));
    setSelectedRequestIds([]);
  };

  const eligibleVisibleRequests = (options = {}) => filteredRequests.filter(r => isRequestOffBulkEligible(r, {
    visibleIds: visibleRequestIds,
    workspaceId: appUser?.restaurantId || '',
    canManage,
    normalizeStatus,
    isArchivedRequest,
    requirePending: options.requirePending === true,
  }));

  const runBulkRequestUpdate = async ({ mode, requests, confirmMessage, buildUpdate, action, successVerb }) => {
    if (!canManage || bulkBusy) return;
    if (!requests.length) return addToast('Nothing to update', 'No visible eligible Request Off requests match this action.');
    if (!window.confirm(confirmMessage)) return;
    setBulkBusy(mode);
    try {
      const results = await Promise.allSettled(requests.map(r => updateRequest(r, buildUpdate(r), action)));
      const passed = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.length - passed;
      if (failed) addToast(`${successVerb} ${passed}`, `${successVerb} ${passed} request${passed === 1 ? '' : 's'}. ${failed} could not be updated.`);
      else addToast(`${successVerb} ${passed}`, `${successVerb} ${passed} request${passed === 1 ? '' : 's'}.`);
      setSelectedRequestIds(prev => prev.filter(id => !requests.some(r => r.id === id)));
    } finally {
      setBulkBusy('');
    }
  };

  const approveAllVisible = async () => {
    const requests = eligibleVisibleRequests({ requirePending: true });
    const scoped = activeEmployeeFilterLabel ? ` for ${activeEmployeeFilterLabel}` : '';
    await runBulkRequestUpdate({
      mode: 'approve-visible',
      requests,
      confirmMessage: `Approve ${requests.length} visible pending Request Off request${requests.length === 1 ? '' : 's'}${scoped}?`,
      action: 'TIME_OFF_APPROVED',
      successVerb: 'Approved',
      buildUpdate: () => ({ status:'approved', approvedAt:new Date().toISOString(), approvedBy: appUser.id || '', approvedByName: appUser.name || appUser.email || '' })
    });
  };

  const archiveAllVisible = async () => {
    const requests = eligibleVisibleRequests({ requirePending: false });
    const scoped = activeEmployeeFilterLabel ? ` for ${activeEmployeeFilterLabel}` : '';
    await runBulkRequestUpdate({
      mode: 'archive-visible',
      requests,
      confirmMessage: `Archive ${requests.length} visible Request Off request${requests.length === 1 ? '' : 's'}${scoped}?`,
      action: 'TIME_OFF_ARCHIVED',
      successVerb: 'Archived',
      buildUpdate: (r) => ({ previousStatus: r.status || 'pending', status:'archived', archived:true, archivedAt:new Date().toISOString(), archivedBy: appUser.id || '', archivedByName: appUser.name || appUser.email || '' })
    });
  };

  const priorRequestInfoForDate = (dateKey = '') => {
    const cached = conflictCacheRef.current.get(requestOffCacheKey(appUser?.restaurantId || '', dateKey, appUser));
    if (cached) return cached;
    const currentKeys = new Set([requestOffPersonKey({ userId: authUserId, authUid: authUserId, employeeId: authUserId, rosterUserId: schedulePerson.rosterUserId || schedulePerson.id, userEmail: schedulePerson.email, employeeName: schedulePerson.name }), requestOffPersonKey({ userId: authUserId, authUid: authUserId, userEmail: appUser.email, employeeName: appUser.name })].filter(Boolean));
    const people = new Map();
    (timeOffRequestRows || [])
      .filter(r => r?.date === dateKey && isRequestOffConflictCountable(r))
      .forEach(r => {
        const key = requestOffPersonKey(r);
        if (!key || currentKeys.has(key)) return;
        if (!people.has(key)) people.set(key, r.userName || r.employeeName || r.name || r.userEmail || r.employeeEmail || 'Another employee');
      });
    return { count: people.size, names: Array.from(people.values()) };
  };

  const handleToggleDate = async (d) => {
    if (checkingDate === d) return;
    if (d < getToday()) return addToast('Locked', 'Cannot request past dates.');
    if (!postPublishedTimeOffAllowed && !appUser?.isAdmin && isDateInsidePublishedSchedule(d, shifts)) return addToast('Schedule Published', 'This workspace blocks employee time-off requests after that date has already been published. Ask a manager to adjust the schedule.');
    const existingReq = myRequests.find(r => requestOffDateKey(r) === d && isActiveTimeOffRequest(r));
    if (existingReq) { if (window.confirm(`Cancel your time-off request for ${formatDisplayDate(d)}?`)) cancelRequest(existingReq); return; }
    const addingDate = !selectedDates.includes(d);
    if (addingDate) {
      setCheckingDate(d);
      try {
        const [priorInfo] = await fetchConflictInfo([d]);
        if (priorInfo.count > 0) {
          const continueAnyway = window.confirm(requestOffConflictMessage(d, priorInfo));
          if (!continueAnyway) return;
          setAcknowledgedConflicts(prev => ({ ...prev, [d]: { count: priorInfo.count, names: priorInfo.names || [] } }));
        } else {
          setAcknowledgedConflicts(prev => ({ ...prev, [d]: { count: 0, names: [] } }));
        }
      } catch (err) {
        addToast('Request Off unavailable', 'We could not verify Request Off availability. Please try again.');
        console.warn('Handled Request Off conflict lookup failure', { operation: 'conflicts', route: 'schedule/request-off', workspaceId: appUser?.restaurantId || '', ghostMode: requestOffGhostMode, code: err?.code || 'request-off-conflict-failed' });
        return;
      } finally {
        setCheckingDate('');
      }
    }
    setSelectedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingTimeOff) return;
    if (selectedDates.length === 0) return addToast('Error', 'Select days on the calendar first.');
    if (isPartial && (!startTime || !endTime)) return addToast('Error', 'Please set partial times.');
    const blockedAfterPublish = selectedDates.filter(d => !postPublishedTimeOffAllowed && !appUser?.isAdmin && isDateInsidePublishedSchedule(d, shifts));
    if (blockedAfterPublish.length) return addToast('Schedule Published', 'One or more selected dates are already published. Ask a manager to adjust the schedule.');
    setIsSubmittingTimeOff(true);
    try {
      const latestConflicts = await fetchConflictInfo(selectedDates, { force: true });
      const changedConflicts = latestConflicts.filter(info => {
        const acknowledged = acknowledgedConflicts[info.date] || { count: 0, names: [] };
        return Number(info.count || 0) > 0 && (Number(info.count || 0) !== Number(acknowledged.count || 0) || (info.names || []).join('|') !== (acknowledged.names || []).join('|'));
      });
      if (changedConflicts.length) {
        const summary = changedConflicts.map(info => `${formatDisplayDate(info.date)}: ${info.count} other request${info.count === 1 ? '' : 's'}${info.names?.length ? ` (${info.names.slice(0, 4).join(', ')}${info.count > 4 ? ', ...' : ''})` : ''}`).join('\n');
        const continueAnyway = window.confirm(`Request Off availability changed before submit.\n\n${summary}\n\nIt might not be available. Do you still want to submit?`);
        if (!continueAnyway) return;
        setAcknowledgedConflicts(prev => changedConflicts.reduce((acc, info) => ({ ...acc, [info.date]: { count: info.count, names: info.names || [] } }), { ...prev }));
      }
      if (requestOffGhostMode) {
        await requestOffApi('ghost-create', { dates: selectedDates, isPartial, startTime, endTime });
        await refreshGhostRequests();
      } else {
        const nowIso = new Date().toISOString();
        await Promise.all(selectedDates.map(d => addDoc(collection(db, 'timeOffRequests'), {
          restaurantId: appUser.restaurantId,
          workspaceId: appUser.restaurantId,
          userId: authUserId,
          employeeId: authUserId,
          rosterUserId: schedulePerson.rosterUserId || schedulePerson.id || '',
          scheduleUserId: getCanonicalScheduleUserId(schedulePerson || appUser),
          authUid: authUserId,
          userEmail: appUser.email || '',
          employeeEmail: schedulePerson.employeeEmail || schedulePerson.email || appUser.email || '',
          userName: appUser.name || appUser.email || 'Employee',
          employeeName: schedulePerson.employeeName || schedulePerson.name || appUser.name || appUser.email || 'Employee',
          date: d,
          isPartial,
          startTime: isPartial ? startTime : '',
          endTime: isPartial ? endTime : '',
          status: 'pending',
          archived: false,
          processed: false,
          requestedAt: nowIso,
          requestedAtMs: Date.now(),
          requestTimestamp: nowIso,
          submittedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: authUserId,
          requestedBy: authUserId,
          requestedByName: appUser.name || appUser.email || 'Employee',
          source: 'time_off_request'
        })));
        await logAudit(appUser, 'TIME_OFF_SUBMITTED', appUser.name || appUser.email || 'Request off', selectedDates.join(', '));
      }
      setSelectedDates([]);
      setAcknowledgedConflicts({});
      addToast('Submitted', 'Your request-off dates were sent for review.');
    } catch (err) {
      addToast('Request not submitted', 'We could not verify Request Off availability. Please try again.');
      console.warn('Handled Request Off submit failure', { operation: requestOffGhostMode ? 'ghost-create' : 'submit', route: 'schedule/request-off', workspaceId: appUser?.restaurantId || '', ghostMode: requestOffGhostMode, code: err?.code || 'request-off-submit-failed' });
    } finally {
      setIsSubmittingTimeOff(false);
    }
  };

  const formatRequestDateLabel = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return 'Date missing';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const formatted = formatDisplayDate(raw);
    return formatted && !/invalid/i.test(formatted) ? formatted : raw;
  };
  const formatRequestTimeLabel = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const formatted = formatShortTime(raw);
    return formatted && !/invalid/i.test(formatted) ? formatted : raw;
  };
  const formatRequestPartialRange = (r = {}) => {
    const start = formatRequestTimeLabel(r.startTime);
    const end = formatRequestTimeLabel(r.endTime);
    if (start && end) return `${start} - ${end}`;
    if (start || end) return start || end;
    return 'Partial day time missing';
  };

  const RequestCard = ({ r }) => {
    const status = normalizeStatus(r);
    const publishedFlag = r.unresolvedPublishedOverlap || r.overlapsPublishedSchedule;
    return <div className={`${T.row} items-start gap-3 ${publishedFlag ? 'border-amber-500/40 bg-amber-900/10' : ''}`}>
      {canManage && <input type="checkbox" checked={selectedRequestIds.includes(r.id)} onChange={e => setSelectedRequestIds(prev => e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id))} className="mt-1 accent-[#8F6040]" />}
      <div className="flex-1 min-w-0">
        <div className="font-black text-white text-sm">{requestSubjectLabel(r)}</div>
        <div className={`text-[10px] font-bold ${T.muted} flex flex-wrap gap-2 mt-0.5`}><span>{formatRequestDateLabel(requestOffDateKey(r) || r.date)}</span>{r.isPartial && <span className="text-[#D4A381]">{formatRequestPartialRange(r)}</span>}<span className="uppercase tracking-widest">{status}</span>{publishedFlag && <span className="text-amber-300">Unresolved on published schedule</span>}</div>
        <div className="mt-1 text-[10px] font-bold text-slate-500">Requested {formatClockDateTime(r.requestedAt || r.submittedAt || r.createdAt || r.requestTimestamp) || 'time not recorded'}{(r.requestedByName || r.userName || r.employeeName) ? ` by ${r.requestedByName || r.userName || r.employeeName}` : ''}</div>
        {isArchivedRequest(r) && <div className="mt-1 text-[10px] font-bold text-slate-500">{r.scheduleId ? `Schedule: ${r.scheduleId}` : 'History record'}{r.publishedAt ? ` • Published ${formatClockDateTime(r.publishedAt)} by ${r.publishedByName || r.publishedBy || 'manager'}` : ''}{r.approvedAt ? ` • Approved ${formatClockDateTime(r.approvedAt)} by ${r.approvedByName || r.approvedBy || ''}` : ''}{r.deniedAt ? ` • Denied ${formatClockDateTime(r.deniedAt)} by ${r.deniedByName || r.deniedBy || ''}` : ''}</div>}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {canManage && status === 'pending' && !isArchivedRequest(r) && <button onClick={() => approveRequest(r)} className="p-2 rounded-lg bg-emerald-900/20 text-emerald-300 border border-emerald-900/50"><Check size={14}/></button>}
        {canManage && status === 'pending' && !isArchivedRequest(r) && <button onClick={() => denyRequest(r)} className="p-2 rounded-lg bg-red-900/20 text-red-300 border border-red-900/50"><X size={14}/></button>}
        {canManage && (isArchivedRequest(r) ? <button onClick={() => restoreRequest(r)} className={T.btnAlt}>Restore</button> : <button onClick={() => archiveRequest(r)} className={T.btnAlt}>Archive</button>)}
        {!canManage && (status === 'pending' || status === 'approved') && !isArchivedRequest(r) && <button type="button" data-testid={`request-off-cancel-${r.id}`} aria-label={`Cancel Request Off for ${formatRequestDateLabel(requestOffDateKey(r) || r.date)}`} title={`Cancel Request Off for ${formatRequestDateLabel(requestOffDateKey(r) || r.date)}`} onClick={() => { if(window.confirm('Cancel this request-off?')) cancelRequest(r); }} className="text-slate-400 hover:text-red-500 p-2 bg-[#1A2126] rounded-lg border border-[#2A353D]"><Trash2 size={14}/></button>}
      </div>
    </div>;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 ${T.card} overflow-hidden`}>
          <div className={`bg-[#12161A] p-3 border-b ${T.border} flex justify-between items-center`}><button onClick={() => changeMonth(-1)} className={T.btnAlt}><ChevronLeft size={16}/></button><h3 className="font-black text-base text-white tracking-tight">{formatDisplayMonth(calMonth)}</h3><button onClick={() => changeMonth(1)} className={T.btnAlt}><ChevronRight size={16}/></button></div>
          <div className={`grid grid-cols-7 border-t ${T.border}`}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`py-1.5 text-center text-[9px] font-black ${T.copper} uppercase border-b border-[#2A353D] bg-[#12161A]`}>{d}</div>)}
            {Array.from({length: firstDayOffset}).map((_,i) => <div key={`empty-${i}`} className={`p-1 border-b border-r ${T.border} bg-[#1A2126] min-h-[45px]`} />)}
            {monthDays.map(d => {
              const isSelected = selectedDates.includes(d);
              const existingReq = myRequests.find(r => requestOffDateKey(r) === d && isActiveTimeOffRequest(r));
              const priorCount = priorRequestInfoForDate(d).count;
              const isPast = d < getToday();
              const holiday = getHoliday(d);
              const dayEvents = monthEvents.filter(e => e.date === d);
              return <div key={d} onClick={() => !isPast && handleToggleDate(d)} className={`p-1 border-b border-r ${T.border} min-h-[50px] flex flex-col items-center justify-start pt-1 transition-colors ${isPast ? 'bg-[#12161A]/50 opacity-50 cursor-not-allowed' : existingReq ? 'bg-red-900/10 cursor-pointer hover:bg-red-900/20 border border-red-900/30 shadow-inner' : isSelected ? 'bg-[#8F6040]/20 border border-[#C59373] cursor-pointer shadow-inner' : 'hover:bg-[#12161A] cursor-pointer'}`}><span className={`text-xs font-black ${isSelected ? T.copper : existingReq ? 'text-red-400' : 'text-slate-300'}`}>{parseInt(d.split('-')[2])}</span>{holiday && <span className="text-[6px] sm:text-[7px] text-amber-500 font-bold uppercase text-center leading-tight mt-0.5 px-0.5">{holiday}</span>}{dayEvents.map(ev => <span key={ev.id} className="text-[6px] sm:text-[7px] text-blue-400 font-bold uppercase text-center leading-tight mt-0.5 px-0.5 w-full truncate" title={ev.title}>{ev.title}</span>)}{checkingDate === d && <Loader2 size={10} className="mt-auto mb-1 text-amber-300 animate-spin"/>}{checkingDate !== d && priorCount > 0 && !existingReq && !isSelected && <span className="text-[7px] font-black uppercase mt-auto mb-0.5 text-amber-300">{priorCount} req</span>}{checkingDate !== d && existingReq && <span className={`text-[7px] font-black uppercase mt-auto mb-1 ${existingReq.status === 'pending' ? 'text-orange-400' : 'text-red-500'}`}>{existingReq.status === 'pending' ? 'Pend' : 'Off'}</span>}{checkingDate !== d && isSelected && <Check size={10} className={`mt-auto mb-1 ${T.copper}`}/>}</div>;
            })}
          </div>
        </div>
        <div className={`${T.card} p-4 sm:p-5 h-max`}>
          <h3 className="font-black text-base mb-1 text-white">Request Off</h3>
          <p className={`text-[10px] font-bold ${T.muted} mb-2 leading-tight`}>Tap specific dates to request off. Use Availability for normal weekly schedules.</p>
          {!postPublishedTimeOffAllowed && !appUser?.isAdmin && <div className="mb-4 bg-amber-900/15 border border-amber-900/40 rounded-xl p-2 text-[10px] font-bold text-amber-200 leading-snug">Time-off requests close once that schedule period has been published.</div>}
          {requestOffGhostMode && ghostListStatus === 'loading' && <div className="mb-4 bg-blue-900/15 border border-blue-900/40 rounded-xl p-2 text-[10px] font-bold text-blue-200 leading-snug">Loading this employee’s Request Off records...</div>}
          {requestOffGhostMode && ghostListStatus === 'error' && <div className="mb-4 bg-red-900/15 border border-red-900/40 rounded-xl p-2 text-[10px] font-bold text-red-200 leading-snug">Request Off records could not load. Try refreshing before submitting.</div>}
          <form onSubmit={handleSubmit} className="space-y-4"><label className={`flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer p-2.5 bg-[#12161A] rounded-xl border ${T.border}`}><input type="checkbox" checked={isPartial} onChange={e=>setIsPartial(e.target.checked)} className="w-4 h-4 rounded bg-[#1A2126] border-[#2A353D] accent-[#8F6040]" />Partial Day Only?</label>{isPartial && <div className="grid grid-cols-2 gap-3"><div><label className={T.label}>Start Time</label><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className={T.input} required /></div><div><label className={T.label}>End Time</label><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className={T.input} required /></div></div>}<button type="submit" disabled={selectedDates.length === 0 || isSubmittingTimeOff || !!checkingDate} className={`w-full ${T.btn} disabled:opacity-50 disabled:cursor-not-allowed`}>{isSubmittingTimeOff ? 'Checking...' : `Submit ${selectedDates.length > 0 ? `(${selectedDates.length})` : ''}`}</button></form>
        </div>
      </div>
      <div className={`${T.card} p-4 request-off-workflow-panel`}>
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 mb-3"><div><h3 className="font-black text-white">Request-Off Workflow</h3><p className={`text-xs font-bold ${T.muted}`}>Default view only shows items that need attention. Published and archived requests stay searchable.</p>{canManage && workflowApiStatus === 'loading' && <p className="text-[10px] font-bold text-blue-300 mt-1">Checking all workspace Request Off records...</p>}{canManage && workflowApiStatus === 'error' && <p className="text-[10px] font-bold text-amber-300 mt-1">Some legacy Request Off records could not be double-checked. Refresh and try again.</p>}</div>{canManage && <div className="request-off-bulk-grid"><button onClick={approveAllVisible} disabled={!!bulkBusy} className={`${T.btnAlt} disabled:opacity-50`}>Approve All Visible</button><button onClick={archiveAllVisible} disabled={!!bulkBusy} className={`${T.btnAlt} disabled:opacity-50`}>Archive All Visible</button>{selectedRequestIds.length > 0 && <button onClick={archiveSelected} disabled={!!bulkBusy} className={`${T.btnAlt} disabled:opacity-50 request-off-span-all`}>Archive selected ({selectedRequestIds.length})</button>}</div>}</div>
        <div className="request-off-control-group"><div className="request-off-control-label">Status</div><div className="request-off-status-grid">{[['needs-review','Needs Review'],['upcoming-approved','Upcoming Approved'],['archived','Published/Archived'],['all','All']].map(([id,label]) => <button key={id} onClick={() => setViewFilter(id)} className={viewFilter === id ? T.btn : T.btnAlt}>{label}</button>)}</div></div>
        <div className="request-off-control-group"><div className="request-off-control-label">Date</div><div className="request-off-date-grid">{[['all','All Dates'],['this-week','This Week'],['next-week','Next Week'],['this-month','This Month'],['next-month','Next Month'],['custom','Custom Range']].map(([id,label]) => <button key={id} onClick={() => setDateFilter(id)} className={`${dateFilter === id ? T.btn : T.btnAlt} ${id === 'custom' ? 'request-off-custom-range' : ''}`}>{label}</button>)}</div>{dateFilter === 'custom' && <div className="request-off-custom-dates"><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className={T.input}/><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className={T.input}/></div>}</div>
        {canManage && <div className="request-off-employee-filter"><label className="request-off-control-label" htmlFor="request-off-employee-filter">Employee</label><select id="request-off-employee-filter" value={employeeFilter} onChange={e=>setEmployeeFilter(e.target.value)} className={`${T.input} request-off-employee-select`} aria-label="Filter Request Off by employee"><option value="">All Employees</option>{requestOffEmployeeOptions.map(group => <optgroup key={group.role} label={group.role}>{group.rows.map(row => <option key={row.value} value={row.value}>{row.label}</option>)}</optgroup>)}</select></div>}
        <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar">{filteredRequests.length === 0 && <FriendlyEmpty title="No requests here" text="Switch filters to review history or upcoming approvals." />}{filteredRequests.map(r => <RequestCard key={r.id} r={r}/>)}</div>
      </div>
      {canManage && <div className={`${T.card} p-4`}><h3 className="font-black text-white text-sm mb-2">Master Override Log</h3><p className={`text-xs font-bold ${T.muted}`}>Manager approvals, denials, archives, restores, cancellations, and published-schedule processing are preserved in audit logs and request history.</p></div>}
    </div>
  );
};

const TabScheduleWorkbench = ({ currentDate, users, shifts, events, timeOffRequests, timePunches, addToast, appUser, clientData = null, availabilityRecords = [] }) => (
  <div className="space-y-5">
    <ScheduleCopilot currentDate={currentDate} users={users} shifts={shifts} timeOffRequests={timeOffRequests} addToast={addToast} appUser={appUser} />
    <TabSchedule currentDate={currentDate} users={users} shifts={shifts} events={events} timeOffRequests={timeOffRequests} timePunches={timePunches} addToast={addToast} appUser={appUser} clientData={clientData} availabilityRecords={availabilityRecords} />
  </div>
);

const ScheduleWarningCard = ({ warning, appUser }) => {
  const memory = useRememberedAlert({
    user: appUser,
    workspaceId: appUser?.restaurantId || '',
    alertId: warning.alertId,
    fingerprint: warning.fingerprint,
    enabled: !!warning.alertId && !!warning.fingerprint,
  });
  if (memory.isDismissed) return null;
  const tone = warning.type === 'coverage-over'
    ? 'bg-blue-900/10 border-blue-900/40 text-blue-200'
    : warning.type === 'coverage-under'
      ? 'bg-amber-900/10 border-amber-900/40 text-amber-200'
      : 'bg-red-900/10 border-red-900/40 text-red-200';
  const titleTone = warning.type === 'coverage-over' ? 'text-blue-300' : warning.type === 'coverage-under' ? 'text-amber-300' : 'text-red-200';
  return <div className={`${tone} border rounded-xl p-3 mb-2 text-sm font-bold`}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className={`font-black ${titleTone}`}>{warning.message}</div>
        {warning.detail && <div className="text-xs text-slate-400 mt-1">{warning.detail}</div>}
      </div>
      <button type="button" onClick={memory.dismiss} aria-label="Dismiss warning" className="min-h-[42px] min-w-[42px] rounded-lg border border-white/10 bg-[#12161A] text-slate-300 hover:text-white flex items-center justify-center"><X size={14}/></button>
    </div>
  </div>;
};

const ScheduleCopilot = ({ currentDate, users = [], shifts = [], timeOffRequests = [], addToast, appUser }) => {
  const [open, setOpen] = useState(false);
  const copilotReadEnabled = Boolean(open && appUser?.restaurantId);
  const templates = useLiveCollection('scheduleTemplates', appUser?.restaurantId, { enabled: copilotReadEnabled, limitCount: 120, debugLabel: 'schedule:copilot:templates' });
  const coverageTargets = useLiveCollection('scheduleCoverageTargets', appUser?.restaurantId, { enabled: copilotReadEnabled, limitCount: 200, debugLabel: 'schedule:copilot:coverage-targets' });
  const dbRoles = useLiveCollection('roles', appUser?.restaurantId, { enabled: copilotReadEnabled, limitCount: 120, debugLabel: 'schedule:copilot:roles' });
  const weekDates = getWeekDates(currentDate);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const safeShifts = Array.isArray(shifts) ? shifts.filter(Boolean) : [];
  const safeUsers = Array.isArray(users) ? users.filter(Boolean) : [];
  const safeTimeOffRequests = Array.isArray(timeOffRequests) ? timeOffRequests.filter(Boolean) : [];
  const safeTemplates = Array.isArray(templates) ? templates.filter(Boolean) : [];
  const weekShifts = safeShifts.filter(s => weekDates.includes(s?.date));
  const activeUsers = safeUsers.filter(u => u?.isActive !== false);
  const [activeTool, setActiveTool] = useState('targets');
  const [templateId, setTemplateId] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateName, setTemplateName] = useState('Normal Week');
  const [templateDesc, setTemplateDesc] = useState('Reusable staffing pattern for this restaurant.');
  const [templateRows, setTemplateRows] = useState([{ dayIndex: 5, role: 'Unassigned', startTime: '16:00', endTime: '21:00', count: 2 }]);
  const [targetForm, setTargetForm] = useState({ dayIndex: 5, role: 'Unassigned', startTime: '16:00', endTime: '21:00', count: 2 });
  const [draggedShiftId, setDraggedShiftId] = useState(null);

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const scheduleRoleOptions = getScheduleStaffRoleOptions(activeUsers, dbRoles);
  const firstScheduleRole = scheduleRoleOptions[0] || 'Unassigned';
  const canonicalScheduleRole = (role) => getRoleFromScheduleStaffList(role, scheduleRoleOptions);

  useEffect(() => {
    setTargetForm(f => {
      const fixedRole = canonicalScheduleRole(f.role);
      return fixedRole === f.role ? f : { ...f, role: fixedRole };
    });
    setTemplateRows(rows => rows.map(row => {
      const fixedRole = canonicalScheduleRole(row.role);
      return fixedRole === row.role ? row : { ...row, role: fixedRole };
    }));
  }, [firstScheduleRole, scheduleRoleOptions.join('|')]);

  const templateOptions = [...safeTemplates].sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  const activeTemplate = safeTemplates.find(t => t.id === templateId) || null;
  const draftCount = weekShifts.filter(s => !s.isPublished).length;
  const coverageVarianceRows = buildCoverageVarianceRows({ coverageTargets, weekDates, weekShifts, roleMatcher: roleMatches, canonicalRole: canonicalScheduleRole });
  const missingTargets = coverageVarianceRows.filter(row => row.type === 'under');
  const coverageWarnings = coverageVarianceRows.map(row => ({
    ...row,
    type: row.type === 'under' ? 'coverage-under' : 'coverage-over',
    alertId: `schedule-${weekStart}-coverage-${row.type}-${row.id}-${row.date}-${row.role}`,
    fingerprint: buildAlertFingerprint('schedule-coverage', weekStart, row.type, row.date, row.role, row.existing, row.count, row.startTime || '', row.endTime || ''),
    message: row.type === 'under'
      ? `${formatDisplayDate(row.date)} needs ${row.needed} more ${row.role}`
      : `${formatDisplayDate(row.date)} has ${row.over} more ${row.role} than the coverage target.`,
    detail: `Existing: ${row.existing} • Target: ${row.count}`,
  }));
  const conflictList = buildScheduleConflictWarningRows({
    weekStart,
    schedule: weekShifts,
    allUsers: safeUsers,
    requests: safeTimeOffRequests,
    resolvePerson: resolveSchedulePersonForShift,
    matchesTimeOff: timeOffMatchesPerson,
    isActiveRequest: isActiveTimeOffRequest,
    employeeLabeler: scheduleWarningEmployeeLabel,
    shiftContext: warningShiftContext,
    fingerprintBuilder: buildAlertFingerprint,
    formatDate: formatDisplayDate,
  });
  const allScheduleWarnings = [...coverageWarnings, ...conflictList];

  const addTemplateRow = () => setTemplateRows([...templateRows, { dayIndex: 5, role: firstScheduleRole, startTime: '16:00', endTime: '21:00', count: 1 }]);
  const updateTemplateRow = (idx, patch) => setTemplateRows(templateRows.map((r,i) => i === idx ? { ...r, ...patch } : r));
  const removeTemplateRow = (idx) => setTemplateRows(templateRows.filter((_,i) => i !== idx));

  const saveTemplate = async (e) => {
    e.preventDefault();
    const payload = { restaurantId: appUser.restaurantId, name: templateName.trim(), description: templateDesc.trim(), rows: templateRows.map(r => ({ ...r, role: canonicalScheduleRole(r.role), dayIndex: parseInt(r.dayIndex,10), count: parseInt(r.count,10) || 1 })), updatedAt: new Date().toISOString(), updatedBy: appUser.name || appUser.email };
    try {
      if (editingTemplateId) { await updateDoc(doc(db, 'scheduleTemplates', editingTemplateId), payload); addToast('Template Updated', 'Schedule template saved.'); }
      else { await addDoc(collection(db, 'scheduleTemplates'), { ...payload, createdAt: new Date().toISOString(), createdBy: appUser.id || 'manager' }); addToast('Template Created', 'Reusable schedule template added.'); }
      setEditingTemplateId(null); setTemplateName('Normal Week'); setTemplateDesc('Reusable staffing pattern for this restaurant.'); setTemplateRows([{ dayIndex: 5, role: firstScheduleRole, startTime: '16:00', endTime: '21:00', count: 2 }]); setActiveTool('templates');
    } catch (err) { addToast('Error', err.message); }
  };

  const editTemplate = (t) => { setEditingTemplateId(t.id); setTemplateName(t.name || 'Template'); setTemplateDesc(t.description || ''); setTemplateRows((t.rows && t.rows.length ? t.rows : [{ dayIndex: 5, role: firstScheduleRole, startTime: '16:00', endTime: '21:00', count: 1 }]).map(r => ({ ...r, role: canonicalScheduleRole(r.role) })));  setActiveTool('template-editor'); };
  const deleteTemplate = async (t) => { if (!window.confirm(`Delete template "${t.name}"?`)) return; try { await deleteDoc(doc(db, 'scheduleTemplates', t.id)); addToast('Deleted', 'Template removed.'); } catch(err) { addToast('Error', err.message); } };

  const saveCurrentWeekAsTemplate = async () => {
    const grouped = {};
    weekShifts.forEach(s => { const key = `${new Date(s.date+'T12:00:00').getDay()}|${canonicalScheduleRole(s.role || users.find(u => u.id === s.employeeId)?.role || 'Staff')}|${s.startTime || '09:00'}|${s.endTime || '17:00'}`; grouped[key] = (grouped[key] || 0) + 1; });
    const rows = Object.entries(grouped).map(([key,count]) => { const [dayIndex, role, startTime, endTime] = key.split('|'); return { dayIndex: parseInt(dayIndex,10), role, startTime, endTime, count }; });
    if (!rows.length) return addToast('No Shifts', 'Build a week first, then save it as a template.');
    try { await addDoc(collection(db, 'scheduleTemplates'), { restaurantId: appUser.restaurantId, name: `Week of ${formatDisplayDate(weekStart)}`, description: 'Saved from actual schedule.', rows, createdAt: new Date().toISOString(), createdBy: appUser.id || 'manager' }); addToast('Saved', 'Current week saved as a reusable template.'); }
    catch(err) { addToast('Error', err.message); }
  };

  const pickUserForShift = (role, date, usedIds = []) => {
    const scheduleRole = canonicalScheduleRole(role);
    const candidates = activeUsers.filter(u => !usedIds.includes(u.id)).filter(u => roleMatches(u.role, scheduleRole));
    const pool = candidates.length ? candidates : activeUsers.filter(u => !usedIds.includes(u.id));
    return pool.find(u => !timeOffRequests.some(r => timeOffMatchesPerson(r, u) && r.date === date && isActiveTimeOffRequest(r))) || pool[0];
  };

  const createShiftDraft = async (row, date, usedIds = []) => {
    const scheduleRole = canonicalScheduleRole(row.role);
    const employee = pickUserForShift(scheduleRole, date, usedIds);
    const finalRole = employee?.role ? canonicalScheduleRole(employee.role) : scheduleRole;
    await addDoc(collection(db, 'shifts'), { restaurantId: appUser.restaurantId, ...buildScheduleIdentityFields(employee || {}), role: finalRole, targetRole: scheduleRole, date, startTime: row.startTime || '09:00', endTime: row.endTime || '17:00', isPublished: false, createdAt: new Date().toISOString(), createdBy: appUser.id || 'schedule-copilot', source: 'schedule_copilot' });
    return employee?.id;
  };

  const applyTemplate = async () => {
    if (!activeTemplate) return addToast('Choose Template', 'Select a template first.');
    if (!window.confirm(`Apply "${activeTemplate.name}" to week of ${formatDisplayDate(weekStart)}? New shifts are added as drafts.`)) return;
    try {
      let made = 0;
      for (const row of (activeTemplate.rows || [])) {
        const date = weekDates[parseInt(row.dayIndex || 0, 10)];
        const used = weekShifts.filter(s => s.date === date).map(s => s.employeeId);
        for (let i=0; i < (parseInt(row.count || 1,10) || 1); i++) { const id = await createShiftDraft(row, date, used); if (id) used.push(id); made++; }
      }
      addToast('Template Applied', `${made} draft shifts created. Review and publish when ready.`);
    } catch (err) { addToast('Error', err.message); }
  };

  const copyPreviousWeek = async () => {
    const prevDates = weekDates.map(d => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() - 7); return formatDate(x); });
    const prevShifts = shifts.filter(s => prevDates.includes(s.date));
    if (!prevShifts.length) return addToast('No Previous Week', 'No shifts found in the previous week.');
    if (!window.confirm(`Copy ${prevShifts.length} shifts from previous week as drafts?`)) return;
    try {
      let made = 0;
      for (const s of prevShifts) {
        const oldIndex = prevDates.indexOf(s.date);
        const date = weekDates[oldIndex];
        if (weekShifts.some(x => x.date === date && x.employeeId === s.employeeId && x.startTime === s.startTime)) continue;
        await addDoc(collection(db, 'shifts'), { restaurantId: appUser.restaurantId, ...buildScheduleIdentityFields(users.find(u => shiftMatchesPerson(s, u, users)) || s), role: canonicalScheduleRole(s.role || users.find(u => u.id === s.employeeId)?.role || 'Staff'), date, startTime: s.startTime, endTime: s.endTime, isPublished: false, copiedFrom: s.id, createdAt: new Date().toISOString(), createdBy: appUser.id || 'copy-week' });
        made++;
      }
      addToast('Copied', `${made} draft shifts copied from previous week.`);
    } catch(err) { addToast('Error', err.message); }
  };

  const addCoverageTarget = async (e) => {
    e.preventDefault();
    const role = canonicalScheduleRole(targetForm.role);
    if (!role || role === 'Unassigned') return addToast('Role Needed', 'Add or assign staff roles first, then create coverage targets from the same Schedule Builder staff list.');
    try { await addDoc(collection(db, 'scheduleCoverageTargets'), { restaurantId: appUser.restaurantId, ...targetForm, role, dayIndex: parseInt(targetForm.dayIndex,10), count: parseInt(targetForm.count,10) || 1, createdAt: new Date().toISOString(), createdBy: appUser.id || 'manager', source: 'schedule_staff_roles' }); setTargetForm(f => ({ ...f, role })); addToast('Target Added', 'Coverage target saved using the Schedule Builder staff role list.'); }
    catch(err) { addToast('Error', err.message); }
  };

  const smartFill = async () => {
    if (!missingTargets.length) return addToast('Covered', 'No missing coverage targets for this week.');
    if (!window.confirm(`Smart Fill will create ${missingTargets.reduce((s,m)=>s+m.needed,0)} draft shifts. Continue?`)) return;
    try {
      let made = 0;
      for (const m of missingTargets) {
        const used = weekShifts.filter(s => s.date === m.date).map(s => s.employeeId);
        for (let i=0; i<m.needed; i++) { const id = await createShiftDraft(m, m.date, used); if (id) used.push(id); made++; }
      }
      addToast('Smart Fill Complete', `${made} draft shifts created from coverage targets.`);
    } catch(err) { addToast('Error', err.message); }
  };

  const publishWeek = async () => {
    const drafts = weekShifts.filter(s => !s.isPublished);
    if (!drafts.length) return addToast('Nothing To Publish', 'No draft shifts found this week.');
    const warningText = allScheduleWarnings.map(w => w.message).slice(0,8).join('\n');
    if (!window.confirm(`Publish ${drafts.length} draft shifts?${warningText ? '\n\nWarnings:\n' + warningText : ''}`)) return;
    try { await Promise.all(drafts.map(s => updateDoc(doc(db, 'shifts', s.id), { isPublished: true, publishedAt: new Date().toISOString(), publishedBy: appUser.id || 'manager' }))); addToast('Published', `${drafts.length} shifts published.`); }
    catch(err) { addToast('Error', err.message); }
  };

  const moveShiftToDay = async (targetDate) => {
    if (!draggedShiftId || !targetDate) return;
    const shift = weekShifts.find(s => s.id === draggedShiftId);
    setDraggedShiftId(null);
    if (!shift) return;
    try {
      await updateDoc(doc(db, 'shifts', shift.id), { date: targetDate, updatedAt: new Date().toISOString(), updatedBy: appUser.id || 'schedule-drag-board' });
      addToast('Shift Moved', `${shift.employeeName || 'Shift'} moved to ${formatDisplayDate(targetDate)}.`);
    } catch (err) { addToast('Error', err.message); }
  };

  const quickUpdateShift = async (shift, patch) => {
    try {
      const next = { ...patch, updatedAt: new Date().toISOString(), updatedBy: appUser.id || 'schedule-quick-edit' };
      if (Object.prototype.hasOwnProperty.call(patch, 'employeeId')) {
        const emp = users.find(u => u.id === patch.employeeId);
        if (emp) Object.assign(next, buildScheduleIdentityFields(emp));
        else Object.assign(next, { scheduleUserId: '', employeeId: '', userId: '', rosterUserId: '', authUid: '', assignedUserId: '', employeeEmail: '', assignedEmail: '', employeeName: 'Unassigned', assignedName: 'Unassigned' });
        next.role = emp?.role || shift.role || 'Staff';
      }
      await updateDoc(doc(db, 'shifts', shift.id), next);
      addToast('Shift Updated', 'Schedule quick edit saved.');
    } catch (err) { addToast('Error', err.message); }
  };

  if (!open) return (
    <div className={`${T.card} schedule-copilot-launcher p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-[#D4A381]/30`}>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381]">Schedule Copilot</div>
        <div className="text-sm font-black text-white mt-0.5">{draftCount} drafts ready</div>
        <div className="text-xs text-slate-400 font-bold mt-0.5">{formatDisplayDate(weekStart)} through {formatDisplayDate(weekEnd)} • Open Copilot Tools for coverage targets, warnings & templates.</div>
      </div>
      <button onClick={() => setOpen(true)} className={`${T.btnAlt} flex items-center justify-center gap-2 flex-shrink-0`}><ChefHat size={16}/> Open Copilot Tools</button>
    </div>
  );

  return (
    <div className={`${T.card} schedule-copilot-compact p-3 space-y-2 border-[#D4A381]/30`}>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 border-b border-[#2A353D] pb-2">
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-widest font-black text-[#D4A381]">Schedule Copilot</div>
          <h3 className="text-sm sm:text-base font-black text-white leading-tight">Templates, Coverage, Smart Fill & Publish Review</h3>
          <p className="text-[10px] text-slate-400 font-bold leading-snug mt-0.5">{formatDisplayDate(weekStart)} through {formatDisplayDate(weekEnd)} • shared Schedule Builder staff roles</p>
        </div>
        <div className="flex flex-wrap gap-1.5 flex-shrink-0"><button onClick={copyPreviousWeek} className={T.btnAlt}>Copy Week</button><button onClick={smartFill} className={T.btnAlt}>Smart Fill</button><button onClick={publishWeek} className={T.btn}>Publish</button><button onClick={() => setOpen(false)} className={T.btnAlt}>Hide</button></div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[['Drafts',draftCount],['Missing',missingTargets.length],['Warnings',allScheduleWarnings.length],['Templates',safeTemplates.length]].map(([label,value]) => <div key={label} className="schedule-copilot-metric bg-[#12161A] border border-[#2A353D]"><span className="text-[8px] uppercase tracking-widest font-black text-slate-500">{label}</span><strong className="text-white">{value}</strong></div>)}
      </div>
      <div className="flex gap-1.5 overflow-x-auto custom-scrollbar border-b border-[#2A353D] pb-2">{[['targets','Coverage'],['templates','Templates'],['template-editor', editingTemplateId ? 'Edit Template' : 'Create Template'],['drag','Drag Board'],['warnings','Warnings']].map(([id,label]) => <button key={id} onClick={() => setActiveTool(id)} className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-widest font-black ${activeTool===id ? `${T.grad} text-slate-900` : 'bg-[#12161A] text-slate-400 hover:text-white'}`}>{label}</button>)}</div>
      <div className="schedule-copilot-body custom-scrollbar space-y-3">
      {activeTool === 'targets' && <div className="grid lg:grid-cols-2 gap-4"><form onSubmit={addCoverageTarget} className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 space-y-2"><h4 className="font-black text-white">Add Coverage Target</h4><p className="text-[10px] font-bold text-slate-400">Roles come from Staff Roster / Settings and match the Schedule Builder staff list.</p><div className="grid grid-cols-2 gap-2"><select value={targetForm.dayIndex} onChange={e=>setTargetForm({...targetForm, dayIndex:e.target.value})} className={T.input}>{dayNames.map((d,i)=><option key={d} value={i}>{d}</option>)}</select><select value={targetForm.role} onChange={e=>setTargetForm({...targetForm, role:e.target.value})} className={T.input}>{scheduleRoleOptions.map(r => <option key={r} value={r}>{r}</option>)}</select><input type="time" value={targetForm.startTime} onChange={e=>setTargetForm({...targetForm, startTime:e.target.value})} className={T.input}/><input type="time" value={targetForm.endTime} onChange={e=>setTargetForm({...targetForm, endTime:e.target.value})} className={T.input}/><input type="number" min="1" value={targetForm.count} onChange={e=>setTargetForm({...targetForm, count:e.target.value})} className={T.input}/><button className={`${T.btn} py-2`}>Save Target</button></div></form><div className="space-y-2">{coverageTargets.length === 0 ? <FriendlyEmpty title="No coverage targets yet" text="Add targets from the same roles shown in the Schedule Builder staff list. Smart Fill and the builder now use one shared role source."/> : coverageTargets.map(t => <div key={t.id} className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 flex justify-between items-center"><div><div className="font-black text-white">{dayNames[t.dayIndex]} • {t.role} x{t.count}</div><div className="text-xs text-slate-400 font-bold">{formatShortTime(t.startTime)} - {formatShortTime(t.endTime)}</div></div><button onClick={() => deleteDoc(doc(db,'scheduleCoverageTargets',t.id))} className="p-2 text-slate-400 hover:text-red-400"><Trash2 size={14}/></button></div>)}</div></div>}
      {activeTool === 'templates' && <div className="space-y-3"><div className="flex flex-col md:flex-row gap-2"><select value={templateId} onChange={e => setTemplateId(e.target.value)} className={`${T.input} flex-1`}><option value="">Select template to apply</option>{templateOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><button onClick={applyTemplate} className={`${T.btn} py-2`}>Apply to Current Week</button><button onClick={saveCurrentWeekAsTemplate} className={T.btnAlt}>Save Current Week</button></div>{templateOptions.length === 0 ? <FriendlyEmpty title="No templates yet" text="Create a Normal Week, Packers Sunday, Fish Fry Friday, or Live Music template. Each restaurant gets its own library."/> : templateOptions.map(t => <div key={t.id} className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 flex justify-between items-center"><div><div className="font-black text-white">{t.name}</div><div className="text-xs text-slate-400 font-bold">{t.description || 'No description'} • {(t.rows || []).length} rules</div></div><div className="flex gap-2"><button onClick={() => editTemplate(t)} className={T.btnAlt}>Edit</button><button onClick={() => deleteTemplate(t)} className="px-3 py-2 rounded-xl bg-red-900/20 text-red-300 border border-red-900/50 text-xs font-black">Delete</button></div></div>)}</div>}
      {activeTool === 'template-editor' && <form onSubmit={saveTemplate} className="space-y-3"><div className="grid md:grid-cols-2 gap-2"><input value={templateName} onChange={e=>setTemplateName(e.target.value)} className={T.input} placeholder="Template name" required/><input value={templateDesc} onChange={e=>setTemplateDesc(e.target.value)} className={T.input} placeholder="Description"/></div><div className="space-y-2">{templateRows.map((r,idx)=><div key={idx} className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-[#12161A] border border-[#2A353D] rounded-xl p-2"><select value={r.dayIndex} onChange={e=>updateTemplateRow(idx,{dayIndex:e.target.value})} className={T.input}>{dayNames.map((d,i)=><option key={d} value={i}>{d}</option>)}</select><select value={r.role} onChange={e=>updateTemplateRow(idx,{role:e.target.value})} className={T.input}>{scheduleRoleOptions.map(roleName => <option key={roleName} value={roleName}>{roleName}</option>)}</select><input type="time" value={r.startTime} onChange={e=>updateTemplateRow(idx,{startTime:e.target.value})} className={T.input}/><input type="time" value={r.endTime} onChange={e=>updateTemplateRow(idx,{endTime:e.target.value})} className={T.input}/><input type="number" min="1" value={r.count} onChange={e=>updateTemplateRow(idx,{count:e.target.value})} className={T.input}/><button type="button" onClick={()=>removeTemplateRow(idx)} className="bg-red-900/20 border border-red-900/50 text-red-300 rounded-xl font-black text-xs">Remove</button></div>)}</div><div className="flex gap-2"><button type="button" onClick={addTemplateRow} className={T.btnAlt}>Add Row</button><button type="submit" className={`${T.btn} py-2`}>{editingTemplateId ? 'Update Template' : 'Create Template'}</button></div></form>}
      {activeTool === 'drag' && <div className="space-y-3"><p className="text-xs text-slate-400 font-bold">Drag shifts between days on desktop, or use the Move to day dropdown on mobile. Quick edit controls can change employee/time without opening the big schedule grid.</p><div className="grid md:grid-cols-7 gap-2">{weekDates.map((date, dayIdx) => <div key={date} onDragOver={e => e.preventDefault()} onDrop={() => moveShiftToDay(date)} className="min-h-[160px] bg-[#12161A] border border-[#2A353D] rounded-xl p-2"><div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mb-2">{dayNames[dayIdx]}<br/><span className="text-slate-500">{date.substring(5)}</span></div>{weekShifts.filter(s => s.date === date).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||'')).map(shift => <div key={shift.id} draggable onDragStart={() => setDraggedShiftId(shift.id)} onDragEnd={() => setDraggedShiftId(null)} className={`mb-2 rounded-lg border p-2 cursor-move ${draggedShiftId === shift.id ? 'border-[#D4A381] bg-[#D4A381]/10' : 'border-[#2A353D] bg-[#1A2126]'}`}><div className="font-black text-white text-xs truncate">{shift.employeeName || users.find(u=>u.id===shift.employeeId)?.name || 'Unassigned'}</div><div className="text-[9px] text-slate-400 font-bold uppercase">{shift.role} • {formatShortTime(shift.startTime)}-{formatShortTime(shift.endTime)}</div><div className="grid grid-cols-1 gap-1 mt-2"><select value="" onChange={e=>e.target.value && quickUpdateShift(shift,{date:e.target.value})} className="bg-[#12161A] border border-[#2A353D] rounded-md px-1.5 py-1 text-[10px] text-[#D4A381] outline-none md:hidden"><option value="">Move to day...</option>{weekDates.map((d,i)=><option key={d} value={d}>{dayNames[i]} {d.substring(5)}</option>)}</select><select value={shift.employeeId || ''} onChange={e=>quickUpdateShift(shift,{employeeId:e.target.value})} className="bg-[#12161A] border border-[#2A353D] rounded-md px-1.5 py-1 text-[10px] text-white outline-none"><option value="">Unassigned</option>{activeUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select><div className="flex gap-1"><input type="time" defaultValue={shift.startTime || '09:00'} onBlur={e=>e.target.value && quickUpdateShift(shift,{startTime:e.target.value})} className="w-full bg-[#12161A] border border-[#2A353D] rounded-md px-1 py-1 text-[10px] text-white"/><input type="time" defaultValue={shift.endTime || '17:00'} onBlur={e=>e.target.value && quickUpdateShift(shift,{endTime:e.target.value})} className="w-full bg-[#12161A] border border-[#2A353D] rounded-md px-1 py-1 text-[10px] text-white"/></div></div></div>)}{weekShifts.filter(s => s.date === date).length === 0 && <div className="border border-dashed border-[#2A353D] rounded-lg p-3 text-center text-[10px] font-bold text-slate-500">Drop shifts here</div>}</div>)}</div></div>}
      {activeTool === 'warnings' && <div className="grid md:grid-cols-2 gap-3"><div>{coverageWarnings.length === 0 ? <FriendlyEmpty title="Coverage targets met" text="No target gaps or over-coverage found for the current week."/> : coverageWarnings.map(w => <ScheduleWarningCard key={w.alertId} warning={w} appUser={appUser} />)}</div><div>{conflictList.length === 0 ? <FriendlyEmpty title="No conflicts found" text="No schedule warning dragons spotted this week."/> : conflictList.map(w => <ScheduleWarningCard key={w.alertId} warning={w} appUser={appUser} />)}</div></div>}
      </div>
    </div>
  );
};

export { TabMasterSchedule, TabSchedule, TabMonth, TabTimeOff, TabScheduleWorkbench, ScheduleCopilot };
