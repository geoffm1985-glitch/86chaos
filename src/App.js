import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Bell, Bug, ChevronLeft, ChevronRight, Loader2, Menu, Moon, Send, X } from 'lucide-react';
import { addDoc, collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import 'leaflet/dist/leaflet.css';
import { T, db, auth, messagingReady, isFirebaseMessagingUnsupportedError, firebaseConfig, CURRENT_VERSION, MASTER_ADMIN_EMAIL, useLiveCollection, useLiveCollectionState, useLiveDocumentState, secureFetch, waitForAuthCurrentUser, getToday, getMonthStr, formatDate, formatDisplayFullDate, formatDisplayMonth, logAudit, setActiveTimeFormat, getOfflineQueue, replayOfflineQueue, startLowCostPresenceSession, useLowCostPresenceSummary, clearTenantListenerCache } from './core/appCore';
import { buildAlertFingerprint, useRememberedAlert } from './core/alertMemory';
import { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, GlobalSearchModal, KitchenTVMode, UndoBar, VoiceCommandDock } from './components/common';
import { LockedFeatureScreen } from './components/PlanGate';
import { usePlanAccess } from './hooks/usePlanAccess';
import { resolveFeatureAccess } from './lib/featureAccess';
import { buildScheduleQueryPlan, buildScheduleDateKeyRangeClauses, mergeLoadedScheduleShifts, shouldEnableScheduleDateKeyRescue } from './core/scheduleQueryPlanner';
import { WHOAMI_STATES, PLATFORM_ADMIN_ACCESS_STATES, classifyWhoamiResponse, mergeVerifiedAccess, resolvePlatformAdminAccessState, shouldHoldAccessHydration } from './core/sessionAccess';
import { FEATURE_KEYS } from './config/plans';
import { LoginScreen } from './features/auth';
import * as runtimeReportStateModule from './core/runtimeReportState.cjs';
import { initChaosPostHog, identifyChaosPostHogUser, resetChaosPostHogIdentity, trackChaosPageView, trackChaosPostHogEvent, trackChaosRuntimeError } from './core/posthogClient';

const resolveCommonJsModule = (moduleValue) => {
  const candidate = moduleValue?.default && typeof moduleValue.default === 'object' ? moduleValue.default : moduleValue;
  return candidate && typeof candidate === 'object' ? candidate : {};
};
const runtimeReportState = resolveCommonJsModule(runtimeReportStateModule);
const fallbackRuntimeString = (value, max = 2000) => String(value == null ? '' : value).slice(0, max);
const fallbackReportIdFactory = (prefix = 'local') => `${String(prefix || 'local').replace(/[^A-Za-z0-9_-]/g, '_')}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`.slice(0, 80);
const createFallbackReportId = typeof runtimeReportState.createFallbackReportId === 'function' ? runtimeReportState.createFallbackReportId : fallbackReportIdFactory;
const normalizeReportId = typeof runtimeReportState.normalizeReportId === 'function' ? runtimeReportState.normalizeReportId : (value) => {
  const raw = fallbackRuntimeString(value, 120).trim();
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{5,119}$/.test(raw) ? raw : '';
};
const buildRuntimeReportFingerprint = typeof runtimeReportState.buildRuntimeReportFingerprint === 'function' ? runtimeReportState.buildRuntimeReportFingerprint : (kind, error = {}, context = {}) => [kind || 'runtime', fallbackRuntimeString(error?.name || 'Error', 120), fallbackRuntimeString(error?.message || error || '', 500), fallbackRuntimeString(context.appVersion || '', 80), fallbackRuntimeString(context.route || '', 300), fallbackRuntimeString(context.activeTab || '', 80), fallbackRuntimeString(context.chunkUrl || '', 500)].join('|');
const beginReportSubmission = typeof runtimeReportState.beginReportSubmission === 'function' ? runtimeReportState.beginReportSubmission : (() => ({ ok: true, state: 'started' }));
const completeReportSubmission = typeof runtimeReportState.completeReportSubmission === 'function' ? runtimeReportState.completeReportSubmission : ((storage, fingerprint, reportId) => ({ ok: Boolean(normalizeReportId(reportId)), reportId: normalizeReportId(reportId), reason: normalizeReportId(reportId) ? '' : 'malformed response' }));
const failReportSubmission = typeof runtimeReportState.failReportSubmission === 'function' ? runtimeReportState.failReportSubmission : (() => ({ ok: false }));
const createRuntimeDiagnostic = typeof runtimeReportState.createRuntimeDiagnostic === 'function' ? runtimeReportState.createRuntimeDiagnostic : ({ fallbackReportId = '', serverReportId = '', status = 'caught', error = {}, componentStack = '', route = '', activeTab = '', appVersion = '', deployedVersion = '', uid = '', workspaceId = '', browser = '', viewport = '', category = 'runtime' } = {}) => ({ fallbackReportId: fallbackRuntimeString(fallbackReportId, 100), serverReportId: fallbackRuntimeString(serverReportId, 120), status: fallbackRuntimeString(status, 80), category: fallbackRuntimeString(category, 80), errorName: fallbackRuntimeString(error?.name || 'Error', 140), errorMessage: fallbackRuntimeString(error?.message || error || '', 2000), rawStack: fallbackRuntimeString(error?.stack || '', 6000), componentStack: fallbackRuntimeString(componentStack || '', 6000), route: fallbackRuntimeString(route, 300), activeTab: fallbackRuntimeString(activeTab, 80), appVersion: fallbackRuntimeString(appVersion, 80), deployedVersion: fallbackRuntimeString(deployedVersion, 80), uid: fallbackRuntimeString(uid, 140), workspaceId: fallbackRuntimeString(workspaceId, 160), browser: fallbackRuntimeString(browser, 400), viewport: fallbackRuntimeString(viewport, 80), timestamp: new Date().toISOString() });
const rememberLocalRuntimeDiagnostic = typeof runtimeReportState.rememberLocalRuntimeDiagnostic === 'function' ? runtimeReportState.rememberLocalRuntimeDiagnostic : (() => {});
const DEFAULT_REPORT_REQUEST_TIMEOUT_MS = Number(runtimeReportState.DEFAULT_REPORT_REQUEST_TIMEOUT_MS || 12000) || 12000;

const CHUNK_LOAD_ERROR_NAME_RE = /^(ChunkLoadError|CSS_CHUNK_LOAD_FAILED)$/i;
const CHUNK_LOAD_ERROR_MESSAGE_RE = /(Loading chunk [^\s]+ failed|ChunkLoadError|Failed to fetch dynamically imported module|Failed to load module script|Importing a module script failed|error loading dynamically imported module|Loading CSS chunk [^\s]+ failed)/i;
const getChunkFailureSignalText = (error) => [
  error?.name,
  error?.message,
  error?.reason?.name,
  error?.reason?.message,
  error?.cause?.name,
  error?.cause?.message
].map(value => String(value || '')).filter(Boolean).join(' ');
const isChunkLoadFailure = (error) => {
  const name = String(error?.name || error?.reason?.name || error?.cause?.name || '');
  if (CHUNK_LOAD_ERROR_NAME_RE.test(name)) return true;
  return CHUNK_LOAD_ERROR_MESSAGE_RE.test(getChunkFailureSignalText(error));
};
const extractChunkUrl = (error) => {
  const text = String(error?.message || '') + ' ' + String(error?.stack || '');
  const match = text.match(/https?:\/\/[^\s)'"]+\.(?:js|css)|\/static\/(?:js|css)\/[^\s)'"]+\.(?:js|css)/i);
  return match ? match[0] : '';
};

const isFirebaseMessagingServiceWorkerRegistration = (registration = {}) => {
  const scriptUrl = String(registration?.active?.scriptURL || registration?.installing?.scriptURL || registration?.waiting?.scriptURL || '');
  return /\/firebase-messaging-sw\.js(?:$|[?#])/i.test(scriptUrl) || scriptUrl.includes('firebase-messaging-sw.js');
};

const clearChunkRecoveryMarkers = () => {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(window.localStorage || {}).filter(key => /^86chaos:chunkRecovery:/i.test(key || ''));
    keys.forEach(key => { try { window.localStorage.removeItem(key); } catch (_) {} });
  } catch (_) {}
  try {
    const keys = Object.keys(window.sessionStorage || {}).filter(key => /^86chaos:chunkRecovery:/i.test(key || ''));
    keys.forEach(key => { try { window.sessionStorage.removeItem(key); } catch (_) {} });
  } catch (_) {}
};

const removeRuntimeRecoveryQueryParams = () => {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    ['chaosReloadAt', 'chaosReloadVersion', 'chaosHardRefresh', 'chaosVersion'].forEach(key => url.searchParams.delete(key));
    window.history.replaceState(window.history.state || {}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch (_) {}
};

const clearRuntimeRecoveryCaches = async (reason = 'manual', options = {}) => {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  const preserveRecoveryMarkers = options.preserveRecoveryMarkers === true;
  const result = { ok: true, reason, cacheNames: [], serviceWorkers: 0, preservedServiceWorkers: 0, errors: [] };
  if (!preserveRecoveryMarkers) clearChunkRecoveryMarkers();
  try {
    if (window.caches?.keys) {
      const names = await window.caches.keys();
      result.cacheNames = names;
      await Promise.allSettled(names.map(name => window.caches.delete(name)));
    }
  } catch (err) { result.errors.push(`caches:${err?.message || err}`); }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    if (Array.isArray(regs) && regs.length) {
      const removable = regs.filter(reg => !isFirebaseMessagingServiceWorkerRegistration(reg));
      result.serviceWorkers = removable.length;
      result.preservedServiceWorkers = regs.length - removable.length;
      await Promise.allSettled(removable.map(reg => reg.unregister?.()));
    }
  } catch (err) { result.errors.push(`serviceWorker:${err?.message || err}`); }
  try { await fetch(`/asset-manifest.json?recovery=${Date.now()}`, { cache: 'no-store' }); } catch (_) {}
  try { await fetch(`/version.json?recovery=${Date.now()}`, { cache: 'no-store' }); } catch (_) {}
  return result;
};

const hardRecoverRuntimeSection = async (reason = 'manual') => {
  try { sessionStorage.setItem('86chaosRuntimeRecoveryReason', String(reason || 'manual').slice(0, 160)); } catch (_) {}
  await clearRuntimeRecoveryCaches(reason);
  const url = new URL(window.location.href);
  url.searchParams.set('chaosHardRefresh', String(Date.now()));
  url.searchParams.set('chaosVersion', CURRENT_VERSION);
  window.location.replace(url.toString());
};


const getRuntimeReportContext = (error, extra = {}, kind = 'section-runtime-error') => {
  const route = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '';
  const activeTab = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('tab') || '') : '';
  const viewport = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '';
  const deployedVersion = typeof window !== 'undefined' ? (window.__CHAOS_VISIBLE_VERSION || window.__CHAOS_DEPLOYED_VERSION || '') : '';
  return {
    kind,
    route,
    activeTab,
    appVersion: CURRENT_VERSION,
    deployedVersion,
    chunkUrl: extractChunkUrl(error),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    viewport,
    uid: auth?.currentUser?.uid || '',
    workspaceId: extra.workspaceId || '',
  };
};

const reportRuntimeErrorWithDeliveryRules = async (kind, error, extra = {}) => {
  const storage = typeof window !== 'undefined' ? window.sessionStorage : null;
  const context = getRuntimeReportContext(error, extra, kind);
  const fingerprint = buildRuntimeReportFingerprint(kind, error, context);
  const fallbackReportId = normalizeReportId(extra.fallbackReportId) || createFallbackReportId(kind === 'chunk-failure' ? 'chunk' : 'section');
  trackChaosRuntimeError(error, {
    kind,
    category: kind,
    source: extra.source || '',
    activeTab: context.activeTab,
    workspaceId: context.workspaceId,
    appVersion: context.appVersion,
    route: context.route,
    chunkUrl: context.chunkUrl
  });
  const diagnosticBase = createRuntimeDiagnostic({
    fallbackReportId,
    status: 'caught',
    category: kind,
    error,
    componentStack: extra.componentStack || '',
    route: context.route,
    activeTab: context.activeTab,
    appVersion: context.appVersion,
    deployedVersion: context.deployedVersion,
    uid: context.uid,
    workspaceId: context.workspaceId,
    browser: context.userAgent,
    viewport: context.viewport,
  });
  rememberLocalRuntimeDiagnostic(storage, diagnosticBase);
  const attempt = beginReportSubmission(storage, fingerprint, { fallbackReportId });
  if (!attempt.ok) return attempt.reportId || '';
  const fail = (reason) => {
    failReportSubmission(storage, fingerprint, reason, fallbackReportId);
    rememberLocalRuntimeDiagnostic(storage, { ...diagnosticBase, status: 'delivery failed', reportSubmissionStatus: reason, timestamp: new Date().toISOString() });
    return '';
  };
  let timer = null;
  try {
    if (!auth.currentUser) return fail('authentication not ready');
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    timer = controller ? setTimeout(() => controller.abort(), DEFAULT_REPORT_REQUEST_TIMEOUT_MS || 12000) : null;
    const response = await secureFetch('/api/report-bug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller?.signal,
      body: JSON.stringify({
        category: 'Crash / Error',
        source: extra.source || (kind === 'chunk-failure' ? 'lazy_chunk_failure' : 'react_section_runtime_error'),
        fallbackReportId,
        message: String(error?.message || error || (kind === 'chunk-failure' ? 'Chunk load failed' : 'Section runtime error')).slice(0, 2000),
        errorName: String(error?.name || (kind === 'chunk-failure' ? 'ChunkLoadError' : 'Error')),
        rawStack: String(error?.stack || '').slice(0, 5000),
        componentStack: String(extra.componentStack || '').slice(0, 5000),
        chunkUrl: context.chunkUrl,
        appVersion: CURRENT_VERSION,
        deployedVersion: context.deployedVersion,
        route: context.route,
        activeTab: context.activeTab,
        userAgent: context.userAgent,
        screenSize: context.viewport,
        url: typeof window !== 'undefined' ? window.location.href : '',
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        serviceWorkerState: typeof navigator !== 'undefined' ? (navigator.serviceWorker?.controller?.state || '') : '',
        diagnostics: { ...extra, fallbackReportId, chunkClassified: kind === 'chunk-failure' }
      })
    });
    if (!response?.ok) return fail(`endpoint rejected ${response?.status || ''}`.trim());
    const data = await response.json().catch(() => null);
    const serverReportId = normalizeReportId(data?.reportId);
    const finished = completeReportSubmission(storage, fingerprint, serverReportId, fallbackReportId);
    if (!finished.ok) return fail(finished.reason || 'malformed response');
    rememberLocalRuntimeDiagnostic(storage, { ...diagnosticBase, status: 'delivered', serverReportId, reportSubmissionStatus: 'delivered', timestamp: new Date().toISOString() });
    return serverReportId;
  } catch (err) {
    return fail(err?.name === 'AbortError' ? 'request timed out' : (err?.message || 'request failed'));
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const reportRuntimeSectionError = (error, extra = {}) => reportRuntimeErrorWithDeliveryRules('section-runtime-error', error, extra);

const reportRuntimeChunkFailure = (error, extra = {}) => reportRuntimeErrorWithDeliveryRules('chunk-failure', error, extra);

const chunkRecoveryStateKey = () => `86chaos:chunkRecovery:${CURRENT_VERSION}:state`;
const readChunkRecoveryState = () => {
  if (typeof window === 'undefined') return null;
  const key = chunkRecoveryStateKey();
  const raw = (() => {
    try { return sessionStorage.getItem(key) || localStorage.getItem(key) || ''; } catch (_) { return ''; }
  })();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) { return null; }
};
const writeChunkRecoveryState = (patch = {}) => {
  if (typeof window === 'undefined') return null;
  const previous = readChunkRecoveryState() || {};
  const at = new Date().toISOString();
  const stage = patch.stage || previous.stage || 'chunk-recovery-visible';
  const transitions = Array.isArray(previous.transitions) ? previous.transitions.slice(-10) : [];
  const next = {
    ...previous,
    ...patch,
    appVersion: CURRENT_VERSION,
    stage,
    updatedAt: at,
    autoReloadCount: Number(patch.autoReloadCount ?? previous.autoReloadCount ?? 0) || 0,
    transitions: [...transitions, { stage, at, chunkUrl: patch.chunkUrl || previous.chunkUrl || '' }]
  };
  const key = chunkRecoveryStateKey();
  const serialized = JSON.stringify(next);
  try { sessionStorage.setItem(key, serialized); } catch (_) {}
  try { localStorage.setItem(key, serialized); } catch (_) {}
  return next;
};
const clearChunkRecoveryState = () => {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(chunkRecoveryStateKey()); } catch (_) {}
  try { localStorage.removeItem(chunkRecoveryStateKey()); } catch (_) {}
};
const renderImmediateChunkRecoverySurface = (state = {}) => {
  if (typeof document === 'undefined') return;
  const id = 'chaos-chunk-recovery-surface';
  let root = document.getElementById(id);
  if (!root) {
    root = document.createElement('div');
    root.id = id;
    document.body?.prepend(root);
  }
  root.setAttribute('data-chaos-recovery-state', state.stage || 'chunk-recovery-visible');
  root.setAttribute('role', 'alert');
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0B0E11;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
  root.innerHTML = `
    <div style="max-width:520px;width:100%;border:1px solid #7f1d1d;background:#1A2126;border-radius:24px;padding:24px;box-shadow:0 20px 80px rgba(0,0,0,.5);">
      <div style="font-size:11px;font-weight:900;letter-spacing:.22em;text-transform:uppercase;color:#D4A381;">Recovering 86 Chaos</div>
      <h1 style="font-size:24px;line-height:1.15;margin:10px 0 8px;font-weight:900;">A stale app chunk failed to load.</h1>
      <p style="font-size:14px;line-height:1.5;color:#CBD5E1;font-weight:700;margin:0 0 16px;">86 Chaos is keeping this recovery screen visible while it refreshes the app shell. This prevents a blank page and avoids reload loops.</p>
      <button type="button" aria-label="Recover app manually" id="chaos-manual-chunk-recover" style="background:#fff;color:#991b1b;border:0;border-radius:12px;padding:12px 16px;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;">Recover app</button>
      <div style="font-size:11px;color:#94A3B8;margin-top:12px;font-weight:700;word-break:break-all;">${String(state.chunkUrl || '').slice(0, 180)}</div>
    </div>`;
  const button = document.getElementById('chaos-manual-chunk-recover');
  if (button) button.onclick = () => {
    const current = writeChunkRecoveryState({ stage: 'manual-recovery-clicked', autoReloadCount: Number(state.autoReloadCount || 0) });
    renderImmediateChunkRecoverySurface(current || state);
    window.location.reload();
  };
};
const recoverFromChunkFailureOnce = async (error, exportName = 'section') => {
  if (!isChunkLoadFailure(error) || typeof window === 'undefined') throw error;
  const chunkUrl = extractChunkUrl(error) || exportName;
  const reloadUsedKey = `86chaos:chunkRecovery:${CURRENT_VERSION}:autoReloadUsed`;
  const inFlightKey = `86chaos:chunkRecovery:${CURRENT_VERSION}:autoReloadInFlight`;
  const readRecoveryMarker = (key) => {
    try { return sessionStorage.getItem(key) || localStorage.getItem(key) || ''; } catch (_) { return ''; }
  };
  const writeRecoveryMarker = (key, value) => {
    try { sessionStorage.setItem(key, value); } catch (_) {}
    try { localStorage.setItem(key, value); } catch (_) {}
  };
  const alreadyReloaded = readRecoveryMarker(reloadUsedKey);
  const reloadInFlight = window.__chaosChunkRecoveryInFlight || readRecoveryMarker(inFlightKey);
  const priorState = readChunkRecoveryState() || {};
  if (!alreadyReloaded && !reloadInFlight && Number(priorState.autoReloadCount || 0) < 1) {
    const stamp = new Date().toISOString();
    window.__chaosChunkRecoveryInFlight = true;
    const recoveryState = writeChunkRecoveryState({
      stage: 'auto-recovery-started',
      chunkUrl,
      exportName,
      autoReloadCount: 1,
      firstNonemptyRecoveryUi: 'immediate-dom-overlay',
      finalRouteState: `${window.location.pathname}${window.location.search}`,
      startedAt: stamp
    });
    renderImmediateChunkRecoverySurface(recoveryState || { stage: 'auto-recovery-started', chunkUrl, autoReloadCount: 1 });
    writeRecoveryMarker(inFlightKey, stamp);
    writeRecoveryMarker(reloadUsedKey, `${stamp}|${chunkUrl}`);
    await reportRuntimeChunkFailure(error, { source: 'lazy_feature_import', exportName, chunkAutoReload: 'one-shot', recoveryState: 'auto-recovery-started' });
    writeChunkRecoveryState({ stage: 'clearing-runtime-caches', chunkUrl, autoReloadCount: 1 });
    await clearRuntimeRecoveryCaches('auto-chunk-recovery', { preserveRecoveryMarkers: true });
    try {
      const registration = await navigator.serviceWorker?.getRegistration?.();
      await registration?.update?.();
    } catch (_) {}
    try { await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store' }); } catch (_) {}
    const url = new URL(window.location.href);
    url.searchParams.set('chaosReloadVersion', CURRENT_VERSION);
    url.searchParams.set('chaosReloadAt', String(Date.now()));
    writeChunkRecoveryState({ stage: 'navigating-after-cache-clear', chunkUrl, autoReloadCount: 1, finalRouteState: url.toString() });
    window.location.replace(url.toString());
    return new Promise(() => {});
  }
  const state = writeChunkRecoveryState({
    stage: 'manual-recovery-required',
    chunkUrl,
    exportName,
    autoReloadCount: Number(priorState.autoReloadCount || 1) || 1,
    firstNonemptyRecoveryUi: priorState.firstNonemptyRecoveryUi || 'manual-dom-overlay',
    finalRouteState: `${window.location.pathname}${window.location.search}`
  });
  renderImmediateChunkRecoverySurface(state || { stage: 'manual-recovery-required', chunkUrl, autoReloadCount: 1 });
  await reportRuntimeChunkFailure(error, { source: 'lazy_feature_import', exportName, chunkAutoReload: 'already-used', recoveryState: 'manual-recovery-required' });
  throw error;
};
const lazyFeature = (loader, exportName) => React.lazy(() => loader()
  .then(module => ({ default: module[exportName] }))
  .catch(error => recoverFromChunkFailureOnce(error, exportName)));
const TabMasterSchedule = lazyFeature(() => import('./features/schedule'), 'TabMasterSchedule');
const TabSchedule = lazyFeature(() => import('./features/schedule'), 'TabSchedule');
const TabOpsCenter = lazyFeature(() => import('./features/operations'), 'TabOpsCenter');
const TabToday = lazyFeature(() => import('./features/operations'), 'TabToday');
const TabPrep = lazyFeature(() => import('./features/operations'), 'TabPrep');
const TabRecipes = lazyFeature(() => import('./features/operations'), 'TabRecipes');
const TabMaintenance = lazyFeature(() => import('./features/operations'), 'TabMaintenance');
const TabInventory = lazyFeature(() => import('./features/inventory'), 'TabInventory');
const TabFinancials = lazyFeature(() => import('./features/management'), 'TabFinancials');
const TabBackOffice = lazyFeature(() => import('./features/management'), 'TabBackOffice');
const TabMessages = lazyFeature(() => import('./features/management'), 'TabMessages');
const TabTeam = lazyFeature(() => import('./features/management'), 'TabTeam');
const TabSettings = lazyFeature(() => import('./features/management'), 'TabSettings');
const TabHelpCenter = lazyFeature(() => import('./features/management'), 'TabHelpCenter');
const TabGodMode = lazyFeature(() => import('./features/management'), 'TabGodMode');
const TabAuditLog = lazyFeature(() => import('./features/management'), 'TabAuditLog');
const TabPersonalReminders = lazyFeature(() => import('./features/intelligence'), 'TabPersonalReminders');
const TabMenuIntelligence = lazyFeature(() => import('./features/intelligence'), 'TabMenuIntelligence');
const TabAITools = lazyFeature(() => import('./features/intelligence'), 'TabAITools');
const TabHrTraining = lazyFeature(() => import('./features/hr'), 'TabHrTraining');


const parseForceLogoutTimeMs = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate().getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const getAuthLastSignInTimeMs = () => {
  try {
    const parsed = new Date(auth?.currentUser?.metadata?.lastSignInTime || '').getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (_) {
    return 0;
  }
};

const FORCE_LOGOUT_LEGACY_BLOCK_MS = 2 * 60 * 1000;
const REMOTE_REFRESH_RECENT_SIGNAL_MS = 15 * 60 * 1000;

const getCurrentAuthSessionStartedMs = () => {
  try {
    const uid = String(auth?.currentUser?.uid || 'anonymous');
    const key = `86chaos:authSessionStarted:${uid}`;
    const existing = Number(sessionStorage.getItem(key) || '0');
    if (existing > 0) return existing;
    const signInMs = getAuthLastSignInTimeMs();
    const started = signInMs || Date.now();
    sessionStorage.setItem(key, String(started));
    return started;
  } catch (_) {
    return getAuthLastSignInTimeMs() || Date.now();
  }
};

const getForceLogoutEventKey = (user = {}) => {
  const userId = String(user?.id || auth?.currentUser?.uid || user?.email || 'unknown').toLowerCase();
  const stamp = parseForceLogoutTimeMs(user?.forceLogoutAt || user?.forceLogoutTime || user?.forcedLogoutAt || user?.logoutBefore || user?.sessionRevokedAt);
  const nonce = String(user?.forceLogoutNonce || user?.sessionRevokeNonce || '').slice(0, 80);
  const reason = String(user?.forceLogoutReason || 'force-logout').slice(0, 80);
  return `86chaos:forceLogoutHandled:${userId}:${stamp || 'legacy'}:${nonce || reason}`;
};

const hasCurrentLoginAlreadyHonoredForceLogout = (user = {}) => {
  const forceAtMs = parseForceLogoutTimeMs(user?.forceLogoutAt || user?.forceLogoutTime || user?.forcedLogoutAt || user?.logoutBefore || user?.sessionRevokedAt);
  const signInMs = Math.max(getAuthLastSignInTimeMs(), getCurrentAuthSessionStartedMs());
  if (forceAtMs && signInMs && signInMs > forceAtMs + 1000) return true;
  // Old global-cache flags without a timestamp are not reliable enough to keep blocking logins.
  // Honor them only briefly on the active browser, then let the employee back in.
  if (!forceAtMs) {
    const legacySeenKey = getForceLogoutEventKey(user);
    try {
      const handledAt = Number(localStorage.getItem(legacySeenKey) || sessionStorage.getItem(legacySeenKey) || '0');
      if (handledAt > 0) return true;
    } catch (_) {}
    return false;
  }
  const key = getForceLogoutEventKey(user);
  try {
    const handledAt = Number(localStorage.getItem(key) || sessionStorage.getItem(key) || '0');
    if (handledAt >= forceAtMs) return true;
  } catch (_) {}
  return false;
};

const shouldHonorForceLogoutNow = (user = {}) => {
  const forceAtMs = parseForceLogoutTimeMs(user?.forceLogoutAt || user?.forceLogoutTime || user?.forcedLogoutAt || user?.logoutBefore || user?.sessionRevokedAt);
  if (hasCurrentLoginAlreadyHonoredForceLogout(user)) return false;
  if (!forceAtMs) {
    // Legacy flags can clear one stale browser session, but never lock a user out indefinitely.
    return Date.now() - getCurrentAuthSessionStartedMs() <= FORCE_LOGOUT_LEGACY_BLOCK_MS;
  }
  return true;
};

const markForceLogoutHandledLocally = (user = {}) => {
  const key = getForceLogoutEventKey(user);
  const forceAtMs = parseForceLogoutTimeMs(user?.forceLogoutAt || user?.forceLogoutTime || user?.forcedLogoutAt || user?.logoutBefore || user?.sessionRevokedAt) || Date.now();
  try { localStorage.setItem(key, String(forceAtMs)); } catch (_) {}
  try { sessionStorage.setItem(key, String(forceAtMs)); } catch (_) {}
};

const getRemoteRefreshSignalValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
    return String(value);
  }
  return '';
};

const maybeApplyRemoteRefreshSignal = (scope = 'global', signal = '', reason = '') => {
  const normalized = getRemoteRefreshSignalValue(signal);
  if (!normalized || typeof window === 'undefined') return false;
  const key = `86chaos:lastRemoteRefreshSignal:${scope}`;
  let previous = '';
  try { previous = localStorage.getItem(key) || sessionStorage.getItem(key) || ''; } catch (_) {}
  if (previous === normalized) return false;
  try { localStorage.setItem(key, normalized); } catch (_) {}
  try { sessionStorage.setItem(key, normalized); } catch (_) {}
  const signalMs = parseForceLogoutTimeMs(normalized);
  const recentSignal = signalMs > 0 && Date.now() - signalMs <= REMOTE_REFRESH_RECENT_SIGNAL_MS;
  if (previous || recentSignal) {
    try { sessionStorage.setItem('86chaosLastRemoteRefreshReason', String(reason || 'system-admin-refresh').slice(0, 160)); } catch (_) {}
    setTimeout(() => window.location.reload(), 75);
    return true;
  }
  return false;
};

class AppSurfaceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, reportId: '', fallbackReportId: '' };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    const chunkProblem = isChunkLoadFailure(error);
    const fallbackReportId = createFallbackReportId(chunkProblem ? 'chunk' : 'section');
    this.setState({ fallbackReportId, reportId: fallbackReportId });
    const reporter = chunkProblem ? reportRuntimeChunkFailure : reportRuntimeSectionError;
    reporter(error, { source: chunkProblem ? 'react_error_boundary_chunk' : 'react_error_boundary', componentStack: info?.componentStack || '', fallbackReportId }).then(reportId => {
      if (reportId) this.setState({ reportId });
    });
  }
  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, reportId: '', fallbackReportId: '' });
    }
  }
  retrySection = () => {
    this.setState({ error: null, reportId: '', fallbackReportId: '' });
    if (typeof this.props.onRetry === 'function') this.props.onRetry();
  };
  render() {
    const error = this.state.error;
    if (!error) return this.props.children;
    const chunkProblem = isChunkLoadFailure(error);
    return (
      <div className={`${T.card} max-w-2xl mx-auto p-6 sm:p-8 text-center space-y-4`} role="alert">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#D4A381]">86 Chaos Runtime Recovery</div>
        <h2 className="text-2xl font-black text-white">{chunkProblem ? 'App update required' : 'This section hit a snag'}</h2>
        <p className="text-sm font-bold text-slate-300 leading-relaxed">
          {chunkProblem ? 'A stale app file failed to load. Refreshing pulls the newest 86 Chaos files without clearing your login or restaurant data.' : 'The app caught the error instead of going blank. Refresh this section and check the Bug Ledger if it repeats.'}
        </p>
        {this.state.reportId && <p className="text-xs font-mono text-slate-400">Report ID: {this.state.reportId}</p>}
        {chunkProblem ? (
          <button type="button" onClick={() => hardRecoverRuntimeSection('stale-section-chunk')} className={T.btn}>Clear App Cache & Reload</button>
        ) : (
          <button type="button" onClick={this.retrySection} className={T.btn}>Retry This Section</button>
        )}
      </div>
    );
  }
}

const RouteLoading = ({ label = 'Loading section...' }) => (
  <div className={`${T.card} p-6 sm:p-8 max-w-xl mx-auto text-center space-y-3`}>
    <Loader2 className="animate-spin mx-auto text-[#D4A381]" size={28} />
    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#D4A381]">86 Chaos</div>
    <p className="text-sm font-bold text-slate-300">{label}</p>
  </div>
);

const normalizeEmail = (value) => String(value || '').toLowerCase().trim();
const workspaceMemberDocId = (uid = '', restaurantId = '') => `${String(uid || '').replace(/[^A-Za-z0-9_-]/g, '_')}_${String(restaurantId || '').replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 240);
const safeWorkspaceName = (workspace = {}) => workspace.restaurantName || workspace.name || workspace.businessName || workspace.restaurantId || '86 Chaos Workspace';
const normalizeDisplayNameKey = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const looksLikeMachineLoginName = (value = '', email = '') => {
  const text = String(value || '').trim();
  if (!text) return false;
  const compact = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const emailLocal = String(email || '').split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  return Boolean((emailLocal && compact === emailLocal) || /^[a-z]+[a-z0-9._-]*\d{2,}$/i.test(text));
};
const looksLikeWorkspaceBusinessName = (value = '', workspace = {}) => {
  const key = normalizeDisplayNameKey(value);
  if (!key) return false;
  return [workspace.restaurantName, workspace.businessName, workspace.restaurantId, workspace.workspaceName, workspace.clientName]
    .map(normalizeDisplayNameKey)
    .filter(Boolean)
    .includes(key);
};
const resolveWorkspacePersonDisplayName = (member = {}, accountUser = {}, workspace = {}) => {
  const email = member.email || member.employeeEmail || accountUser.email || accountUser.employeeEmail || '';
  const preferred = [member.employeeName, member.staffName, member.fullName, member.displayName, accountUser.employeeName, accountUser.fullName, accountUser.displayName, accountUser.accountProfile?.name, accountUser.name]
    .map(value => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(value => value && !looksLikeWorkspaceBusinessName(value, workspace) && !looksLikeMachineLoginName(value, email));
  if (preferred.length) return preferred[0];
  const safeMemberName = String(member.name || '').replace(/\s+/g, ' ').trim();
  if (safeMemberName && !looksLikeWorkspaceBusinessName(safeMemberName, workspace)) return safeMemberName;
  const safeAccountName = String(accountUser.name || '').replace(/\s+/g, ' ').trim();
  if (safeAccountName && !looksLikeWorkspaceBusinessName(safeAccountName, workspace)) return safeAccountName;
  return email || 'Staff';
};

const normalizeWorkspaceName = (workspace = {}) => String(safeWorkspaceName(workspace)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isFullAuditQaWorkspaceName = (workspace = {}) => {
  const name = normalizeWorkspaceName(workspace);
  return name === '86 chaos full audit qa restaurant' || name.startsWith('86 chaos full audit qa restaurant ');
};
const isDeletedOrHiddenWorkspace = (workspace = {}) => Boolean(
  !workspace ||
  workspace.isActive === false ||
  workspace.archived === true ||
  workspace.deleted === true ||
  workspace.deletedAt ||
  workspace.deleted_at ||
  workspace.deletionScheduledFor ||
  workspace.hardDeleted === true ||
  (workspace.membershipSource === 'stale-missing-restaurant')
);
const isSelectableWorkspace = (workspace = {}) => Boolean((workspace.restaurantId || workspace.id) && !isDeletedOrHiddenWorkspace(workspace));

const LEGACY_TAB_ALIASES = {
  'manager-brief': 'today',
  'today-home': 'today',
  'kitchen-command': 'ops',
  'command-center': 'ops',
  'time-clock': 'published',
  'timeclock': 'published',
  'my-schedule': 'published',
  'staff-roster': 'team',
  'roster': 'team',
  'message-board': 'messages',
  'help-center': 'help',
  'admin-manual': 'help',
  'hr': 'hr-training',
  'backoffice': 'back-office',
  'owner-office': 'back-office',
  'office': 'back-office',
  'back-office-suite': 'back-office'
};
const normalizeRouteTab = (tab = 'today') => LEGACY_TAB_ALIASES[String(tab || '').trim()] || String(tab || 'today').trim() || 'today';
const SCHEDULE_INITIAL_SUBTABS = new Set(['my-schedule', 'full-schedule', 'month-view', 'trade-board', 'time-off', 'availability', 'schedule-builder']);
const peekScheduleFocusSubTab = () => {
  if (typeof window === 'undefined') return '';
  try {
    const requested = window.sessionStorage?.getItem('scheduleFocus') || '';
    return SCHEDULE_INITIAL_SUBTABS.has(requested) ? requested : '';
  } catch (_) {
    return '';
  }
};
const defaultScheduleSubTabForTopLevelTab = (tab = 'published') => {
  const normalized = normalizeRouteTab(tab);
  if (normalized === 'schedule') return 'schedule-builder';
  if (normalized === 'published') {
    const focused = peekScheduleFocusSubTab();
    if (focused) return focused;
  }
  return 'my-schedule';
};
const resolveInitialTopLevelTab = (defaultTab = 'today') => {
  const fallback = normalizeRouteTab(defaultTab || 'today');
  if (typeof window === 'undefined' || !window.location) return fallback;
  try {
    const requested = new URLSearchParams(window.location.search).get('tab');
    return requested ? normalizeRouteTab(requested) : fallback;
  } catch (_) {
    return fallback;
  }
};
const CHAOS_PWA_BACK_EXIT_WINDOW_MS = 2000;
const isStandalone86ChaosPwa = () => {
  if (typeof window === 'undefined') return false;
  try { if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true; } catch (_) {}
  try { if (window.navigator?.standalone === true) return true; } catch (_) {}
  return false;
};
const appTabUrl = (tab = 'today') => `?tab=${normalizeRouteTab(tab)}`;
const buildSafeSessionCache = (user = {}) => user ? {
  id: user.id || user.userId || '',
  userId: user.userId || user.id || '',
  uid: user.uid || user.authUid || user.userId || user.id || '',
  authUid: user.authUid || user.uid || user.userId || user.id || '',
  profileDocId: user.profileDocId || user.accountProfile?.id || user.id || user.userId || '',
  name: user.name || 'Staff',
  email: normalizeEmail(user.email || user.employeeEmail || user.accountProfile?.email || ''),
  photoURL: user.photoURL || '',
  restaurantId: user.restaurantId || '',
  activeRestaurantId: user.activeRestaurantId || user.restaurantId || '',
  defaultRestaurantId: user.defaultRestaurantId || user.restaurantId || '',
  restaurantName: user.restaurantName || '',
  membershipId: user.membershipId || '',
  workspaceMemberId: user.workspaceMemberId || user.membershipId || '',
  lastWorkspaceId: user.lastWorkspaceId || user.activeRestaurantId || user.restaurantId || '',
  workspaceSwitcherReady: user.workspaceSwitcherReady === true,
  sessionCached: true,
  accessHydrationRequired: true
} : null;
const parseCachedSessionUser = (raw = '') => {
  try { return buildSafeSessionCache(JSON.parse(raw)); }
  catch (_) { return null; }
};
const hasOwn = (value, key) => Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
const resolveWorkspaceAccess = (currentUser = {}, workspace = {}) => {
  const restaurantId = workspace.restaurantId || currentUser.restaurantId || '';
  const mappedMembership = currentUser?.memberships?.[restaurantId];
  const hasScopedMembership = Boolean(
    mappedMembership ||
    workspace.membershipSource ||
    workspace.workspaceMemberId ||
    ['permissions', 'isAdmin', 'isOwner', 'accountOwner', 'workspaceOwner'].some(key => hasOwn(workspace, key))
  );
  const scoped = mappedMembership ? { ...mappedMembership, ...workspace, permissions: { ...(mappedMembership.permissions || {}), ...(workspace.permissions || {}) } } : workspace;
  const primaryIds = new Set([
    currentUser.restaurantId,
    currentUser.defaultRestaurantId,
    currentUser?.accountProfile?.defaultRestaurantId
  ].filter(Boolean));
  const mayUseLegacyProfile = !hasScopedMembership && (!restaurantId || primaryIds.has(restaurantId));
  return {
    restaurantId,
    hasScopedMembership,
    permissions: hasScopedMembership ? { ...(scoped.permissions || {}) } : (mayUseLegacyProfile ? { ...(currentUser.permissions || {}) } : {}),
    isAdmin: hasScopedMembership ? scoped.isAdmin === true : Boolean(mayUseLegacyProfile && currentUser.isAdmin === true),
    isOwner: hasScopedMembership
      ? Boolean(scoped.isOwner === true || scoped.accountOwner === true || scoped.workspaceOwner === true)
      : Boolean(mayUseLegacyProfile && (currentUser.isOwner === true || currentUser.accountOwner === true || currentUser.owner === true || currentUser.workspaceOwner === true || String(currentUser.accountRole || '').toLowerCase() === 'owner')),
    accountOwner: hasScopedMembership ? scoped.accountOwner === true : Boolean(mayUseLegacyProfile && currentUser.accountOwner === true),
    workspaceOwner: hasScopedMembership ? scoped.workspaceOwner === true : Boolean(mayUseLegacyProfile && currentUser.workspaceOwner === true),
    accountRole: hasScopedMembership ? String(scoped.accountRole || '') : (mayUseLegacyProfile ? String(currentUser.accountRole || '') : '')
  };
};
const buildWorkspaceUser = (currentUser = {}, workspace = {}) => {
  const accountProfile = currentUser.accountProfile || {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    phone: currentUser.phone,
    photoURL: currentUser.photoURL,
    isSuperAdmin: currentUser.isSuperAdmin,
    systemAccess: currentUser.systemAccess,
    defaultRestaurantId: currentUser.defaultRestaurantId || currentUser.restaurantId,
    workspaceIds: currentUser.workspaceIds || [],
    memberships: currentUser.memberships || {}
  };
  const userId = currentUser.id || workspace.userId || workspace.uid || accountProfile.id;
  const scopedAccess = resolveWorkspaceAccess(currentUser, workspace);
  return {
    ...currentUser,
    id: userId,
    userId,
    accountProfile: { ...accountProfile, id: userId },
    restaurantId: workspace.restaurantId || currentUser.restaurantId,
    restaurantName: safeWorkspaceName(workspace),
    membershipId: workspace.membershipId || workspace.id || currentUser.membershipId || '',
    name: resolveWorkspacePersonDisplayName(workspace, currentUser, workspace),
    email: normalizeEmail(workspace.email || currentUser.email || accountProfile.email),
    phone: workspace.phone || currentUser.phone || accountProfile.phone || '',
    role: workspace.role || currentUser.role || 'Staff',
    wage: workspace.wage ?? currentUser.wage ?? 0,
    photoURL: workspace.photoURL || currentUser.photoURL || accountProfile.photoURL || '',
    isAdmin: currentUser.isSuperAdmin === true || scopedAccess.isAdmin,
    isSuperAdmin: currentUser.isSuperAdmin === true,
    systemAccess: currentUser.systemAccess || accountProfile.systemAccess || {},
    superAdminAccessSource: currentUser.superAdminAccessSource || accountProfile.superAdminAccessSource || '',
    platformAdminVerification: currentUser.platformAdminVerification || accountProfile.platformAdminVerification || null,
    isOwner: scopedAccess.isOwner,
    owner: scopedAccess.isOwner,
    accountOwner: scopedAccess.accountOwner,
    workspaceOwner: scopedAccess.workspaceOwner,
    accountRole: scopedAccess.accountRole,
    permissions: scopedAccess.permissions,
    activeRestaurantId: workspace.restaurantId || currentUser.activeRestaurantId || currentUser.restaurantId,
    defaultRestaurantId: currentUser.defaultRestaurantId || workspace.restaurantId || currentUser.restaurantId,
    availableWorkspaces: currentUser.availableWorkspaces || [],
    workspaceSwitcherReady: true
  };
};
const workspaceMemberIsActive = (member = {}) => {
  const status = String(member.status || member.recordStatus || member.membershipStatus || '').toLowerCase().trim();
  return member.isActive !== false && member.deleted !== true && member.isDeleted !== true && member.removed !== true && !['deleted', 'removed', 'inactive', 'disabled', 'deactivated'].includes(status);
};

const userFromWorkspaceMember = (member = {}, accountUser = {}) => {
  const memberOwner = Boolean(member.isOwner === true || member.accountOwner === true || member.workspaceOwner === true);
  const membershipId = member.membershipId || member.id || '';
  const accountUid = member.authUid || member.uid || member.userId || accountUser.authUid || accountUser.uid || accountUser.userId || accountUser.id || '';
  const rosterId = member.scheduleUserId || member.rosterUserId || member.employeeId || membershipId || accountUser.scheduleUserId || accountUser.employeeId || accountUser.rosterUserId || '';
  const stableUserId = member.userId || member.uid || accountUser.id || membershipId;
  return {
    ...accountUser,
    ...Object.fromEntries(Object.entries(member).filter(([key]) => key !== 'id')),
    name: resolveWorkspacePersonDisplayName(member, accountUser, member),
    id: stableUserId,
    userId: stableUserId,
    accountUserId: accountUid || stableUserId,
    authUid: member.authUid || accountUser.authUid || member.uid || accountUser.uid || member.userId || accountUser.userId || '',
    uid: member.uid || accountUser.uid || accountUid || stableUserId,
    membershipId,
    workspaceMemberId: membershipId,
    scheduleUserId: member.scheduleUserId || rosterId || stableUserId,
    employeeId: member.employeeId || rosterId || stableUserId,
    rosterUserId: member.rosterUserId || membershipId || member.employeeId || '',
    employeeEmail: member.employeeEmail || member.email || accountUser.employeeEmail || accountUser.email || '',
    restaurantId: member.restaurantId || accountUser.restaurantId,
    restaurantName: safeWorkspaceName(member),
    permissions: { ...(member.permissions || {}) },
    isAdmin: member.isAdmin === true || accountUser.isSuperAdmin === true,
    isSuperAdmin: accountUser.isSuperAdmin === true,
    systemAccess: accountUser.systemAccess || {},
    superAdminAccessSource: accountUser.superAdminAccessSource || '',
    platformAdminVerification: accountUser.platformAdminVerification || null,
    isOwner: memberOwner,
    owner: memberOwner,
    accountOwner: member.accountOwner === true,
    workspaceOwner: member.workspaceOwner === true,
    accountRole: memberOwner ? 'owner' : String(member.accountRole || ''),
    isActive: workspaceMemberIsActive(member) && accountUser.isActive !== false
  };
};

export default function App() {
  const [appUser, setAppUser] = useState(() => { 
    try {
      const savedLocal = localStorage.getItem('86chaosUser'); 
      const savedSession = sessionStorage.getItem('86chaosUser');
      return savedLocal ? parseCachedSessionUser(savedLocal) : (savedSession ? parseCachedSessionUser(savedSession) : null);
    } catch (err) {
      console.warn('Stored session was corrupted. Clearing local session cache.', err);
      localStorage.removeItem('86chaosUser');
      sessionStorage.removeItem('86chaosUser');
      return null;
    }
  });
  // --- GHOST MODE & ROUTING STATE ---
  const [ghostTenant, setGhostTenant] = useState(null);
      
  const rId = ghostTenant ? ghostTenant.id : appUser?.restaurantId;
  const authenticatedUid = auth?.currentUser?.uid || appUser?.id || '';
  const [initialRouteState] = useState(() => {
    const topLevelTab = resolveInitialTopLevelTab(appUser?.preferences?.defaultTab || 'today');
    return { topLevelTab, scheduleSubTab: defaultScheduleSubTabForTopLevelTab(topLevelTab) };
  });
  const [activeTabState, setActiveTabState] = useState(initialRouteState.topLevelTab);
  const activeTabStateRef = useRef(activeTabState);
  const pwaBackExitRef = useRef({ armed: false, timer: null, initialized: false, exiting: false });
  const [helpOriginState, setHelpOriginState] = useState('');
  const [clientData, setClientData] = useState(null);
  const [heartbeatDebug, setHeartbeatDebug] = useState(null);
  const clientFeatures = clientData?.features || {};
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [debouncedGlobalSearchQuery, setDebouncedGlobalSearchQuery] = useState('');
  useEffect(() => {
    if (!isGlobalSearchOpen) {
      setDebouncedGlobalSearchQuery('');
      return undefined;
    }
    const timer = setTimeout(() => setDebouncedGlobalSearchQuery(String(globalSearchQuery || '').trim()), 250);
    return () => clearTimeout(timer);
  }, [isGlobalSearchOpen, globalSearchQuery]);
  const globalSearchHasMeaningfulQuery = isGlobalSearchOpen && debouncedGlobalSearchQuery.length >= 2;
  const [voiceScheduleSubTabTarget, setVoiceScheduleSubTabTarget] = useState(null);
  const [voiceHelpSearchTarget, setVoiceHelpSearchTarget] = useState(null);
  const [voiceRecipeTarget, setVoiceRecipeTarget] = useState(null);
  const [inventorySubTabTarget, setInventorySubTabTarget] = useState(null);
  const [isWorkspaceSwitcherOpen, setIsWorkspaceSwitcherOpen] = useState(false);
  const [workspaceMembershipRefreshKey, setWorkspaceMembershipRefreshKey] = useState(0);
  const clearSessionAndLogout = React.useCallback(() => {
    resetChaosPostHogIdentity();
    clearTenantListenerCache({ all: true });
    try { localStorage.removeItem('86chaosUser'); } catch (_) {}
    try { sessionStorage.removeItem('86chaosUser'); } catch (_) {}
    setGhostTenant(null);
    setAppUser(null);
    void signOut(auth).catch(() => {});
  }, []);
  const [isPushRepairing, setIsPushRepairing] = useState(false);
  const [pushRepairDismissed, setPushRepairDismissed] = useState(false);
  const [pushRepairLinkRequest, setPushRepairLinkRequest] = useState({ requested: false, nonce: '' });
  const [surfaceRetryKey, setSurfaceRetryKey] = useState(0);
  const [serverAdminCheck, setServerAdminCheck] = useState({ status: WHOAMI_STATES.IDLE });
  const [serverAdminRetryKey, setServerAdminRetryKey] = useState(0);
  const [authRestoreState, setAuthRestoreState] = useState(() => ({ status: appUser?.sessionCached ? WHOAMI_STATES.PENDING : 'ready', uid: auth?.currentUser?.uid || '' }));

  useEffect(() => {
    initChaosPostHog({ appVersion: CURRENT_VERSION });
  }, []);
  const [chunkRecoveryNotice, setChunkRecoveryNotice] = useState(() => {
    const state = readChunkRecoveryState();
    if (!state || state.appVersion !== CURRENT_VERSION) return null;
    if (!state.stage && typeof window !== 'undefined' && !new URLSearchParams(window.location.search).has('chaosReloadVersion')) return null;
    return { ...state, stage: state.stage || 'chunk-recovery-visible' };
  });

  useEffect(() => {
    if (!auth?.currentUser?.uid && !appUser?.id) return;
    getCurrentAuthSessionStartedMs();
  }, [appUser?.id, auth?.currentUser?.uid]);

  useEffect(() => {
    if (!chunkRecoveryNotice) return;
    const current = writeChunkRecoveryState({
      stage: chunkRecoveryNotice.stage || 'visible-in-app-shell',
      finalRouteState: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : ''
    });
    if (current?.stage !== chunkRecoveryNotice.stage) setChunkRecoveryNotice(current);
  }, [chunkRecoveryNotice?.stage, activeTabState]);

  const dismissChunkRecoveryNotice = useCallback(() => {
    clearChunkRecoveryState();
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('chaosReloadVersion');
      url.searchParams.delete('chaosReloadAt');
      window.history.replaceState({}, '', url.toString());
    } catch (_) {}
    setChunkRecoveryNotice(null);
  }, []);

  const runManualChunkRecovery = useCallback(() => {
    const current = writeChunkRecoveryState({ stage: 'manual-recovery-clicked', autoReloadCount: Number(chunkRecoveryNotice?.autoReloadCount || 1) || 1 });
    setChunkRecoveryNotice(current || chunkRecoveryNotice || { stage: 'manual-recovery-clicked' });
    window.location.reload();
  }, [chunkRecoveryNotice]);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};
    const setAuthState = (nextUser) => {
      if (!mounted) return;
      setAuthRestoreState({
        status: nextUser ? 'ready' : WHOAMI_STATES.SIGNED_OUT,
        uid: nextUser?.uid || '',
        email: normalizeEmail(nextUser?.email || '')
      });
      if (!nextUser && appUser?.sessionCached) setAppUser(null);
    };
    try {
      setAuthRestoreState(prev => ({ ...prev, status: auth?.currentUser ? 'ready' : WHOAMI_STATES.PENDING }));
      unsubscribe = onAuthStateChanged(auth, setAuthState);
    } catch (_) {
      setAuthState(auth?.currentUser || null);
    }
    return () => { mounted = false; try { unsubscribe(); } catch (_) {} };
  }, [appUser?.sessionCached]);

  useEffect(() => {
    if (!appUser?.sessionCached || !authRestoreState.uid) return;
    if (appUser.id === authRestoreState.uid && appUser.authUid === authRestoreState.uid && appUser.uid === authRestoreState.uid) return;
    setAppUser(prev => prev?.sessionCached ? {
      ...prev,
      id: prev.id || authRestoreState.uid,
      userId: prev.userId || authRestoreState.uid,
      uid: authRestoreState.uid,
      authUid: authRestoreState.uid,
      email: normalizeEmail(prev.email || authRestoreState.email || '')
    } : prev);
  }, [appUser?.sessionCached, appUser?.id, appUser?.authUid, appUser?.uid, authRestoreState.uid, authRestoreState.email]);
  
  // --- VERSION CHECKER STATE & LOGIC ---
  const [showUpdateBanner, setShowUpdateBanner] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('chaosReloadAt'));
  const [availableVersion, setAvailableVersion] = useState('');
  const [hasHelpUpdate, setHasHelpUpdate] = useState(false);
  const [tourMode, setTourMode] = useState(null);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    const checkAppVersion = async () => {
      try {
        const chunkRecoveryActive = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('chaosReloadAt');
        if (chunkRecoveryActive) {
          setAvailableVersion(CURRENT_VERSION);
          setShowUpdateBanner(true);
          return;
        }
        const response = await fetch(`/version.json?t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.version !== CURRENT_VERSION) {
            setAvailableVersion(data.version || 'new-version');
            setShowUpdateBanner(true);
          } else {
            setAvailableVersion('');
            setShowUpdateBanner(false);
          }
        }
      } catch (error) {
        console.warn("Background version check failed:", error);
      }
    };

    checkAppVersion();
    const versionInterval = setInterval(checkAppVersion, 3 * 60 * 1000);
    return () => clearInterval(versionInterval);
  }, []);



  
                    
  // --- APP INSTALL TRACKER (NEW) ---
  useEffect(() => {
    const handleAppInstall = () => {
      const currentUser = JSON.parse(localStorage.getItem('86chaosUser'));
      logAudit(currentUser, 'APP_INSTALLED', 'Device OS', 'User installed 86chaos as a native app to their device.');
    };
    window.addEventListener('appinstalled', handleAppInstall);
    return () => window.removeEventListener('appinstalled', handleAppInstall);
  }, []);


  useEffect(() => {
    if (!appUser?.id || appUser.id === 'dev-backdoor') {
      setServerAdminCheck({ status: WHOAMI_STATES.IDLE });
      return undefined;
    }
    if (authRestoreState.status === WHOAMI_STATES.PENDING) {
      setServerAdminCheck(prev => prev?.status === WHOAMI_STATES.VERIFIED ? prev : { status: WHOAMI_STATES.PENDING, ok: false, reason: 'waiting-for-firebase-auth-restore' });
      return undefined;
    }
    if (authRestoreState.status === WHOAMI_STATES.SIGNED_OUT) {
      setServerAdminCheck({ status: WHOAMI_STATES.SIGNED_OUT, ok: false, definitive: true });
      return undefined;
    }

    let canceled = false;
    let retryTimer = null;
    const fetchWhoami = async (forceTokenRefresh = false) => {
      const res = await secureFetch('/api/whoami', { forceTokenRefresh, authWaitMs: 10000 });
      const contentType = res.headers?.get?.('content-type') || '';
      const data = contentType.toLowerCase().includes('application/json')
        ? await res.json().catch(() => ({ reasonCategory: 'whoami-json-parse-failed', error: `Could not parse /api/whoami JSON (${res.status}).`, retryable: true }))
        : { reasonCategory: 'whoami-non-json-response', error: `Non-JSON /api/whoami response (${res.status}${contentType ? `, ${contentType}` : ''}).`, retryable: true };
      return { res, data };
    };
    const applyVerification = (verification) => {
      if (canceled) return;
      setServerAdminCheck(prev => {
        if (verification.status === WHOAMI_STATES.TRANSIENT_FAILURE && prev?.status === WHOAMI_STATES.VERIFIED && prev?.superAdmin === true) {
          return { ...prev, lastTransientFailure: verification.error || 'Temporary verification failure', transientFailureAt: new Date().toISOString() };
        }
        return verification;
      });
      if (verification.status === WHOAMI_STATES.VERIFIED || verification.status === WHOAMI_STATES.DENIED) {
        setAppUser(prev => {
          if (!prev?.id || (appUser.id && prev.id !== appUser.id)) return prev;
          const next = mergeVerifiedAccess(prev, verification);
          try {
            const storage = localStorage.getItem('86chaosUser') ? localStorage : sessionStorage;
            storage.setItem('86chaosUser', JSON.stringify(buildSafeSessionCache(next)));
          } catch (_) {}
          return next;
        });
      }
    };
    const checkServerAdminAccess = async (attempt = 0, forceTokenRefresh = false) => {
      if (canceled) return;
      setServerAdminCheck(prev => {
        if (prev?.status === WHOAMI_STATES.VERIFIED && prev?.superAdmin === true && attempt === 0) return { ...prev, status: WHOAMI_STATES.RETRYING, refreshing: true };
        return { ...(prev || {}), status: attempt > 0 ? WHOAMI_STATES.RETRYING : WHOAMI_STATES.PENDING, ok: false, attempt };
      });
      try {
        let { res, data } = await fetchWhoami(forceTokenRefresh);
        if (res.status === 401 && !forceTokenRefresh) {
          ({ res, data } = await fetchWhoami(true));
        }
        const verification = classifyWhoamiResponse({ ok: res.ok, status: res.status, data, error: data?.error || res.statusText });
        if (verification.status === WHOAMI_STATES.TRANSIENT_FAILURE && attempt < 2) {
          applyVerification({ ...verification, attempt, nextRetryInMs: attempt === 0 ? 1200 : 2500 });
          retryTimer = setTimeout(() => checkServerAdminAccess(attempt + 1, false), attempt === 0 ? 1200 : 2500);
          return;
        }
        applyVerification(verification);
      } catch (err) {
        const verification = classifyWhoamiResponse({ ok: false, status: 0, data: {}, error: err?.message || 'Could not check server admin config.' });
        if (attempt < 2) {
          applyVerification({ ...verification, attempt, nextRetryInMs: attempt === 0 ? 1200 : 2500 });
          retryTimer = setTimeout(() => checkServerAdminAccess(attempt + 1, false), attempt === 0 ? 1200 : 2500);
          return;
        }
        applyVerification({ ...verification, attempt });
      }
    };
    checkServerAdminAccess();
    return () => { canceled = true; if (retryTimer) clearTimeout(retryTimer); };
  }, [appUser?.id, appUser?.email, authRestoreState.status, authRestoreState.uid, serverAdminRetryKey]);

const [currentDate, setCurrentDate] = useState(getToday());
  const [activeScheduleSubTab, setActiveScheduleSubTab] = useState(() => initialRouteState.scheduleSubTab || 'my-schedule');

  useEffect(() => {
    try {
      const postRestoreTab = sessionStorage.getItem('86chaosPostRestoreTab');
      if (postRestoreTab) {
        sessionStorage.removeItem('86chaosPostRestoreTab');
        const normalizedPostRestoreTab = normalizeRouteTab(postRestoreTab);
        setCurrentDate('2026-07-01');
        if (normalizedPostRestoreTab === 'schedule' || normalizedPostRestoreTab === 'published') setActiveScheduleSubTab(defaultScheduleSubTabForTopLevelTab(normalizedPostRestoreTab));
        activeTabStateRef.current = normalizedPostRestoreTab;
        setActiveTabState(normalizedPostRestoreTab);
      }
    } catch (_) {}
  }, []);

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
  const monthBounds = getMonthBounds(currentDate);
  const scheduleWindowStart = addDays(monthBounds.start, -14);
  const scheduleWindowEnd = addDays(monthBounds.end, 60);
  const recentWindowStart = addDays(getToday(), -30);
  const futureWindowEnd = addDays(getToday(), 14);
  const todayOpsWindowEnd = addDays(getToday(), 7);
  const laborPunchWindowStart = addDays(currentDate, -14);
  const laborPunchWindowEnd = addDays(currentDate, 7);
  const lightPunchWindowStart = addDays(getToday(), -1);
  const lightPunchWindowEnd = addDays(getToday(), 1);
  const wantsToday = activeTabState === 'today';
  const messageRangeStart = activeTabState === 'messages' ? addDays(getToday(), -60) : recentWindowStart;

  const schedulePlan = useMemo(() => buildScheduleQueryPlan({
    activeTabState,
    activeScheduleSubTab,
    appUser,
    currentDate,
    selectedMonth: getMonthStr(currentDate),
    visibleRange: { start: scheduleWindowStart, end: scheduleWindowEnd },
    wantsToday,
    messageRangeStart
  }), [activeTabState, activeScheduleSubTab, appUser, currentDate, scheduleWindowStart, scheduleWindowEnd, wantsToday, messageRangeStart]);


  // --- DATABASE IMPORTS (Read Saver + Schedule Restore Safe Mode) ---
  // Schedule shifts are loaded with a single tenant query and filtered in the app.
  // That avoids the missing Firestore composite-index fallback that could briefly show restored shifts
  // and then replace them with a tiny, stale capped snapshot. Other tabs still use tighter windows.
  const wantsScheduleScreen = ['schedule', 'events', 'published'].includes(activeTabState);
  const subscriptionProbeUser = { ...(appUser || {}), isSuperAdmin: appUser?.isSuperAdmin === true };
  const featureAccessForShell = (featureKey) => {
    if (!featureKey) return null;
    return resolveFeatureAccess({ workspace: clientData || {}, user: subscriptionProbeUser, featureKey });
  };
  const planAllowsFeature = (featureKey) => {
    const access = featureAccessForShell(featureKey);
    return Boolean(access?.master || access?.planAllowed || access?.manualEnabled);
  };
  const roleAndPlanAllowFeature = (featureKey) => Boolean(featureAccessForShell(featureKey)?.allowed);
  const canReadScheduleView = roleAndPlanAllowFeature(FEATURE_KEYS.BASIC_SCHEDULE_VIEW);
  const canReadScheduleBuilder = roleAndPlanAllowFeature(FEATURE_KEYS.SCHEDULE_BUILDER);
  const canReadOperationsLabor = [FEATURE_KEYS.TIMESHEETS, FEATURE_KEYS.LABOR_COMMAND, FEATURE_KEYS.TIP_CENTER, FEATURE_KEYS.PAYROLL_READINESS].some(roleAndPlanAllowFeature);
  const canReadSalesCollections = [FEATURE_KEYS.DAILY_CLOSE, FEATURE_KEYS.SALES_BREAKDOWN, FEATURE_KEYS.FINANCIAL_OVERVIEW, FEATURE_KEYS.PRIME_COST].some(roleAndPlanAllowFeature);
  const canReadBasicInventory = [FEATURE_KEYS.BASIC_INVENTORY, FEATURE_KEYS.BURN_LOG].some(roleAndPlanAllowFeature);
  const canReadSmartInventory = [FEATURE_KEYS.COGS_CENTER, FEATURE_KEYS.INVOICE_TOTALS, FEATURE_KEYS.VENDOR_SPEND, FEATURE_KEYS.INVOICE_SCANNING].some(roleAndPlanAllowFeature);
  const canReadMenuCollections = [FEATURE_KEYS.MENU_INTELLIGENCE, FEATURE_KEYS.DEPENDENCY_TOOLS, FEATURE_KEYS.SMART_86_ALERTS].some(roleAndPlanAllowFeature);
  const canReadMaintenance = roleAndPlanAllowFeature(FEATURE_KEYS.CLEANING_ROUTINES);
  const wantsPublishedSchedule = activeTabState === 'published';
  const wantsScheduleData = wantsPublishedSchedule || (wantsToday && canReadScheduleView) || (wantsScheduleScreen && (canReadScheduleView || canReadScheduleBuilder)) || (['labor', 'ops'].includes(activeTabState) && (canReadScheduleView || canReadOperationsLabor));
  const wantsShiftData = wantsScheduleData && schedulePlan.shiftsEnabled !== false;
  const userGhostRequestOffPath = Boolean(ghostTenant?.impersonate && activeTabState === 'schedule' && activeScheduleSubTab === 'time-off');
  const wantsTimeOffData = wantsScheduleData && schedulePlan.timeOffEnabled !== false && !userGhostRequestOffPath;
  const wantsLaborData = (['financials', 'labor', 'sales', 'ops'].includes(activeTabState) || (wantsToday && canReadOperationsLabor)) && canReadOperationsLabor;
  const wantsInventoryData = (((wantsToday || globalSearchHasMeaningfulQuery) && (canReadBasicInventory || canReadSmartInventory)) || (activeTabState === 'menu-intelligence' && canReadMenuCollections));
  const wantsPrepData = wantsToday; // Prep screen owns its live prep/task listeners; App keeps only Today summaries.
  const wantsMenuData = (activeTabState === 'menu-intelligence' || wantsToday) && canReadMenuCollections;
  const wantsRecipesData = globalSearchHasMeaningfulQuery; // Recipes screen owns its live query; App keeps only demand-driven global-search data.
  const wantsMaintenanceData = wantsToday && canReadMaintenance; // Maintenance screen owns its full listener; App keeps only Today alert context.
  const wantsSalesData = ['financials', 'sales', 'ops', 'labor'].includes(activeTabState) && canReadSalesCollections;
  const shiftRangeStart = schedulePlan.shiftClauses.find(c => c[0] === 'date' && c[1] === '>=')?.[2] || (wantsScheduleScreen ? scheduleWindowStart : getToday());
  const shiftRangeEnd = schedulePlan.shiftClauses.find(c => c[0] === 'date' && c[1] === '<=')?.[2] || (wantsScheduleScreen ? scheduleWindowEnd : todayOpsWindowEnd);
  const scheduleDateKeyShiftClauses = useMemo(() => buildScheduleDateKeyRangeClauses(schedulePlan.shiftClauses), [schedulePlan.shiftClauses]);
  const wantsEventData = wantsToday || wantsScheduleScreen || activeTabState === 'messages' || activeTabState === 'ops' || globalSearchHasMeaningfulQuery;
  // Schedule Builder needs the same scheduled events a manager sees in Event Calendar.
  // Without loading events on schedule screens, the builder receives an empty/stale events prop
  // and the staff-up row cannot show banquets, parties, holidays, or special events that affect coverage.
  const eventRangeClauses = schedulePlan.eventClauses;
  const eventOrderDirection = wantsScheduleScreen ? 'asc' : 'desc';
  const eventLimitCount = schedulePlan.eventLimit || (activeTabState === 'messages' ? 90 : 35);
  const prepDateWindow = Array.from(new Set([currentDate, getToday(), 'MASTER']));
  const canViewTeamScheduleData = Boolean(appUser?.isSuperAdmin || appUser?.isAdmin || appUser?.isOwner || appUser?.accountOwner || appUser?.workspaceOwner || appUser?.permissions?.schedule || appUser?.permissions?.team);
  const canViewTeamPresenceData = Boolean(appUser?.isSuperAdmin || appUser?.isAdmin || appUser?.isOwner || appUser?.accountOwner || appUser?.workspaceOwner || appUser?.permissions?.team);
  const wantsFullRosterData = Boolean(rId && !ghostTenant && (
    schedulePlan.needsRoster || wantsToday || ['team', 'labor', 'financials', 'messages', 'hr-training', 'prep'].includes(activeTabState) || globalSearchHasMeaningfulQuery
  ));
  const wantsWorkspaceMembershipList = Boolean(rId && !ghostTenant && ['schedule', 'published', 'events', 'team'].includes(activeTabState));

  const users = useLiveCollection('users', rId, { enabled: wantsFullRosterData, limitCount: activeTabState === 'team' ? 220 : 90, fallbackLimitCount: 40, debugLabel: `app:${activeTabState}:roster` });
  const workspaceMembers = useLiveCollection('workspaceMembers', rId, { enabled: wantsWorkspaceMembershipList, limitCount: activeTabState === 'team' ? 220 : 60, fallbackLimitCount: 30, debugLabel: `app:${activeTabState}:workspace-members` });
  // Low-cost presence: no Firestore live heartbeat/listener. When a manager/team screen needs
  // last-seen hints, read tiny Realtime Database summaries instead of users/livePresence documents.
  const wantsWorkspacePresenceSnapshot = Boolean(activeTabState === 'team' && canViewTeamPresenceData);
  const [workspacePresenceRecords, setWorkspacePresenceRecords] = useState([]);
  useEffect(() => {
    if (!rId || ghostTenant || !wantsWorkspacePresenceSnapshot) {
      setWorkspacePresenceRecords([]);
      return undefined;
    }
    let alive = true;
    secureFetch(`/api/presence-workspace-summary?restaurantId=${encodeURIComponent(rId)}&limit=500`, { method: 'GET' })
      .then(response => response.json().then(data => ({ response, data })).catch(() => ({ response, data: {} })))
      .then(({ response, data }) => {
        if (!alive) return;
        if (!response.ok || data?.ok === false) throw new Error(data?.error || `API ${response.status}`);
        setWorkspacePresenceRecords(Array.isArray(data?.users) ? data.users : []);
      })
      .catch(err => {
        if (!alive) return;
        console.warn('Workspace presence summary unavailable; keeping last-known-good summary:', err?.message || err);
      });
    return () => { alive = false; };
  }, [rId, ghostTenant, wantsWorkspacePresenceSnapshot]);
  const livePresenceRecords = workspacePresenceRecords;
  const selfPresenceRecord = useLowCostPresenceSummary(rId, appUser?.id || '', { enabled: !!rId && !ghostTenant && activeTabState === 'settings' && !!appUser?.id });
  const presenceSessions = livePresenceRecords;
  const rawDateShiftsState = useLiveCollectionState('shifts', rId, { enabled: !!rId && wantsShiftData, whereClauses: schedulePlan.shiftClauses, orderByField: 'date', orderDirection: 'asc', limitCount: schedulePlan.shiftLimit, fallbackLimitCount: Math.min(schedulePlan.shiftLimit || 80, 80), debugLabel: `app:${activeTabState}:${activeScheduleSubTab}:shifts-date-plan` });
  const rawDateShifts = rawDateShiftsState.data || [];
  const enableScheduleDateKeyRescue = shouldEnableScheduleDateKeyRescue({ wantsShiftData, wantsScheduleScreen, canonicalState: rawDateShiftsState, clientData, shiftClauses: schedulePlan.shiftClauses });
  const rawScheduleDateKeyShifts = useLiveCollection('shifts', rId, { enabled: !!rId && enableScheduleDateKeyRescue, whereClauses: scheduleDateKeyShiftClauses, orderByField: 'scheduleDateKey', orderDirection: 'asc', limitCount: schedulePlan.shiftLimit, fallbackLimitCount: Math.min(schedulePlan.shiftLimit || 80, 80), debugLabel: `app:${activeTabState}:${activeScheduleSubTab}:shifts-scheduleDateKey-rescue` });
  const rawShifts = useMemo(() => mergeLoadedScheduleShifts(rawDateShifts, rawScheduleDateKeyShifts), [rawDateShifts, rawScheduleDateKeyShifts]);
  const shifts = useMemo(() => {
    const start = shiftRangeStart;
    const end = shiftRangeEnd;
    const rescuedMonths = Array.isArray(clientData?.scheduleRescueProtectedMonths) ? clientData.scheduleRescueProtectedMonths : [];
    const rescueEnforced = clientData?.scheduleRescueEnforceProtected === true;
    return (rawShifts || [])
      .filter(s => {
        const d = String(s.date || s.scheduleDateKey || '');
        const month = String(s.scheduleMonth || d.slice(0, 7) || '');
        if (rescueEnforced && rescuedMonths.includes(month)) {
          // Emergency rescue armor: keep old/restored junk from taking the month back over,
          // but still allow Schedule Builder edits made after the rescue.
          const rescueAt = String(clientData?.lastScheduleRescueAt || '');
          const touchedAt = String(s.updatedAt || s.createdAt || s.importedAt || s.restoredAt || s.publishedAt || '');
          const sourceText = `${s.restoreSourceKey || ''} ${s.sourceKey || ''} ${s.source || ''}`.toLowerCase();
          const protectedSeed = s.rescueProtected === true || s.scheduleBuilderDraft === true || s.readyToPublish === true || s.rescueEditable === true || sourceText.includes('cheers-july-2026');
          const editedAfterRescue = !!rescueAt && !!touchedAt && touchedAt >= rescueAt;
          if (!(protectedSeed || editedAfterRescue)) return false;
        }
        return !d || (d >= start && d <= end);
      })
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.startTime || '').localeCompare(String(b.startTime || '')) || String(a.employeeName || '').localeCompare(String(b.employeeName || '')));
  }, [rawShifts, shiftRangeStart, shiftRangeEnd, clientData?.scheduleRescueEnforceProtected, clientData?.lastScheduleRescueAt, JSON.stringify(clientData?.scheduleRescueProtectedMonths || [])]);
  const shiftSwaps = useLiveCollection('shiftSwaps', rId, { enabled: !!rId && wantsScheduleData && schedulePlan.swapsEnabled, whereClauses: schedulePlan.swapClauses, orderByField: schedulePlan.swapOrderByField || 'shiftDate', orderDirection: 'asc', limitCount: schedulePlan.swapLimit, fallbackLimitCount: 25, debugLabel: `app:${activeTabState}:${activeScheduleSubTab}:shift-swaps` });
  const events = useLiveCollection('events', rId, { enabled: !!rId && wantsEventData && schedulePlan.eventEnabled, whereClauses: eventRangeClauses, orderByField: 'date', orderDirection: eventOrderDirection, limitCount: eventLimitCount, fallbackLimitCount: wantsScheduleScreen ? 120 : 25 });
  const sales = useLiveCollection('sales', rId, { enabled: !!rId && wantsSalesData, whereClauses: [['date','>=', monthBounds.start], ['date','<=', monthBounds.end]], orderByField: 'date', orderDirection: 'desc', limitCount: 45, fallbackLimitCount: 20 });
  const activeTimeOffRequests = useLiveCollection('timeOffRequests', rId, { enabled: !!rId && wantsTimeOffData, whereClauses: schedulePlan.timeOffClauses, orderByField: schedulePlan.timeOffClauses.some(c => c[0] === 'date') ? 'date' : null, orderDirection: 'asc', limitCount: schedulePlan.timeOffLimit, fallbackLimitCount: Math.min(schedulePlan.timeOffLimit || 60, 60), debugLabel: `app:${activeTabState}:${activeScheduleSubTab}:timeoff-plan` });
  const timeOffHistoryRequests = useLiveCollection('timeOffRequests', rId, { enabled: !!rId && wantsTimeOffData && schedulePlan.timeOffHistoryEnabled === true, whereClauses: schedulePlan.timeOffHistoryClauses || [], orderByField: 'date', orderDirection: 'desc', limitCount: schedulePlan.timeOffHistoryLimit || 40, fallbackLimitCount: 40, debugLabel: `app:${activeTabState}:${activeScheduleSubTab}:timeoff-history` });
  const timeOffRequests = useMemo(() => {
    const byId = new Map();
    [...(activeTimeOffRequests || []), ...(timeOffHistoryRequests || [])].forEach(row => { if (row?.id) byId.set(row.id, row); });
    return Array.from(byId.values());
  }, [activeTimeOffRequests, timeOffHistoryRequests]);
  const timePunches = useLiveCollection('timePunches', rId, { enabled: !!rId && wantsLaborData, whereClauses: [['date','>=', activeTabState === 'labor' ? laborPunchWindowStart : lightPunchWindowStart], ['date','<=', activeTabState === 'labor' ? laborPunchWindowEnd : lightPunchWindowEnd]], orderByField: 'date', orderDirection: 'desc', limitCount: activeTabState === 'labor' ? 180 : 35, fallbackLimitCount: 30 });
  const inventoryItems = useLiveCollection('inventoryItems', rId, { enabled: !!rId && wantsInventoryData, limitCount: activeTabState === 'inventory' ? 180 : 55, fallbackLimitCount: 35, debugLabel: `app:${activeTabState}:inventory` });
  const menuDependencies = useLiveCollection('menuDependencies', rId, { enabled: !!rId && wantsMenuData, limitCount: activeTabState === 'menu-intelligence' ? 500 : 120, fallbackLimitCount: 80 });
  const maintenanceLogs = useLiveCollection('maintenanceLogs', rId, { enabled: !!rId && wantsMaintenanceData, whereClauses: [], limitCount: activeTabState === 'maintenance' ? 80 : 20, fallbackLimitCount: 20, debugLabel: `app:${activeTabState}:maintenance` });
  const prepItems = useLiveCollection('prepItems', rId, { enabled: !!rId && wantsPrepData, whereClauses: [['date','in', prepDateWindow]], limitCount: 80, fallbackLimitCount: 35 });
  const tasks = useLiveCollection('tasks', rId, { enabled: !!rId && wantsPrepData, limitCount: 75, fallbackLimitCount: 35 });
  const recipes = useLiveCollection('recipes', rId, { enabled: !!rId && wantsRecipesData, limitCount: 350, fallbackLimitCount: 80, debugLabel: `app:${activeTabState}:recipes` });

  const listenerCacheBoundaryRef = useRef('');
  useEffect(() => {
    const projectId = firebaseConfig?.projectId || 'default';
    const key = `${projectId}|${rId || ''}|${authenticatedUid || ''}|${ghostTenant?.id || ''}`;
    const previous = listenerCacheBoundaryRef.current;
    if (!previous) {
      listenerCacheBoundaryRef.current = key;
      return;
    }
    if (previous !== key) {
      const [previousProjectId, previousRestaurantId, previousViewerUid] = previous.split('|');
      clearTenantListenerCache({
        projectId: previousProjectId || undefined,
        restaurantId: previousRestaurantId || undefined,
        viewerUid: previousViewerUid || undefined
      });
      listenerCacheBoundaryRef.current = key;
    }
  }, [firebaseConfig?.projectId, rId, authenticatedUid, ghostTenant?.id]);

  const accountProfileDocId = appUser?.profileDocId || authenticatedUid;
  const directAccountUserState = useLiveDocumentState('users', accountProfileDocId, { enabled: Boolean(accountProfileDocId && appUser?.id !== 'dev-backdoor'), debugLabel: 'app:current-user-security' });
  const directAccountUser = directAccountUserState.data;
  const canonicalMembershipId = rId && authenticatedUid ? workspaceMemberDocId(authenticatedUid, rId) : '';
  const currentMembershipDocument = useLiveDocumentState('workspaceMembers', canonicalMembershipId, { enabled: Boolean(canonicalMembershipId && appUser.id !== 'dev-backdoor' && !ghostTenant), restaurantId: rId || '', debugLabel: 'app:current-workspace-member-document' });
  // Legacy lookups run strictly one at a time and only after the canonical document is confirmed missing.
  const currentMembershipCanonical = useLiveCollectionState('workspaceMembers', rId, { enabled: Boolean(rId && appUser?.id && appUser.id !== 'dev-backdoor' && !ghostTenant && currentMembershipDocument.resolved && !currentMembershipDocument.error && !currentMembershipDocument.data), whereClauses: [['userId', '==', authenticatedUid]], limitCount: 1, fallbackLimitCount: 1, debugLabel: 'app:legacy-userid-workspace-member' });
  const currentMembershipUid = useLiveCollectionState('workspaceMembers', rId, { enabled: Boolean(rId && appUser?.id && appUser.id !== 'dev-backdoor' && !ghostTenant && currentMembershipCanonical.resolved && !currentMembershipCanonical.error && currentMembershipCanonical.data.length === 0), whereClauses: [['uid', '==', authenticatedUid]], limitCount: 1, fallbackLimitCount: 1, debugLabel: 'app:legacy-uid-workspace-member' });
  const currentMembershipAuthUid = useLiveCollectionState('workspaceMembers', rId, { enabled: Boolean(rId && appUser?.id && appUser.id !== 'dev-backdoor' && !ghostTenant && currentMembershipCanonical.resolved && currentMembershipUid.resolved && !currentMembershipCanonical.error && !currentMembershipUid.error && currentMembershipCanonical.data.length === 0 && currentMembershipUid.data.length === 0), whereClauses: [['authUid', '==', authenticatedUid]], limitCount: 1, fallbackLimitCount: 1, debugLabel: 'app:legacy-authuid-workspace-member' });
  const currentMembershipEmail = useLiveCollectionState('workspaceMembers', rId, { enabled: Boolean(rId && appUser?.email && appUser.id !== 'dev-backdoor' && !ghostTenant && currentMembershipCanonical.resolved && currentMembershipUid.resolved && currentMembershipAuthUid.resolved && !currentMembershipCanonical.error && !currentMembershipUid.error && !currentMembershipAuthUid.error && currentMembershipCanonical.data.length === 0 && currentMembershipUid.data.length === 0 && currentMembershipAuthUid.data.length === 0), whereClauses: [['email', '==', normalizeEmail(appUser?.email || '')]], limitCount: 1, fallbackLimitCount: 1, debugLabel: 'app:legacy-email-workspace-member' });
  const directWorkspaceMemberRows = currentMembershipCanonical.data;
  const legacyUidWorkspaceMemberRows = currentMembershipUid.data;
  const legacyAuthUidWorkspaceMemberRows = currentMembershipAuthUid.data;
  const legacyEmailWorkspaceMemberRows = currentMembershipEmail.data;
  const directWorkspaceMember = currentMembershipDocument.data || directWorkspaceMemberRows?.[0] || legacyUidWorkspaceMemberRows?.[0] || legacyAuthUidWorkspaceMemberRows?.[0] || legacyEmailWorkspaceMemberRows?.[0] || null;
  
// --- LIVE APP USER LOGIC ---
  const fullGhostPermissions = { schedule: true, events: true, ops: true, inventory: true, prep: true, sales: true, team: true, labor: true, help: true };
  const workspaceMemberForAppUser = useMemo(() => {
    if (directWorkspaceMember) return directWorkspaceMember;
    if (!appUser?.id && !appUser?.email) return null;
    const emailKey = normalizeEmail(appUser?.email);
    return (workspaceMembers || []).find(m =>
      (m.userId && m.userId === appUser.id) ||
      (m.uid && m.uid === appUser.id) ||
      (emailKey && normalizeEmail(m.email) === emailKey)
    ) || null;
  }, [directWorkspaceMember, workspaceMembers, appUser?.id, appUser?.email]);
  const accountUserFromTenantList = appUser ? (directAccountUser || users?.find(u => u.id === appUser.id) || null) : null;
  const realAppUser = appUser ? (
    appUser.id === 'dev-backdoor'
      ? appUser
      : (workspaceMemberForAppUser ? userFromWorkspaceMember(workspaceMemberForAppUser, accountUserFromTenantList || appUser) : (accountUserFromTenantList || appUser))
  ) : null;
  let liveAppUser = realAppUser;

  if (ghostTenant && realAppUser) {
    const ghostWorkspaceId = ghostTenant.id || ghostTenant.restaurantId;
    const realName = realAppUser.name || realAppUser.email || 'System Admin';

    if (ghostTenant.demoMode) {
       const demoRole = ghostTenant.demoMode.role || 'manager';
       const demoFeatures = ghostTenant.demoMode.features || {};
       const managerPerms = { schedule: !!(demoFeatures.schedule || demoFeatures.published), events: !!demoFeatures.events, ops: !!demoFeatures.ops, inventory: !!demoFeatures.inventory, prep: !!demoFeatures.prep, sales: !!demoFeatures.financials, team: !!demoFeatures.team, labor: !!demoFeatures.financials, help: true };
       liveAppUser = {
         ...realAppUser,
         id: `${realAppUser.id}_demo`,
         restaurantId: ghostWorkspaceId,
         restaurantName: `${ghostTenant.name} Demo`,
         name: demoRole === 'employee' ? 'Demo Employee' : 'Demo Manager',
         email: 'demo@hidden.example',
         phone: 'Hidden for demo',
         isAdmin: demoRole !== 'employee',
         isSuperAdmin: false,
         role: demoRole === 'employee' ? 'Demo Employee' : 'Demo Manager',
         permissions: demoRole === 'employee' ? { help: true } : managerPerms,
         isGhost: true,
         isDemo: true,
         demoRole,
         demoFeatures,
         planId: ghostTenant.demoMode.plan || 'smart_kitchen',
         ghostMode: 'demo',
         ghostRealUserId: realAppUser.id,
         ghostRealUserName: realName,
         ghostWorkspaceName: ghostTenant.name
       };
    } else if (ghostTenant.impersonate) {
       // USER POSSESSION MODE:
       // Show the target user's "My Schedule" and profile identity, but keep your support/admin powers
       // so Schedule Builder, Team, Settings, Sales, Inventory, etc. still load for that workspace.
       liveAppUser = {
         ...ghostTenant.impersonate,
         restaurantId: ghostWorkspaceId,
         restaurantName: ghostTenant.name,
         isAdmin: true,
         isSuperAdmin: realAppUser.isSuperAdmin || (MASTER_ADMIN_EMAIL && realAppUser.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()),
         role: `Ghosting ${ghostTenant.impersonate.role || 'User'}`,
         permissions: { ...fullGhostPermissions, ...(ghostTenant.impersonate.permissions || {}) },
         isGhost: true,
         ghostMode: 'user',
         ghostRealUserId: realAppUser.id,
         ghostRealUserName: realName,
         ghostTargetUserId: ghostTenant.impersonate.id,
         ghostTargetUserName: ghostTenant.impersonate.name || ghostTenant.impersonate.email || 'Target User'
       };
    } else {
       // WORKSPACE GHOST MODE: Enter the client account as a full support administrator.
       liveAppUser = {
         ...realAppUser,
         restaurantId: ghostWorkspaceId,
         restaurantName: ghostTenant.name,
         isAdmin: true,
         isSuperAdmin: true,
         role: 'System Administrator',
         permissions: { ...fullGhostPermissions, ...(realAppUser.permissions || {}) },
         isGhost: true,
         ghostMode: 'workspace',
         ghostRealUserId: realAppUser.id,
         ghostRealUserName: realName,
         ghostWorkspaceName: ghostTenant.name
       };
    }
  }


  const isDemoMode = !!liveAppUser?.isDemo;
  const sessionEmailForAdmin = String(liveAppUser?.email || appUser?.email || auth.currentUser?.email || '').toLowerCase();

  const platformAdminAccessState = resolvePlatformAdminAccessState({ user: liveAppUser || appUser || {}, verification: serverAdminCheck, masterAdminEmail: MASTER_ADMIN_EMAIL });
  const serverSaysSuperAdmin = platformAdminAccessState.verified === true;
  const localProfileHasSystemAdminMarker = Boolean(
    liveAppUser?.isSuperAdmin === true ||
    liveAppUser?.systemAccess?.superAdmin === true ||
    (MASTER_ADMIN_EMAIL && sessionEmailForAdmin === MASTER_ADMIN_EMAIL.toLowerCase())
  );
  const whoamiStatus = serverAdminCheck?.status || WHOAMI_STATES.IDLE;
  const serverAdminCheckPending = Boolean(appUser?.id && appUser.id !== 'dev-backdoor' && platformAdminAccessState.state === PLATFORM_ADMIN_ACCESS_STATES.PENDING);
  const serverAdminCheckTemporarilyUnavailable = Boolean(appUser?.id && appUser.id !== 'dev-backdoor' && platformAdminAccessState.state === PLATFORM_ADMIN_ACCESS_STATES.TEMPORARILY_UNAVAILABLE);
  const serverDefinitivelyDeniedSuperAdmin = Boolean(platformAdminAccessState.state === PLATFORM_ADMIN_ACCESS_STATES.DENIED && platformAdminAccessState.definitive === true);
  // Local profile and public master-email markers may only create a secure pending hint while /api/whoami verifies.
  // They are never treated as final System Administrator authorization.
  const pendingLocalSystemAdminHint = Boolean(
    !isDemoMode &&
    (serverAdminCheckPending || serverAdminCheckTemporarilyUnavailable) &&
    localProfileHasSystemAdminMarker
  );
  const hasLocalSystemAdminMarker = Boolean(serverSaysSuperAdmin || pendingLocalSystemAdminHint);
  if (!isDemoMode && liveAppUser && serverDefinitivelyDeniedSuperAdmin && liveAppUser.isSuperAdmin === true) {
    liveAppUser = {
      ...liveAppUser,
      isSuperAdmin: false,
      systemAccess: { ...(liveAppUser.systemAccess || {}), superAdmin: false },
      permissions: { ...(liveAppUser.permissions || {}), systemAdmin: false, godmode: false },
      superAdminAccessSource: 'server-verified-not-system-admin',
      platformAdminVerification: platformAdminAccessState.verification,
      serverAdminCheck
    };
  }
  if (!isDemoMode && liveAppUser && pendingLocalSystemAdminHint && !serverSaysSuperAdmin) {
    liveAppUser = {
      ...liveAppUser,
      isSuperAdmin: false,
      systemAccess: { ...(liveAppUser.systemAccess || {}), superAdmin: false },
      pendingSystemAdminVerification: true,
      superAdminAccessSource: 'pending-server-verification',
      platformAdminVerification: platformAdminAccessState.verification,
      serverAdminCheck
    };
  }
  if (!isDemoMode && liveAppUser && serverSaysSuperAdmin && (liveAppUser.isSuperAdmin !== true || liveAppUser.platformAdminVerification?.status !== WHOAMI_STATES.VERIFIED || liveAppUser.serverAdminCheck?.status !== WHOAMI_STATES.VERIFIED)) {
    liveAppUser = {
      ...liveAppUser,
      isSuperAdmin: true,
      pendingSystemAdminVerification: false,
      systemAccess: { ...(liveAppUser.systemAccess || {}), superAdmin: true },
      superAdminAccessSource: platformAdminAccessState.source || serverAdminCheck?.platformAuthority?.source || (serverAdminCheck?.protectedRootAdminMatched ? 'protected-root-admin' : serverAdminCheck?.serverMasterAdminMatched ? 'server-master-admin-env' : serverAdminCheck?.customClaimSuperAdmin ? 'firebase-custom-claim' : serverAdminCheck?.firestoreSuperAdmin ? 'firestore-profile-flag' : 'api-whoami'),
      platformAdminVerification: platformAdminAccessState.verification,
      serverAdminCheck
    };
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const hadRecoveryParams = ['chaosReloadAt', 'chaosReloadVersion', 'chaosHardRefresh', 'chaosVersion'].some(key => url.searchParams.has(key));
    if (!hadRecoveryParams) return;
    const requestedTab = normalizeRouteTab(url.searchParams.get('tab') || activeTabState || 'today');
    if (requestedTab !== activeTabState) return;
    if (requestedTab === 'godmode' && !serverSaysSuperAdmin && !hasLocalSystemAdminMarker) return;
    if (requestedTab === 'godmode' && [WHOAMI_STATES.PENDING, WHOAMI_STATES.RETRYING].includes(whoamiStatus)) return;
    clearChunkRecoveryMarkers();
    removeRuntimeRecoveryQueryParams();
    setShowUpdateBanner(false);
  }, [activeTabState, serverSaysSuperAdmin, hasLocalSystemAdminMarker, whoamiStatus]);

  // --- REMOTE SESSION KILL SWITCH ---
  useEffect(() => {
    if (!liveAppUser?.forceLogout || !liveAppUser?.id) return;

    // forceLogout is a one-shot session invalidation. Staff accounts may not be allowed
    // to clear their own server flag, so the client must never turn a stale flag into a login loop.
    if (!shouldHonorForceLogoutNow(liveAppUser)) {
      updateDoc(doc(db, "users", liveAppUser.id), {
        forceLogout: false,
        forceLogoutClearedAt: new Date().toISOString(),
        forceLogoutClearMode: 'client-stale-session-guard'
      }).catch(() => {});
      return;
    }

    markForceLogoutHandledLocally(liveAppUser);
    updateDoc(doc(db, "users", liveAppUser.id), {
      forceLogout: false,
      forceLogoutClearedAt: new Date().toISOString(),
      forceLogoutClearMode: 'client-before-signout'
    }).catch(() => {});
    clearSessionAndLogout();
    alert("Your session was signed out by a System Administrator. Please log in again.");
  }, [liveAppUser?.forceLogout, liveAppUser?.forceLogoutAt, liveAppUser?.forceLogoutNonce, liveAppUser?.id, clearSessionAndLogout]);

  useEffect(() => {
    if (!liveAppUser?.id || ghostTenant || isDemoMode) return undefined;
    const ids = Array.from(new Set([
      liveAppUser.profileDocId,
      liveAppUser.accountProfile?.id,
      liveAppUser.userId,
      liveAppUser.id,
      auth?.currentUser?.uid
    ].filter(Boolean).map(String)));
    if (!ids.length) return undefined;
    let cancelled = false;
    const unsubs = ids.map((id) => onSnapshot(doc(db, 'users', id), (snap) => {
      if (cancelled || !snap.exists()) return;
      const data = snap.data() || {};
      const refreshSignal = getRemoteRefreshSignalValue(
        data.forceRefreshAt,
        data.clientRefreshAt,
        data.globalRefreshAt,
        data.forceRefresh,
        data.refreshAt
      );
      if (refreshSignal) maybeApplyRemoteRefreshSignal(`user:${id}`, refreshSignal, data.forceRefreshReason || data.clientRefreshReason || 'system-admin-user-refresh');
      const nextSessionFields = {
        forceLogout: data.forceLogout === true,
        forceLogoutAt: data.forceLogoutAt || data.forceLogoutTime || data.forcedLogoutAt || data.logoutBefore || data.sessionRevokedAt || '',
        forceLogoutNonce: data.forceLogoutNonce || data.sessionRevokeNonce || '',
        forceLogoutReason: data.forceLogoutReason || ''
      };
      setAppUser(prev => {
        if (!prev?.id || !ids.includes(String(prev.id))) return prev;
        const same = prev.forceLogout === nextSessionFields.forceLogout &&
          String(prev.forceLogoutAt || '') === String(nextSessionFields.forceLogoutAt || '') &&
          String(prev.forceLogoutNonce || '') === String(nextSessionFields.forceLogoutNonce || '') &&
          String(prev.forceLogoutReason || '') === String(nextSessionFields.forceLogoutReason || '');
        return same ? prev : { ...prev, ...nextSessionFields };
      });
    }, (err) => console.warn('User session signal listener failed:', err?.message || err)));
    return () => { cancelled = true; unsubs.forEach(unsub => { try { unsub(); } catch (_) {} }); };
  }, [liveAppUser?.id, liveAppUser?.profileDocId, liveAppUser?.userId, ghostTenant, isDemoMode]);

  useEffect(() => {
    const signal = getRemoteRefreshSignalValue(
      liveAppUser?.forceRefreshAt,
      liveAppUser?.clientRefreshAt,
      liveAppUser?.globalRefreshAt,
      liveAppUser?.forceRefresh,
      liveAppUser?.refreshAt
    );
    if (signal && liveAppUser?.id) maybeApplyRemoteRefreshSignal(`session:${liveAppUser.id}`, signal, liveAppUser?.forceRefreshReason || liveAppUser?.clientRefreshReason || 'system-admin-refresh');
  }, [liveAppUser?.id, liveAppUser?.forceRefreshAt, liveAppUser?.clientRefreshAt, liveAppUser?.globalRefreshAt, liveAppUser?.forceRefresh, liveAppUser?.refreshAt]);



  const [labelsToPrint, setLabelsToPrint] = useState(null);

  // --- GLOBAL WORKSPACE & HEALTH PING ---

// THE FIX: Safely attach BOTH the System Settings and the Plan Tier to the live user
if (liveAppUser && clientData) {
     liveAppUser = { 
       ...liveAppUser, 
       systemSettings: { tips: true, ...(clientData.systemSettings || {}) },
       planId: clientData?.subscription?.planId || clientData?.planId || 'smart_kitchen',
       restaurantName: liveAppUser.restaurantName || clientData.name || clientData.businessName || clientData.restaurantName || '86 Chaos'
     };
  }
  setActiveTimeFormat(liveAppUser?.preferences?.timeFormat || '12h');
  const canSeeRestaurantAdminAlerts = Boolean(liveAppUser && !liveAppUser.isDemo && (
    liveAppUser.isSuperAdmin || liveAppUser.isOwner || liveAppUser.owner || liveAppUser.accountOwner ||
    liveAppUser.workspaceOwner || liveAppUser.isAdmin || liveAppUser.permissions?.settings || liveAppUser.permissions?.team
  ));
  const restaurantAdminAlerts = useLiveCollection('restaurantAdminAlerts', rId, { enabled: !!rId && canSeeRestaurantAdminAlerts && (activeTabState === 'today' || activeTabState === 'godmode' || activeTabState === 'back-office'), limitCount: 30, fallbackLimitCount: 10 });

  const rawDemoFeatures = liveAppUser?.demoFeatures || {};
  const displayClientFeatures = isDemoMode ? {
    schedule: rawDemoFeatures.published !== false && rawDemoFeatures.schedule !== false,
    events: rawDemoFeatures.events !== false,
    ops: rawDemoFeatures.ops !== false,
    messages: rawDemoFeatures.messages !== false,
    prep: rawDemoFeatures.prep !== false,
    recipes: rawDemoFeatures.recipes !== false,
    inventory: rawDemoFeatures.inventory !== false,
    team: rawDemoFeatures.team !== false && liveAppUser?.demoRole !== 'employee',
    maintenance: rawDemoFeatures.maintenance !== false,
    labor: rawDemoFeatures.financials !== false && liveAppUser?.demoRole !== 'employee',
    sales: rawDemoFeatures.financials !== false && liveAppUser?.demoRole !== 'employee'
  } : clientFeatures;
  const maskDemoUser = (u, idx = 0) => ({ ...u, name: u.name || `Demo Staff ${idx+1}`, email: `employee${idx+1}@demo.hidden`, phone: 'Hidden for demo', address: 'Hidden for demo', emergencyContact: 'Hidden for demo', wage: 0, photoURL: u.photoURL || '' });
  const parsePresenceTimeMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value > 1000000000000 ? value : value * 1000;
    if (typeof value === 'string') { const parsed = new Date(value).getTime(); return Number.isFinite(parsed) ? parsed : 0; }
    if (typeof value?.toDate === 'function') { const parsed = value.toDate().getTime(); return Number.isFinite(parsed) ? parsed : 0; }
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
  };
  const mergePresenceIntoUsers = (userList = [], sessionList = []) => {
    if (!Array.isArray(userList) || !Array.isArray(sessionList) || sessionList.length === 0) return userList || [];
    const now = Date.now();
    const liveWindowMs = 5 * 60 * 1000;
    const sessionsByUser = {};
    sessionList.forEach(session => {
      const userId = session.userId || session.uid || session.id;
      if (!userId) return;
      const lastMs = Math.max(
        parsePresenceTimeMs(session.lastHeartbeatAt),
        parsePresenceTimeMs(session.presenceUpdatedAt),
        parsePresenceTimeMs(session.lastActive),
        parsePresenceTimeMs(session.lastSeen),
        parsePresenceTimeMs(session.heartbeatEpochMs),
        parsePresenceTimeMs(session.lastChanged),
        parsePresenceTimeMs(session.lastOnline)
      );
      if (!lastMs) return;
      const explicitlyOnline = session.online === true || session.onlineState === 'online' || session.state === 'online';
      const explicitlyOffline = session.online === false || session.onlineState === 'offline' || session.state === 'offline';
      const enriched = { ...session, _presenceLastMs: lastMs, _presenceLive: explicitlyOnline || (!explicitlyOffline && (now - lastMs) < liveWindowMs) };
      if (!sessionsByUser[userId]) sessionsByUser[userId] = [];
      sessionsByUser[userId].push(enriched);
    });
    return (userList || []).map(user => {
      const sessions = (sessionsByUser[user.id] || []).sort((a, b) => b._presenceLastMs - a._presenceLastMs);
      if (sessions.length === 0) return user;
      const liveSession = sessions.find(s => s._presenceLive);
      const best = liveSession || sessions[0];
      const bestTime = new Date(best._presenceLastMs).toISOString();
      return {
        ...user,
        lastActive: bestTime,
        lastSeen: bestTime,
        lastHeartbeatAt: best.lastHeartbeatAt || bestTime,
        presenceUpdatedAt: best.presenceUpdatedAt || bestTime,
        onlineState: liveSession ? (best.onlineState || 'online') : (best.onlineState || user.onlineState),
        activeTab: best.activeTab || user.activeTab,
        activeSessionId: best.activeSessionId || user.activeSessionId,
        activeDevice: best.activeDevice || user.activeDevice,
        activeHost: best.activeHost || user.activeHost,
        notificationPermission: best.notificationPermission || user.notificationPermission,
        gpsPermission: best.gpsPermission || user.gpsPermission,
        deviceDiagnostics: best.deviceDiagnostics || user.deviceDiagnostics,
        presenceSessionCount: sessions.length,
        presenceSource: liveSession ? 'live-session' : 'session-history'
      };
    });
  };
  const wageSettings = clientData?.systemSettings || {};
  const wageViewAccess = Array.isArray(wageSettings.wageAccess) ? wageSettings.wageAccess : [];
  const wageEditAccess = Array.isArray(wageSettings.wageEditAccess) ? wageSettings.wageEditAccess : [];
  const sessionEmail = (liveAppUser?.email || appUser?.email || '').toLowerCase().trim();
  const sessionOwnerEmail = (clientData?.ownerEmail || '').toLowerCase().trim();
  const sessionIsOwner = Boolean(liveAppUser?.isSuperAdmin || serverSaysSuperAdmin || (MASTER_ADMIN_EMAIL && sessionEmail === MASTER_ADMIN_EMAIL.toLowerCase()) || liveAppUser?.isOwner || liveAppUser?.accountOwner || (sessionOwnerEmail && sessionEmail === sessionOwnerEmail));
  const sessionCanViewWages = Boolean(sessionIsOwner || liveAppUser?.permissions?.wageView || liveAppUser?.permissions?.wageEdit || wageViewAccess.includes(liveAppUser?.id) || wageEditAccess.includes(liveAppUser?.id));

  const displayUsers = useMemo(() => {
    const accountById = new Map((users || []).map(u => [u.id, u]));
    const memberUsers = (workspaceMembers || [])
      .filter(m => workspaceMemberIsActive(m))
      .map(m => userFromWorkspaceMember(m, accountById.get(m.userId || m.uid) || {}));
    const memberIds = new Set(memberUsers.map(u => u.id).filter(Boolean));
    const legacyUsers = (users || []).filter(u => !memberIds.has(u.id) && u.isActive !== false);
    const combinedUsers = memberUsers.length ? [...memberUsers, ...legacyUsers] : (users || []);
    const baseUsers = isDemoMode ? combinedUsers.map(maskDemoUser) : combinedUsers;
    // Merge low-cost RTDB last-seen summaries only on screens that need it. This avoids
    // constant Firestore presence reads/writes while still giving managers a useful hint.
    let merged = mergePresenceIntoUsers(baseUsers, livePresenceRecords);
    if (!isDemoMode && !sessionCanViewWages) {
      merged = merged.map(u => ({ ...u, wage: 0, wageHidden: true }));
    }
    return merged;
  }, [isDemoMode, users, workspaceMembers, sessionCanViewWages, livePresenceRecords]);
  const scheduleDisplayUsers = useMemo(() => {
    if (!wantsScheduleScreen && activeTabState !== 'published') return displayUsers;
    const merged = Array.isArray(displayUsers) ? [...displayUsers] : [];
    const seen = new Set();
    const remember = (value) => {
      const key = String(value || '').trim().toLowerCase();
      if (key) seen.add(key);
    };
    merged.forEach(user => {
      remember(user?.id); remember(user?.uid); remember(user?.authUid); remember(user?.userId);
      remember(user?.scheduleUserId); remember(user?.employeeId); remember(user?.rosterUserId);
      remember(user?.email); remember(user?.emailLower); remember(user?.name); remember(user?.displayName); remember(user?.fullName);
    });
    const addShiftPerson = (shift = {}) => {
      if (!shift || typeof shift !== 'object') return;
      const ids = [shift.scheduleUserId, shift.employeeId, shift.rosterUserId, shift.userId, shift.uid, shift.authUid, shift.staffId].filter(Boolean);
      const name = String(shift.employeeName || shift.staffName || shift.userName || shift.displayName || shift.fullName || shift.name || '').trim();
      const email = String(shift.employeeEmail || shift.email || shift.emailLower || '').trim();
      const primaryId = String(ids[0] || email || name || '').trim();
      const known = [primaryId, name, email, ...ids].some(value => seen.has(String(value || '').trim().toLowerCase()));
      if (!primaryId || !name || known) return;
      ids.forEach(remember); remember(primaryId); remember(name); remember(email);
      merged.push({
        id: primaryId,
        uid: shift.uid || shift.authUid || shift.userId || primaryId,
        userId: shift.userId || shift.employeeId || primaryId,
        scheduleUserId: shift.scheduleUserId || shift.employeeId || primaryId,
        employeeId: shift.employeeId || primaryId,
        name,
        displayName: name,
        fullName: name,
        email,
        emailLower: email.toLowerCase(),
        role: shift.role || shift.position || shift.department || 'Scheduled Staff',
        department: shift.department || shift.section || '',
        restaurantId: shift.restaurantId || rId,
        isActive: true,
        scheduleOnly: true,
        source: 'shift-roster-fallback'
      });
    };
    (shifts || []).forEach(addShiftPerson);
    return merged;
  }, [displayUsers, shifts, wantsScheduleScreen, activeTabState, rId]);
  if (isDemoMode && liveAppUser?.demoRole === 'employee' && displayUsers?.[0]) {
    liveAppUser = { ...liveAppUser, id: displayUsers[0].id, name: 'Demo Employee', role: displayUsers[0].role || 'Demo Employee', isAdmin: false, isSuperAdmin: false, permissions: { help: true } };
  }
  const displayClientData = isDemoMode && clientData ? { ...clientData, ownerEmail: 'Hidden for demo', ownerPhone: 'Hidden for demo', address: 'Hidden for demo', businessAddress: 'Hidden for demo', systemSettings: { tips: true, ...(clientData.systemSettings || {}), address: 'Hidden for demo', geofenceAddress: 'Hidden for demo' } } : clientData;

  useEffect(() => {
    if (!liveAppUser?.id && !auth?.currentUser?.uid) return;
    identifyChaosPostHogUser(liveAppUser || {}, {
      authUid: auth?.currentUser?.uid || liveAppUser?.id || '',
      restaurantId: rId || '',
      appVersion: CURRENT_VERSION,
      isDemoMode,
      plan: displayClientData?.selectedFutureTier || displayClientData?.plan || displayClientData?.subscriptionPlan || ''
    });
  }, [liveAppUser?.id, liveAppUser?.role, liveAppUser?.isAdmin, liveAppUser?.isSuperAdmin, liveAppUser?.workspaceOwner, auth?.currentUser?.uid, rId, isDemoMode, displayClientData?.selectedFutureTier, displayClientData?.plan, displayClientData?.subscriptionPlan]);

  const planAccess = usePlanAccess(liveAppUser, displayClientData);
  const mfaEnvValue = String(process.env.REACT_APP_MFA_ENFORCE_ELEVATED_ROLES || '').toLowerCase().trim();
  const mfaFrontendEnforced = ['true', '1', 'yes', 'enforce'].includes(mfaEnvValue) || displayClientData?.systemSettings?.mfaEnforceElevatedRoles === true || displayClientData?.securityCenter?.mfaEnforceElevatedRoles === true;
  const elevatedRoleText = `${liveAppUser?.role || ''} ${liveAppUser?.accountRole || ''} ${liveAppUser?.title || ''}`.toLowerCase();
  const userNeedsMfa = Boolean(
    liveAppUser?.isSuperAdmin === true ||
    liveAppUser?.isAdmin === true ||
    liveAppUser?.isOwner === true ||
    liveAppUser?.accountOwner === true ||
    liveAppUser?.workspaceOwner === true ||
    liveAppUser?.permissions?.team === true ||
    liveAppUser?.permissions?.settings === true ||
    /owner|manager|admin|administrator|supervisor|lead|gm|general manager/.test(elevatedRoleText)
  );
  const userHasMfaEnrollment = Boolean(
    liveAppUser?.mfaEnabled === true ||
    liveAppUser?.multiFactorEnabled === true ||
    liveAppUser?.accountSecurity?.mfaEnabled === true ||
    Number(liveAppUser?.mfaFactorCount || liveAppUser?.accountSecurity?.factorCount || 0) > 0
  );
  const mfaFrontendLockActive = Boolean(!ghostTenant && !isDemoMode && mfaFrontendEnforced && userNeedsMfa && !userHasMfaEnrollment);
  const demoWritableText = /save|add|create|delete|remove|publish|apply|copy previous|smart fill|clock|send|post|approve|restore|backup|upload|scan|reset|deactivate|terminate|deploy|update|edit|fix|out/i;
  const blockDemoMutation = (e) => {
    if (!isDemoMode) return;
    const el = e.target?.closest?.('button,input[type="submit"]');
    if (!el) return;
    const text = `${el.innerText || el.value || el.getAttribute('aria-label') || ''}`;
    if (demoWritableText.test(text)) {
      e.preventDefault();
      e.stopPropagation();
      addToast('Demo Mode', 'Read-only demo. Nothing was saved.');
    }
  };

  const employeeTourSteps = [
    { title:'Welcome to 86 Chaos', body:'This quick tour shows how to save the web app, clock in/out, view your schedule, read messages, and get help.' },
    { title:'Add it to your phone', body:'Android: open in Chrome, tap ⋮, then Add to Home screen or Install App. iPhone: open in Safari, tap Share, then Add to Home Screen.' },
    { title:'Clock in and out', body:'Use Time Clock & Schedule for punches. If the browser asks for location permission, tap Allow so your punch can be verified.' },
    { title:'Find your schedule', body:'Open Time Clock & Schedule to see your full schedule, shift trades, and request-off tools.' },
    { title:'Help Center', body:'Open Help Center any time for Employee Quick Start, app install steps, clock help, and password help.' }
  ];
  const managerTourSteps = [
    { title:'Workspace Setup', body:'This quick tour gets a new restaurant ready for staff, scheduling, clock rules, backups, and Help Center training.' },
    { title:'Save the app', body:'On PC, open the app in Chrome or Edge and choose Install App near the address bar. On phones, add it to the home screen.' },
    { title:'Add employees', body:'Go to Staff Roster. New employee logins now pop up with generated email and one-time temporary password.' },
    { title:'Set permissions', body:'Give each person only the tabs they need. Financials and Schedule Builder stay protected by role and permission.' },
    { title:'Clock rules', body:'Set the work-area geofence in Settings. Outside-area clock-outs still save, but managers get alerted and the timesheet is marked.' },
    { title:'Backups and help', body:'Backup Center lives under System Administrator → Forensics. Help Center has Quick Start Guides and restart buttons.' }
  ];
  const activeTourSteps = tourMode === 'manager' ? managerTourSteps : employeeTourSteps;
  const getTourUserKeyPart = () => String(liveAppUser?.id || liveAppUser?.uid || liveAppUser?.email || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  const getTourSessionKey = (mode = tourMode) => `tourSeenThisSession_${getTourUserKeyPart()}_${mode || 'tour'}`;
  const getTourCompleteKey = (mode = tourMode) => mode === 'manager' ? `managerTourComplete_${rId || 'workspace'}` : `employeeTourComplete_${liveAppUser?.id || 'employee'}`;
  const getTourSeenOnceKey = (mode = tourMode) => mode === 'manager'
    ? `managerTourSeenOnce_${rId || 'workspace'}_${getTourUserKeyPart()}`
    : `employeeTourSeenOnce_${getTourUserKeyPart()}`;
  const markTourSeenOnce = async (mode = tourMode, skipped = true) => {
    if (!liveAppUser || isDemoMode) return;
    const now = new Date().toISOString();
    try {
      sessionStorage.setItem(getTourSessionKey(mode), 'true');
      localStorage.setItem(getTourSeenOnceKey(mode), 'true');
      if (mode === 'employee') localStorage.setItem(getTourCompleteKey(mode), 'true');
      if (mode === 'manager') localStorage.setItem(getTourSeenOnceKey(mode), 'true');
    } catch (_) {}
    try {
      if (mode === 'employee' && liveAppUser?.id) {
        const needsWrite = liveAppUser.onboardingTourSeen !== true || (skipped && liveAppUser.onboardingSkipped !== true);
        if (needsWrite) {
          await updateDoc(doc(db, 'users', liveAppUser.id), {
            onboardingTourSeen: true,
            onboardingTourSeenAt: liveAppUser.onboardingTourSeenAt || now,
            ...(skipped ? { onboardingSkipped: true, onboardingSkippedAt: now } : {})
          });
        } else rememberSkippedFirestoreWrite();
      }
      if (mode === 'manager' && liveAppUser?.id) {
        const needsWrite = liveAppUser.managerOnboardingSeen !== true || (skipped && liveAppUser.managerOnboardingSkipped !== true);
        if (needsWrite) {
          await updateDoc(doc(db, 'users', liveAppUser.id), {
            managerOnboardingSeen: true,
            managerOnboardingSeenAt: liveAppUser.managerOnboardingSeenAt || now,
            ...(skipped ? { managerOnboardingSkipped: true, managerOnboardingSkippedAt: now } : {})
          });
        } else rememberSkippedFirestoreWrite();
      }
    } catch(e) { console.warn('Tour seen-once save failed', e); }
  };
  const dismissTourForNow = () => {
    const mode = tourMode;
    markTourSeenOnce(mode, true);
    setTourMode(null);
    setTourStep(0);
  };
  const finishTour = async () => {
    const mode = tourMode;
    setTourMode(null);
    setTourStep(0);
    if (!liveAppUser || isDemoMode) return;
    try {
      await markTourSeenOnce(mode, false);
      localStorage.setItem(getTourCompleteKey(mode), 'true');
      if (mode === 'manager' && rId) {
        if (clientData?.workspaceOnboardingComplete === true && clientData?.workspaceOnboardingSkipped === false) rememberSkippedFirestoreWrite();
        else await updateDoc(doc(db, 'restaurants', rId), { workspaceOnboardingComplete: true, workspaceOnboardingCompletedAt: new Date().toISOString(), workspaceOnboardingSkipped: false });
      }
      if (mode === 'employee' && liveAppUser?.id) {
        if (liveAppUser.onboardingComplete === true && liveAppUser.onboardingSkipped === false && liveAppUser.onboardingTourSeen === true) rememberSkippedFirestoreWrite();
        else await updateDoc(doc(db, 'users', liveAppUser.id), { onboardingComplete: true, onboardingCompletedAt: new Date().toISOString(), onboardingSkipped: false, onboardingTourSeen: true });
      }
    } catch(e) { console.warn('Tour completion save failed', e); }
  };

  // Safety net: if System Admin disables a module while a user still has that tab open,
  // send them back to the main Time Clock/Schedule screen instead of showing a blank page.
  useEffect(() => {
    const gatedTabs = ['ops', 'events', 'messages', 'prep', 'recipes', 'inventory', 'sales', 'team', 'maintenance', 'schedule', 'labor'];
    if (gatedTabs.includes(activeTabState) && displayClientFeatures?.[activeTabState] === false) {
      setActiveTab('published');
    }
  }, [activeTabState, displayClientFeatures]);

  useEffect(() => {
    if (!liveAppUser || isDemoMode || tourMode) return;
    const managerCompleteLocal = rId ? localStorage.getItem(`managerTourComplete_${rId}`) === 'true' : false;
    const employeeCompleteLocal = liveAppUser?.id ? localStorage.getItem(`employeeTourComplete_${liveAppUser.id}`) === 'true' : false;
    const managerSeenOnceLocal = localStorage.getItem(getTourSeenOnceKey('manager')) === 'true';
    const employeeSeenOnceLocal = localStorage.getItem(getTourSeenOnceKey('employee')) === 'true';
    const managerSeenServer = liveAppUser.managerOnboardingSeen === true || liveAppUser.managerOnboardingSkipped === true;
    const employeeSeenServer = liveAppUser.onboardingTourSeen === true || liveAppUser.onboardingSkipped === true;
    if ((liveAppUser.isAdmin || liveAppUser.permissions?.team) && displayClientData && !displayClientData.workspaceOnboardingComplete && !managerCompleteLocal && !managerSeenOnceLocal && !managerSeenServer) {
      const key = getTourSessionKey('manager');
      if (sessionStorage.getItem(key) === 'true') return;
      sessionStorage.setItem(key, 'true');
      setTourMode('manager');
      setTourStep(0);
    } else if (!liveAppUser.onboardingComplete && !employeeCompleteLocal && !employeeSeenOnceLocal && !employeeSeenServer) {
      const key = getTourSessionKey('employee');
      if (sessionStorage.getItem(key) === 'true') return;
      sessionStorage.setItem(key, 'true');
      setTourMode('employee');
      setTourStep(0);
    }
  }, [liveAppUser?.id, liveAppUser?.onboardingComplete, liveAppUser?.onboardingTourSeen, liveAppUser?.onboardingSkipped, liveAppUser?.managerOnboardingSeen, liveAppUser?.managerOnboardingSkipped, liveAppUser?.isAdmin, displayClientData?.workspaceOnboardingComplete, rId, isDemoMode, tourMode]);

  useEffect(() => {
    const restart = (e) => { setTourMode(e.detail?.mode || (liveAppUser?.isAdmin ? 'manager' : 'employee')); setTourStep(0); };
    window.addEventListener('chaosRestartTour', restart);
    return () => window.removeEventListener('chaosRestartTour', restart);
  }, [liveAppUser?.isAdmin]);


  useEffect(() => {
    if (!rId) return;
    
    // 1. Fetch Master Client Data (Features & Billing)
    const unsub = onSnapshot(doc(db, 'restaurants', rId), (d) => {
      if (d.exists()) {
         const data = d.data();
         setClientData(data);
         
         // FORCE REFRESH LISTENER
         maybeApplyRemoteRefreshSignal(
           `restaurant:${rId}`,
           getRemoteRefreshSignalValue(data.forceRefreshAt, data.forceRefresh, data.clientRefreshAt, data.refreshAt),
           data.forceRefreshReason || 'system-admin-global-refresh'
         );
      }
    });

// 2. Low-frequency presence check-in (no live scanner, no interval)
    let cancelledPresenceCheck = false;

    if (false && !ghostTenant && appUser?.id) {
      const saveHeartbeatDebug = (next) => {
        const packed = { ...(next || {}), at: new Date().toISOString(), restaurantId: rId, userId: appUser.id };
        if (!cancelledPresenceCheck) setHeartbeatDebug(packed);
        try { sessionStorage.setItem(`chaosPresenceCheckInDebug_${rId}_${appUser.id}`, JSON.stringify(packed)); } catch (err) {}
      };

      const collectDeviceDiagnostics = async () => {
        const diag = {
          notifications: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
          geolocation: navigator.geolocation ? 'supported' : 'unsupported',
          gpsPermission: 'unknown',
          serviceWorker: 'serviceWorker' in navigator,
          indexedDb: 'indexedDB' in window,
          language: navigator.language || 'unknown',
          platform: navigator.platform || 'unknown',
          screen: `${window.innerWidth}x${window.innerHeight}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'
        };
        try {
          if (navigator.permissions?.query && navigator.geolocation) {
            const gps = await navigator.permissions.query({ name: 'geolocation' });
            diag.gpsPermission = gps.state || 'unknown';
          }
        } catch (err) {
          diag.gpsPermission = 'unknown';
        }
        return diag;
      };

      const sendPresenceCheckIn = async () => {
        const checkKey = `chaosPresenceCheckIn_${rId}_${appUser.id}`;
        let lastCheckIn = 0;
        try { lastCheckIn = Number(sessionStorage.getItem(checkKey) || 0); } catch (err) {}
        if (lastCheckIn && Date.now() - lastCheckIn < 10 * 60 * 1000) {
          saveHeartbeatDebug({ ok: true, channel: 'manual-presence-mode', state: 'online', message: 'Presence check-in already saved for this browser session. No live heartbeat interval is running.', heartbeatEpochMs: lastCheckIn });
          return;
        }

        const firebaseUser = await waitForAuthCurrentUser(8000);
        if (!firebaseUser) {
          saveHeartbeatDebug({ ok: false, channel: 'auth-wait', state: 'online', message: 'Presence check-in skipped because Firebase login is not active yet.', heartbeatEpochMs: Date.now() });
          return;
        }
        const authUid = firebaseUser.uid;
        if (appUser.id && appUser.id !== authUid) {
          saveHeartbeatDebug({ ok: false, channel: 'auth-mismatch', state: 'online', message: `Cached app user does not match Firebase Auth user. Cached ${appUser.id}; Auth ${authUid}.`, heartbeatEpochMs: Date.now() });
          return;
        }

        const stamp = new Date().toISOString();
        const heartbeatEpochMs = Date.now();
        const deviceDiagnostics = await collectDeviceDiagnostics();
        const presenceSessionKey = `chaosSessionId_${rId}_${appUser.id}`;
        let sessionId = sessionStorage.getItem(presenceSessionKey);
        if (!sessionId) {
          sessionId = `${rId}_${appUser.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          sessionStorage.setItem(presenceSessionKey, sessionId);
        }
        const safeSessionId = String(sessionId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 140);
        const device = (navigator.userAgent || 'Unknown device').substring(0, 140);

        try {
          const response = await secureFetch('/api/presence-heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurantId: rId,
              state: 'online',
              activeTab: 'app',
              sessionId: safeSessionId,
              device,
              deviceDiagnostics,
              notificationPermission: deviceDiagnostics.notifications,
              gpsPermission: deviceDiagnostics.gpsPermission,
              heartbeatEpochMs,
              stamp
            })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data?.ok === false) throw new Error(data?.error || `API ${response.status}`);
          try { sessionStorage.setItem(checkKey, String(heartbeatEpochMs)); } catch (err) {}
          saveHeartbeatDebug({ ok: true, channel: data?.mode || 'presence-check-in', state: 'online', message: 'One app-open presence check-in saved. No repeating heartbeat timer is running.', heartbeatEpochMs, apiProjectId: data?.projectId || '' });
        } catch (err) {
          saveHeartbeatDebug({ ok: false, channel: 'presence-check-in', state: 'online', message: err?.message || String(err), heartbeatEpochMs });
        }
      };

      sendPresenceCheckIn();
    }

    return () => {
      cancelledPresenceCheck = true;
      unsub();
    };
  }, [rId, ghostTenant, appUser?.id]);


  // Low-cost presence: Realtime Database onDisconnect handles online/offline without Firestore heartbeats.
  useEffect(() => {
    if (!rId || ghostTenant || !appUser?.id) return undefined;
    return startLowCostPresenceSession({
      user: appUser,
      restaurantId: rId,
      activeTab: 'app',
      onDebug: (next) => setHeartbeatDebug({ ...(next || {}), at: new Date().toISOString(), restaurantId: rId, userId: appUser.id })
    });
  }, [rId, ghostTenant, appUser?.id, appUser?.email, appUser?.name, appUser?.role]);

 
  const transitionActiveTabState = useCallback((nextTab) => {
    const normalized = normalizeRouteTab(nextTab);
    if (normalized === 'schedule') {
      // The top-level Schedule route is the manager Schedule Builder entry point.
      // Set the parent subtab before the route renders so mobile/preloaded release
      // checks open the same roster, shift, and event listeners as the desktop path.
      setActiveScheduleSubTab('schedule-builder');
    } else if (normalized === 'published') {
      setActiveScheduleSubTab(defaultScheduleSubTabForTopLevelTab(normalized));
    }
    activeTabStateRef.current = normalized;
    const commit = () => setActiveTabState(normalized);
    if (typeof React.startTransition === 'function') React.startTransition(commit);
    else commit();
  }, []);

  const disarmPwaBackExit = useCallback(() => {
    const state = pwaBackExitRef.current;
    state.armed = false;
    state.exiting = false;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }, []);

  const writeTopLevelTabHistory = useCallback((tab, options = {}) => {
    if (typeof window === 'undefined') return;
    const normalized = normalizeRouteTab(tab);
    const nextUrl = appTabUrl(normalized);
    try {
      const currentState = window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
      if (isStandalone86ChaosPwa()) {
        window.history.replaceState({ ...currentState, tab: normalized, chaosAppShell: true, chaosPwaBackGuard: true }, '', nextUrl);
      } else if (options.replace === true) {
        window.history.replaceState({ ...currentState, tab: normalized }, '', nextUrl);
      } else {
        window.history.pushState({ tab: normalized }, '', nextUrl);
      }
    } catch (_) {}
  }, []);

  const setActiveTab = (tab) => {
    const previousActiveTab = activeTabState;
    tab = normalizeRouteTab(tab);
    if (tab === 'help' && previousActiveTab && previousActiveTab !== 'help') setHelpOriginState(previousActiveTab);
    if (mfaFrontendLockActive && !['settings', 'help'].includes(tab)) {
      addToast('Two-Step Login Required', 'Open Account Security in Settings to finish MFA setup before using elevated tools.');
      tab = 'settings';
    }
    if (isDemoMode) {
      const allowedDemoTabs = ['today', 'help'];
      if (displayClientFeatures.schedule !== false) allowedDemoTabs.push('published');
      if (displayClientFeatures.schedule !== false && liveAppUser?.demoRole !== 'employee') allowedDemoTabs.push('schedule');
      if ((displayClientFeatures.sales !== false || displayClientFeatures.labor !== false) && liveAppUser?.demoRole !== 'employee') allowedDemoTabs.push('financials', 'sales', 'labor');
      ['events','ops','messages','prep','recipes','inventory','team','maintenance'].forEach(t => { if (displayClientFeatures[t] !== false && liveAppUser?.demoRole !== 'employee') allowedDemoTabs.push(t); });
      if (!allowedDemoTabs.includes(tab)) { addToast('Demo Mode', 'That tab is hidden for this demo.'); tab = 'published'; }
    }
    if (liveAppUser?.id) {
      try {
        const key = `recentTabs_${liveAppUser.id}`;
        const current = JSON.parse(localStorage.getItem(key) || '[]').filter(t => t !== tab);
        localStorage.setItem(key, JSON.stringify([tab, ...current].slice(0, 6)));
      } catch(e) {}
    }
    disarmPwaBackExit();
    writeTopLevelTabHistory(tab);
    transitionActiveTabState(tab);
  };

  const setActiveTabRef = useRef(setActiveTab);
  useEffect(() => { setActiveTabRef.current = setActiveTab; });
  const stableSetActiveTab = useCallback((tab) => setActiveTabRef.current?.(tab), []);

  useEffect(() => {
    trackChaosPageView(activeTabState, {
      restaurantId: rId || '',
      role: liveAppUser?.role || '',
      isAdmin: liveAppUser?.isAdmin === true,
      isSuperAdmin: liveAppUser?.isSuperAdmin === true,
      appVersion: CURRENT_VERSION
    });
  }, [activeTabState, rId, liveAppUser?.role, liveAppUser?.isAdmin, liveAppUser?.isSuperAdmin]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const safeLabelRe = /\b(open|close|view|details|back|next|previous|today|tomorrow|week|month|filter|search|clear|show|hide|expand|collapse|menu|settings|help|refresh|retry|print|copy|download|export|jump|calendar|schedule|inventory|recipe|message|maintenance|team|financial|event|reminder|tab)\b|^[×x✕✖+\-]$/i;
    const mutationLabelRe = /\b(add|assign|save|create|delete|remove|publish|submit|send|post|reply|upload|scan|clock in|clock out|start break|end break|approve|deny|archive|restore|reset|repair|run|apply|generate|sync|reconnect|enable|disable|log|complete|resolve|reopen|order|backup|import|push|notify|test push|force|clear cache|update stock|deduct)\b/i;
    const routeContextLabel = () => ({
      today: 'Open Manager Brief', schedule: 'Schedule', published: 'Schedule', events: 'Event calendar', ops: 'Open operations', financials: 'Financial', sales: 'Financial', labor: 'Labor', messages: 'Message board', prep: 'Prep task', recipes: 'Recipe', inventory: 'Inventory', team: 'Team', maintenance: 'Maintenance', settings: 'Settings', help: 'Help', godmode: 'System Administrator', reminders: 'Reminder'
    }[activeTabState] || 'Open 86 Chaos');
    const cleanLabel = (value = '') => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    const isCoveredClassification = (label = '') => safeLabelRe.test(label) || mutationLabelRe.test(label);
    const normalizeControlLabel = (base, el, index) => {
      const tag = String(el.tagName || '').toUpperCase();
      const role = String(el.getAttribute('role') || '').toLowerCase();
      const type = String(el.getAttribute('type') || '').toLowerCase();
      let label = cleanLabel(base);
      if (!label) label = cleanLabel(el.value || el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('data-label') || '');
      const context = routeContextLabel();

      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (type === 'checkbox' || type === 'radio') return isCoveredClassification(label) ? label : `${context} option ${label || index + 1}`;
        if (mutationLabelRe.test(label) && !safeLabelRe.test(label)) return `${context} field ${index + 1}`;
        return isCoveredClassification(label) ? label : `${context} field ${label || index + 1}`;
      }

      if (/^log out$/i.test(label)) return 'Open sign out';
      if (/^reset$/i.test(label)) return 'Clear form';
      if (/save daily close/i.test(label)) return 'Save labor daily close';
      if (/^add$/i.test(label) && activeTabState === 'reminders') return 'Add reminder';
      if (/^add$/i.test(label) && activeTabState === 'maintenance') return 'Add maintenance task';
      if (/^add$/i.test(label)) return `${context} add control`;
      if (/add staff|add employee|add person|staff member/i.test(label)) return 'Add staff roster member';
      if (/add pm|preventive maintenance/i.test(label)) return 'Add maintenance PM';
      if (/run backup/i.test(label)) return 'Backup now';
      if (/backup center|audit trail/i.test(label)) return 'Open backup center and audit trail';
      if (/backup window missed/i.test(label)) return 'Open health details';
      if (/auto[-\s]?fill/i.test(label)) return 'Auto-fill schedule';
      if (/report (a )?problem|bug report/i.test(label)) return 'Open report problem';
      if (/86\s*voice|86voice|voice assistant|microphone|mic|listening/i.test(label)) {
        if (/close|stop|hide|cancel/i.test(label)) return label;
        if (/start/i.test(label)) return label;
        return /86voice|86\s*voice/i.test(label) ? label : 'Open 86Voice';
      }
      if (/active workspace/i.test(label)) return `Open ${label}`;
      if (/overview|request off|availability|sales|labor|payroll|gross sales|net sales|tips|discounts|guest count|ticket count/i.test(label)) return `${context} ${label}`;
      if (role === 'tab' || role === 'menuitem') return `Open ${label || context}`;
      if (safeLabelRe.test(label) || mutationLabelRe.test(label)) return label;
      if (/button|a/.test(tag.toLowerCase()) || role === 'button') return `Open ${label || `86 Chaos control ${index + 1}`}`;
      return label || `${context} control ${index + 1}`;
    };
    const validLabelledByText = (labelledBy = '') => labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
    const classifyControlIntent = (label = '', el) => {
      const tag = String(el.tagName || '').toUpperCase();
      const role = String(el.getAttribute('role') || '').toLowerCase();
      const href = String(el.getAttribute('href') || '');
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return 'disabled';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return 'form-control';
      if (/delete|remove|archive|clear cache|reset|disable|deny|cancel request/i.test(label)) return 'destructive-mutation';
      if (mutationLabelRe.test(label)) return 'mutation';
      if (tag === 'A' || role === 'tab' || role === 'menuitem' || href || /open|view|back|next|previous|tab|menu|settings|help|details|jump/i.test(label)) return 'navigation';
      if (/show|hide|expand|collapse|filter|search|copy|download|print|refresh|retry/i.test(label)) return 'informational';
      return 'informational';
    };
    const workflowIdFor = (label = '', intent = '') => {
      if (!/mutation/.test(intent)) return '';
      return cleanLabel(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'unknown-mutation';
    };
    const describeControl = (el, index) => {
      const tag = String(el.tagName || '').toUpperCase();
      const escapedId = el.id && typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(el.id) : '';
      const nearbyLabel = escapedId ? document.querySelector(`label[for="${escapedId}"]`) : null;
      const explicitAria = cleanLabel(el.getAttribute('aria-label') || '');
      const labelledBy = el.getAttribute('aria-labelledby') || '';
      const labelledByText = cleanLabel(validLabelledByText(labelledBy));
      const title = cleanLabel(el.getAttribute('title') || '');
      const labelText = cleanLabel(
        explicitAria ||
        labelledByText ||
        title ||
        nearbyLabel?.textContent ||
        el.closest?.('label')?.textContent ||
        el.textContent ||
        el.value ||
        el.getAttribute('placeholder') ||
        el.getAttribute('name') ||
        el.getAttribute('data-label') ||
        ''
      );
      const hasExplicitName = Boolean(explicitAria || labelledByText);
      const normalized = normalizeControlLabel(labelText, el, index);
      const intent = classifyControlIntent(labelText || normalized, el);
      if (!el.getAttribute('data-chaos-control-kind')) el.setAttribute('data-chaos-control-kind', intent);
      const workflowId = workflowIdFor(labelText || normalized, intent);
      if (workflowId && !el.getAttribute('data-chaos-workflow-id')) el.setAttribute('data-chaos-workflow-id', workflowId);
      if (!hasExplicitName && normalized) el.setAttribute('aria-label', normalized);
      if (!el.getAttribute('title') && normalized) el.setAttribute('title', normalized);
      if ((tag === 'BUTTON' || tag === 'A' || el.getAttribute('role') === 'button') && !el.classList.contains('no-compact')) {
        el.classList.add('chaos-release-tap-target');
      }
    };
    const describeScrollableRegions = () => {
      document.querySelectorAll('.overflow-x-auto, .overflow-auto, [data-scrollable="true"]').forEach((el, index) => {
        if (el.getAttribute('tabindex')) return;
        const canScroll = (el.scrollWidth || 0) > (el.clientWidth || 0) || el.classList.contains('overflow-x-auto') || el.classList.contains('overflow-auto');
        if (!canScroll) return;
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', el.getAttribute('role') || 'region');
        el.setAttribute('aria-label', el.getAttribute('aria-label') || `${routeContextLabel()} scroll area ${index + 1}`);
      });
    };
    const applyLabels = () => {
      document.querySelectorAll('button, a, [role="button"], [role="tab"], [role="menuitem"], input, select, textarea').forEach(describeControl);
      describeScrollableRegions();
    };
    applyLabels();
    const scheduleApplyLabels = typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame.bind(window) : (fn) => setTimeout(fn, 0);
    if (typeof MutationObserver === 'undefined' || !document.body) return undefined;
    let labelRunQueued = false;
    const observer = new MutationObserver(() => {
      if (labelRunQueued) return;
      labelRunQueued = true;
      scheduleApplyLabels(() => {
        labelRunQueued = false;
        applyLabels();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [activeTabState]);

useEffect(() => {
    const shouldRemember = localStorage.getItem('chaosRememberMe') !== 'false';
    if (appUser) {
      if (shouldRemember) {
        localStorage.setItem('86chaosUser', JSON.stringify(buildSafeSessionCache(appUser)));
        sessionStorage.removeItem('86chaosUser');
      } else {
        sessionStorage.setItem('86chaosUser', JSON.stringify(buildSafeSessionCache(appUser)));
        localStorage.removeItem('86chaosUser');
      }
    } else {
      localStorage.removeItem('86chaosUser');
      sessionStorage.removeItem('86chaosUser');
    }
  }, [appUser]);

  // Auto-return-to-landing was removed. Users stay on their current page when they come back.

  useEffect(() => {
    if (activeTabState === 'help' && hasHelpUpdate) {
      localStorage.setItem(`helpBriefSeen_${CURRENT_VERSION}`, 'true');
      setHasHelpUpdate(false);
    }
  }, [activeTabState, hasHelpUpdate]);
  

  const [toasts, setToasts] = useState([]);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isKitchenTVOpen, setIsKitchenTVOpen] = useState(false);
  const [undoItem, setUndoItem] = useState(null);
  const [problemModal, setProblemModal] = useState({ open: false, title: '', message: '', category: 'Bug / Error' });
  const [problemText, setProblemText] = useState('');
  const [isSubmittingProblem, setIsSubmittingProblem] = useState(false);
  const [offlineQueueTick, setOfflineQueueTick] = useState(0);
  const [offlineSyncing, setOfflineSyncing] = useState(false);
  const registerUndo = (item) => { setUndoItem(item); setTimeout(() => setUndoItem(prev => prev === item ? null : prev), 12000); };

  useEffect(() => {
    const openFromMenu = () => {
      setProblemModal({ open: true, title: 'Manual Problem Report', message: `Page: ${activeTabState}`, category: 'Bug / Error' });
      setProblemText(`What happened:\nPage: ${activeTabState}\n\nWhat I clicked / expected:\n`);
    };
    window.addEventListener('chaosOpenProblemReport', openFromMenu);
    return () => window.removeEventListener('chaosOpenProblemReport', openFromMenu);
  }, [activeTabState]);


// --- NOTIFICATION DOT LOGIC (WITH READ RECEIPTS) ---
  // 1. Unread Messages (with NaN safety fallback)
  const latestNoteDate = events.filter(e => e.type === 'note').reduce((max, n) => {
     const dTime = new Date(n.date || 0).getTime();
     return isNaN(dTime) ? max : Math.max(max, dTime);
  }, 0);
  const lastReadMsg = liveAppUser ? parseInt(localStorage.getItem(`${liveAppUser.id}_lastReadMsg`) || '0') : 0;
  const hasUnreadMessages = latestNoteDate > lastReadMsg && activeTabState !== 'messages';

  // 2. Shift Swaps (Clear dot when they visit My Shift / Trade Board)
  const latestSwap = shiftSwaps.filter(s => s.status === 'available' && s.originalEmployeeId !== liveAppUser?.id).reduce((max, s) => Math.max(max, new Date(s.date).getTime()), 0);
  const lastReadSwaps = liveAppUser ? parseInt(localStorage.getItem(`${liveAppUser.id}_lastReadSwaps`) || '0') : 0;
  const hasAvailableSwaps = latestSwap > lastReadSwaps && activeTabState !== 'published'; 

  // 3. Manager Alerts (Clear dot when they visit Schedule Builder)
  const realCurrentMonthStr = getToday().substring(0, 7);
  const latestTimeOffReq = timeOffRequests.filter(r => r.status === 'pending' && r.date?.startsWith(realCurrentMonthStr)).reduce((max, r) => Math.max(max, new Date(r.submittedAt || 0).getTime()), 0);
  const lastReadTimeOff = liveAppUser ? parseInt(localStorage.getItem(`${liveAppUser.id}_lastReadTimeOff`) || '0') : 0;
  const isManagerAlert = !!(liveAppUser?.isAdmin || liveAppUser?.permissions?.schedule) && (latestTimeOffReq > lastReadTimeOff) && activeTabState !== 'schedule';

  // Consolidated Alerts
  const hasMyShiftAlert = hasAvailableSwaps; 
  const hasScheduleBuilderAlert = isManagerAlert; 
  const hasAnyMenuAlert = hasUnreadMessages || hasMyShiftAlert || hasScheduleBuilderAlert; 

  // The "Read Receipt" Engine - Clears the dots instantly when tabs are opened
  useEffect(() => {
    if (!liveAppUser) return;
    if (activeTabState === 'messages') localStorage.setItem(`${liveAppUser.id}_lastReadMsg`, Date.now().toString());
    if (activeTabState === 'published') localStorage.setItem(`${liveAppUser.id}_lastReadSwaps`, Date.now().toString());
    if (activeTabState === 'schedule') localStorage.setItem(`${liveAppUser.id}_lastReadTimeOff`, Date.now().toString());
  }, [activeTabState, events, shiftSwaps, timeOffRequests, liveAppUser]);

  const isReportableToast = (title = '', message = '') => /error|failed|blocked|denied|missing|invalid|crash|permission|offline|stopped/i.test(`${title} ${message}`);
  const openProblemReport = ({ title = 'Report Problem', message = '', category = 'Bug / Error' } = {}) => {
    setProblemModal({ open: true, title, message, category });
    setProblemText(message ? `What happened:
${message}

What I clicked / expected:
` : '');
  };

  const getDeviceDiagnostics = () => {
    if (typeof window === 'undefined') return [];
    const queue = getOfflineQueue(liveAppUser?.restaurantId, liveAppUser?.id);
    let storageOk = false;
    try { localStorage.setItem('__chaos_storage_test__', '1'); localStorage.removeItem('__chaos_storage_test__'); storageOk = true; } catch (_) { storageOk = false; }
    return [
      ['App version', CURRENT_VERSION],
      ['Firebase project', firebaseConfig?.projectId || 'unknown'],
      ['Host', window.location.host],
      ['Browser online', navigator.onLine ? 'yes' : 'no'],
      ['Service worker', 'serviceWorker' in navigator ? 'available' : 'missing'],
      ['Notifications', typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'],
      ['Camera/Mic API', navigator.mediaDevices?.getUserMedia ? 'available' : 'missing'],
      ['Local storage', storageOk ? 'available' : 'blocked'],
      ['Offline queue', `${queue.length} queued action${queue.length === 1 ? '' : 's'}`],
      ['Screen', `${window.innerWidth}x${window.innerHeight}`]
    ];
  };

  const submitProblemReport = async (e) => {
    e?.preventDefault?.();
    if (!problemText.trim()) return;
    setIsSubmittingProblem(true);
    try {
      const diagnostics = Object.fromEntries(getDeviceDiagnostics());
      const res = await secureFetch('/api/report-bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: problemModal.category || 'Bug / Error',
          title: problemModal.title || 'Report Problem',
          message: problemText.trim(),
          sourceToastMessage: problemModal.message || '',
          restaurantId: liveAppUser?.restaurantId || 'Unknown',
          restaurantName: liveAppUser?.restaurantName || '',
          activeTab: activeTabState || '',
          diagnostics,
          userAgent: navigator.userAgent,
          screenSize: `${window.innerWidth}x${window.innerHeight}`,
          url: window.location.href
        })
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Could not send problem report.');
      }
      trackChaosPostHogEvent('86chaos_problem_report_submitted', {
        category: problemModal.category || 'Bug / Error',
        active_tab: activeTabState || '',
        workspace_id: liveAppUser?.restaurantId || rId || '',
        app_version: CURRENT_VERSION
      });
      setProblemModal({ open: false, title: '', message: '', category: 'Bug / Error' });
      setProblemText('');
      addToast('Report Sent', 'Support report sent with device diagnostics.');
    } catch (err) {
      addToast('Report Failed', err.message || 'Could not send problem report.');
    } finally {
      setIsSubmittingProblem(false);
    }
  };

  const syncOfflineQueueFromShell = async () => {
    if (offlineSyncing) return;
    setOfflineSyncing(true);
    try {
      const result = await replayOfflineQueue(liveAppUser, addToast);
      setOfflineQueueTick(t => t + 1);
      addToast('Offline Queue Checked', `${result.saved || 0} saved • ${result.failed || 0} still queued.`);
    } catch (err) {
      addToast('Offline Sync Failed', err.message || 'Could not replay queued actions.');
    } finally {
      setOfflineSyncing(false);
    }
  };

  const toastDedupeRef = useRef({});
  const addToast = useCallback((title, message) => {
    const cleanTitle = String(title || '').trim();
    const cleanMessage = String(message || '').trim();
    const key = `${cleanTitle.toLowerCase()}::${cleanMessage.toLowerCase()}`;
    const now = Date.now();
    const last = toastDedupeRef.current[key] || 0;
    if (now - last < 2500) {
      if (process.env.NODE_ENV !== 'production') console.debug('[86chaos] duplicate toast suppressed', { title: cleanTitle, message: cleanMessage });
      return;
    }
    toastDedupeRef.current[key] = now;
    Object.keys(toastDedupeRef.current).forEach(k => { if (now - toastDedupeRef.current[k] > 10000) delete toastDedupeRef.current[k]; });
    const id = now + Math.random();
    const reportable = isReportableToast(cleanTitle, cleanMessage);
    setToasts(prev => [...prev, { id, title: cleanTitle, message: cleanMessage, reportable }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), reportable ? 9000 : 6000);
  }, []);


  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const params = new URLSearchParams(window.location.search);
    const preferredTab = normalizeRouteTab(appUser?.preferences?.defaultTab || 'today');
    const rawTab = params.get('tab') || preferredTab;
    const tab = normalizeRouteTab(rawTab);
    transitionActiveTabState(tab);

    try {
      if (isStandalone86ChaosPwa()) {
        const currentState = window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
        if (!pwaBackExitRef.current.initialized || !currentState.chaosPwaBackGuard) {
          window.history.replaceState({ ...currentState, tab, chaosAppShell: true, chaosPwaBackBase: true }, '', appTabUrl(tab));
          window.history.pushState({ tab, chaosAppShell: true, chaosPwaBackGuard: true }, '', appTabUrl(tab));
          pwaBackExitRef.current.initialized = true;
        } else {
          window.history.replaceState({ ...currentState, tab, chaosAppShell: true, chaosPwaBackGuard: true }, '', appTabUrl(tab));
        }
      } else {
        window.history.replaceState({ ...(window.history.state || {}), tab }, '', appTabUrl(tab));
      }
    } catch (_) {}

    const handlePopState = (event) => {
      const standalone = isStandalone86ChaosPwa();
      const state = pwaBackExitRef.current;

      if (standalone && event?.state?.chaosPwaBackBase) {
        const currentTab = normalizeRouteTab(activeTabStateRef.current || tab || 'today');
        if (state.armed) {
          disarmPwaBackExit();
          state.exiting = true;
          setTimeout(() => {
            try { window.history.back(); } catch (_) {}
          }, 0);
          return;
        }

        state.armed = true;
        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(() => {
          state.armed = false;
          state.timer = null;
        }, CHAOS_PWA_BACK_EXIT_WINDOW_MS);
        addToast('Exit 86 Chaos', 'Press back again to exit.');
        transitionActiveTabState(currentTab);
        try {
          window.history.pushState({ tab: currentTab, chaosAppShell: true, chaosPwaBackGuard: true }, '', appTabUrl(currentTab));
        } catch (_) {}
        return;
      }

      if (standalone && state.exiting) return;
      disarmPwaBackExit();
      const nextParams = new URLSearchParams(window.location.search);
      const nextTab = normalizeRouteTab(event?.state?.tab || nextParams.get('tab') || 'published');
      transitionActiveTabState(nextTab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (pwaBackExitRef.current.timer) {
        clearTimeout(pwaBackExitRef.current.timer);
        pwaBackExitRef.current.timer = null;
      }
    };
  }, [appUser?.preferences?.defaultTab, addToast, disarmPwaBackExit, transitionActiveTabState]);

  const offlineQueue = liveAppUser ? getOfflineQueue(liveAppUser.restaurantId, liveAppUser.id) : [];
  const openMenu = useCallback(() => setIsMenuOpen(true), []);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const closeGlobalSearch = useCallback(() => setIsGlobalSearchOpen(false), []);
  const closeKitchenTV = useCallback(() => setIsKitchenTVOpen(false), []);
  const clearUndoItem = useCallback(() => setUndoItem(null), []);
  const openWorkspaceSwitcherFromDrawer = useCallback(() => {
    if (!ghostTenant && !isDemoMode) setIsWorkspaceSwitcherOpen(true);
  }, [ghostTenant, isDemoMode]);

  const availableWorkspaces = useMemo(() => {
    const byId = new Map();
    const addWorkspace = (w = {}) => {
      const restaurantId = w.restaurantId || w.id;
      if (!restaurantId) return;
      if (!isSelectableWorkspace({ ...w, restaurantId })) return;
      byId.set(restaurantId, {
        ...w,
        restaurantId,
        restaurantName: safeWorkspaceName(w),
        membershipId: w.membershipId || w.id || `${appUser?.id || 'user'}_${restaurantId}`,
        userId: w.userId || appUser?.id,
        email: normalizeEmail(w.email || appUser?.email),
        name: resolveWorkspacePersonDisplayName(w, appUser || {}, w),
        isActive: w.isActive !== false
      });
    };
    (appUser?.availableWorkspaces || []).forEach(addWorkspace);
    if (appUser?.memberships && typeof appUser.memberships === 'object') {
      Object.entries(appUser.memberships).forEach(([restaurantId, membership]) => addWorkspace({ ...(membership || {}), restaurantId }));
    }
    if (appUser?.restaurantId) addWorkspace({ ...appUser, restaurantId: appUser.restaurantId, restaurantName: appUser.restaurantName || clientData?.name || appUser.restaurantName });
    return Array.from(byId.values()).filter(isSelectableWorkspace);
  }, [appUser, clientData?.name]);


  useEffect(() => {
    const handleWorkspaceMembershipsChanged = (event = {}) => {
      const removedIds = new Set((event.detail?.removedRestaurantIds || event.detail?.deletedRestaurantIds || []).filter(Boolean));
      setAppUser(prev => {
        if (!prev) return prev;
        const nextAvailable = (prev.availableWorkspaces || []).filter(workspace => isSelectableWorkspace(workspace) && !removedIds.has(workspace.restaurantId || workspace.id));
        const nextMemberships = prev.memberships && typeof prev.memberships === 'object'
          ? Object.fromEntries(Object.entries(prev.memberships).filter(([restaurantId, membership]) => isSelectableWorkspace({ ...(membership || {}), restaurantId }) && !removedIds.has(restaurantId)))
          : prev.memberships;
        const activeRemoved = removedIds.has(prev.restaurantId) || removedIds.has(prev.activeRestaurantId) || !isSelectableWorkspace(prev);
        if (!activeRemoved) return { ...prev, availableWorkspaces: nextAvailable, memberships: nextMemberships };
        const fallback = nextAvailable[0];
        if (!fallback) return { ...prev, availableWorkspaces: nextAvailable, memberships: nextMemberships, workspaceSwitcherReady: true };
        return buildWorkspaceUser({ ...prev, availableWorkspaces: nextAvailable, memberships: nextMemberships }, fallback);
      });
      setWorkspaceMembershipRefreshKey(key => key + 1);
      try { sessionStorage.removeItem(`chaosWorkspacePickerSeen_${appUser?.id || ''}`); } catch (_) {}
    };
    window.addEventListener('chaos:workspace-memberships-changed', handleWorkspaceMembershipsChanged);
    return () => window.removeEventListener('chaos:workspace-memberships-changed', handleWorkspaceMembershipsChanged);
  }, [appUser?.id]);

  useEffect(() => {
    if (!appUser?.id || appUser.id === 'dev-backdoor' || ghostTenant || isDemoMode) return;
    let canceled = false;
    const refreshMemberships = async () => {
      try {
        const res = await secureFetch('/api/workspace-memberships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: appUser.email, userId: appUser.id })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(data.workspaces) || canceled) return;
        const nextWorkspaces = data.workspaces.filter(isSelectableWorkspace);
        const currentWorkspaceMembershipInactive = !nextWorkspaces.some(w => w.restaurantId === appUser.restaurantId);
        if (!nextWorkspaces.length) {
          try { localStorage.removeItem(`chaosActiveRestaurantId_${appUser.id}`); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('chaos:workspace-memberships-changed', { detail: { removedRestaurantIds: [appUser.restaurantId].filter(Boolean), reason: 'currentWorkspaceMembershipInactive' } })); } catch (_) {}
          clearSessionAndLogout();
          return;
        }
        const active = nextWorkspaces.find(w => w.restaurantId === appUser.restaurantId) || nextWorkspaces.find(w => w.restaurantId === data.activeRestaurantId) || nextWorkspaces[0];
        if (currentWorkspaceMembershipInactive && appUser.restaurantId) {
          try { localStorage.removeItem(`chaosActiveRestaurantId_${appUser.id}`); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('chaos:workspace-memberships-changed', { detail: { removedRestaurantIds: [appUser.restaurantId], reason: 'currentWorkspaceMembershipInactive' } })); } catch (_) {}
        }
        setAppUser(prev => {
          if (!prev?.id || prev.id !== appUser.id) return prev;
          const merged = buildWorkspaceUser({ ...prev, availableWorkspaces: nextWorkspaces }, active);
          return { ...merged, availableWorkspaces: nextWorkspaces, workspaceSwitcherReady: true };
        });
        const seenKey = `chaosWorkspacePickerSeen_${appUser.id}`;
        if (nextWorkspaces.length > 1 && sessionStorage.getItem(seenKey) !== 'true') {
          sessionStorage.setItem(seenKey, 'true');
          setIsWorkspaceSwitcherOpen(true);
        }
      } catch (err) {
        console.warn('Workspace membership refresh failed:', err?.message || err);
      }
    };
    refreshMemberships();
    return () => { canceled = true; };
  }, [appUser?.id, workspaceMembershipRefreshKey]);

  const closeWorkspaceSwitcher = () => {
    if (appUser?.id) {
      try { sessionStorage.setItem(`chaosWorkspacePickerSeen_${appUser.id}`, 'true'); } catch (_) {}
    }
    setIsWorkspaceSwitcherOpen(false);
  };

  const switchWorkspace = (workspace) => {
    if (!workspace?.restaurantId || workspace.restaurantId === rId) {
      setIsWorkspaceSwitcherOpen(false);
      return;
    }
    const nextUser = buildWorkspaceUser({ ...appUser, availableWorkspaces }, workspace);
    try {
      localStorage.setItem(`chaosActiveRestaurantId_${nextUser.id}`, workspace.restaurantId);
      sessionStorage.setItem('chaosWorkspaceSwitchedAt', new Date().toISOString());
      sessionStorage.setItem(`chaosWorkspacePickerSeen_${nextUser.id}`, 'true');
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('chaosLastHeartbeat_') || k.startsWith('chaosHeartbeatDebug_')) localStorage.removeItem(k);
      });
    } catch (_) {}
    if (nextUser.id && nextUser.id !== 'dev-backdoor') {
      const alreadyActiveWorkspace = appUser?.activeRestaurantId === workspace.restaurantId && appUser?.lastWorkspaceId === workspace.restaurantId;
      if (alreadyActiveWorkspace) {
        try {
          window.__chaosFirestoreDiagnostics = window.__chaosFirestoreDiagnostics || {};
          window.__chaosFirestoreDiagnostics.skippedNoOpWrites = (window.__chaosFirestoreDiagnostics.skippedNoOpWrites || 0) + 1;
        } catch (_) {}
      } else {
        try {
          window.__chaosFirestoreDiagnostics = window.__chaosFirestoreDiagnostics || {};
          window.__chaosFirestoreDiagnostics.writesInitiated = (window.__chaosFirestoreDiagnostics.writesInitiated || 0) + 1;
        } catch (_) {}
        updateDoc(doc(db, 'users', nextUser.id), {
          activeRestaurantId: workspace.restaurantId,
          lastWorkspaceId: workspace.restaurantId,
          lastWorkspaceSwitchedAt: new Date().toISOString()
        }).catch(() => {});
      }
    }
    setGhostTenant(null);
    setClientData(null);
    setAppUser(nextUser);
    const nextDefaultTab = normalizeRouteTab(nextUser.preferences?.defaultTab || 'today');
    transitionActiveTabState(nextDefaultTab);
    disarmPwaBackExit();
    writeTopLevelTabHistory(nextDefaultTab, { replace: true });
    setIsWorkspaceSwitcherOpen(false);
    addToast('Workspace Switched', `Now working in ${safeWorkspaceName(workspace)}.`);
  };

// --- AUTO-ASK + TOKEN REPAIR FOR PUSH NOTIFICATIONS ---
  const getActiveVapidKey = () => firebaseConfig?.projectId === 'cheers-34b8d'
    ? 'BJzM9xVnkPwLB6aq588ZHhekjqI_Z-xpInDquX_nknrDhew8ytFZbCA22uFN4iSKP_YvGV0sPH9M6aBzGCA9AcU'
    : 'BO6mdu87G4ICBRZjY5e6mpsvCXdpV32TEyyJzJeQHZ4QXolGNsa6ncvgVAzRxIKihx83AxHS36aCtr--XzE45bc';


  const getPushProfileDocId = () => String(
    directAccountUser?.id ||
    accountProfileDocId ||
    liveAppUser?.profileDocId ||
    liveAppUser?.accountProfile?.id ||
    liveAppUser?.userId ||
    liveAppUser?.uid ||
    liveAppUser?.authUid ||
    liveAppUser?.id ||
    auth.currentUser?.uid ||
    ''
  ).trim();

  const getAuthenticatedPushUserId = (user = liveAppUser) => String(auth?.currentUser?.uid || user?.authUid || user?.uid || user?.userId || user?.accountUserId || user?.id || 'user').trim();
  const getPushRepairRequestId = (user = liveAppUser) => {
    const capturedLinkNonce = String(pushRepairLinkRequest?.nonce || '').trim();
    const stableServerId = String((capturedLinkNonce && pushRepairLinkRequest?.requested) ? capturedLinkNonce : (user?.pushTokenRepairNonce || user?.pushRepairRequestId || capturedLinkNonce || '')).trim();
    if (stableServerId && stableServerId !== '1') return stableServerId;
    const authUserId = getAuthenticatedPushUserId(user);
    const deviceId = typeof window !== 'undefined' ? getPushDeviceId() : 'server';
    const host = typeof window !== 'undefined' ? window.location.hostname : 'server';
    return `legacy-active:${authUserId}:${rId || user?.restaurantId || 'workspace'}:${deviceId}:${host}`;
  };
  const getPushRepairDismissalKey = (requestId = getPushRepairRequestId()) => `86chaos:pushRepairDismissed:${getAuthenticatedPushUserId(liveAppUser)}:${rId || 'workspace'}:${getPushDeviceId()}:${requestId}`;
  const getPushRepairAutoAttemptKey = (requestId = getPushRepairRequestId()) => `86chaos:pushRepairAutoAttempted:${getAuthenticatedPushUserId(liveAppUser)}:${rId || 'workspace'}:${getPushDeviceId()}:${requestId}`;
  const clearPushRepairLinkRequest = (reason = 'terminal') => {
    setPushRepairLinkRequest(prev => {
      if (!prev?.requested && prev?.consumed) return prev;
      return { ...(prev || {}), requested: false, consumed: true, terminalReason: reason, terminalAt: new Date().toISOString() };
    });
  };

  const getPushProfileRef = () => {
    const profileId = getPushProfileDocId();
    return profileId ? doc(db, 'users', profileId) : null;
  };

  const pushPatchValueMatchesCurrentUser = (field, nextValue) => {
    if (!liveAppUser || !field) return false;
    if (field.startsWith('pushDevices.')) {
      const deviceId = field.split('.').slice(1).join('.');
      const existing = liveAppUser?.pushDevices?.[deviceId];
      try { return JSON.stringify(existing || null) === JSON.stringify(nextValue || null); } catch (_) { return false; }
    }
    const existing = liveAppUser?.[field];
    if (nextValue === null && (existing === null || existing === undefined || existing === '')) return true;
    return existing === nextValue;
  };

  const writePushProfilePatch = async (patch = {}, options = {}) => {
    const profileRef = getPushProfileRef();
    if (!profileRef) throw new Error('No signed-in profile was available for this device.');
    const meaningfulPatch = Object.fromEntries(Object.entries(patch || {}).filter(([field, value]) => !pushPatchValueMatchesCurrentUser(field, value)));
    if (Object.keys(meaningfulPatch).length === 0) {
      rememberSkippedFirestoreWrite();
      return null;
    }
    const writeThroughSecureSelfRepair = async (reason = 'direct-write-fallback') => {
      const response = await secureFetch('/api/push-token-repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'self-repair',
          profileDocId: getPushProfileDocId(),
          restaurantId: rId || liveAppUser?.restaurantId || '',
          repairRequestId: options.repairRequestId || getPushRepairRequestId(),
          reason,
          patch: meaningfulPatch
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok !== true) throw new Error(data?.error || 'The secured push repair action could not update this device.');
      return data;
    };
    try {
      window.__chaosFirestoreDiagnostics = window.__chaosFirestoreDiagnostics || {};
      window.__chaosFirestoreDiagnostics.writesInitiated = (window.__chaosFirestoreDiagnostics.writesInitiated || 0) + 1;
    } catch (_) {}
    if (options.forceServerRepair === true) {
      const data = await writeThroughSecureSelfRepair('authoritative-self-repair');
      try {
        window.__chaosFirestoreDiagnostics = window.__chaosFirestoreDiagnostics || {};
        window.__chaosFirestoreDiagnostics.writesCompleted = (window.__chaosFirestoreDiagnostics.writesCompleted || 0) + 1;
        window.__chaosFirestoreDiagnostics.pushRepairApiFallbacks = (window.__chaosFirestoreDiagnostics.pushRepairApiFallbacks || 0) + 1;
      } catch (_) {}
      return data;
    }
    try {
      const result = await updateDoc(profileRef, meaningfulPatch);
      try {
        window.__chaosFirestoreDiagnostics = window.__chaosFirestoreDiagnostics || {};
        window.__chaosFirestoreDiagnostics.writesCompleted = (window.__chaosFirestoreDiagnostics.writesCompleted || 0) + 1;
      } catch (_) {}
      return result;
    } catch (err) {
      const message = String(err?.message || err || '');
      const code = String(err?.code || '');
      const shouldUseServerRepair = /permission|insufficient|not-found|no document|missing|denied|failed-precondition|precondition|unavailable|deadline|legacy|profile|mismatch/i.test(`${code} ${message}`);
      if (!shouldUseServerRepair) throw err;
      const data = await writeThroughSecureSelfRepair(`direct-write-failed:${code || 'unknown'}`);
      try {
        window.__chaosFirestoreDiagnostics = window.__chaosFirestoreDiagnostics || {};
        window.__chaosFirestoreDiagnostics.writesCompleted = (window.__chaosFirestoreDiagnostics.writesCompleted || 0) + 1;
        window.__chaosFirestoreDiagnostics.pushRepairApiFallbacks = (window.__chaosFirestoreDiagnostics.pushRepairApiFallbacks || 0) + 1;
      } catch (_) {}
      return data;
    }
  };

  const rememberSkippedFirestoreWrite = () => {
    try {
      window.__chaosFirestoreDiagnostics = window.__chaosFirestoreDiagnostics || {};
      window.__chaosFirestoreDiagnostics.skippedNoOpWrites = (window.__chaosFirestoreDiagnostics.skippedNoOpWrites || 0) + 1;
    } catch (_) {}
  };

  const getPushErrorMessage = (err, fallback = 'Could not reconnect push notifications on this device.') => {
    const raw = String(err?.message || err || fallback);
    if (/permission|insufficient|not-found|missing/i.test(raw)) return '86 Chaos could not save this device yet. The app will try the secure repair path automatically.';
    if (isFirebaseMessagingUnsupportedError(err)) return 'This browser cannot run Firebase push notifications. You can still use 86 Chaos normally.';
    return raw;
  };

  const getPushDeviceId = () => {
    try {
      const key = '86chaosPushDeviceId';
      let id = localStorage.getItem(key);
      if (!id) {
        id = `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(key, id);
      }
      return String(id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
    } catch (_) {
      return 'web_ephemeral_device';
    }
  };

  const getBrowserSummary = () => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Browser';
  };

  const buildPushDevicePatch = (currentToken, permission, stamp) => {
    const deviceId = getPushDeviceId();
    return {
      deviceId,
      field: `pushDevices.${deviceId}`,
      data: {
        token: currentToken,
        platform: navigator.platform || 'web',
        browser: getBrowserSummary(),
        host: window.location.hostname,
        permission,
        active: true,
        createdAt: liveAppUser?.pushDevices?.[deviceId]?.createdAt || stamp,
        lastVerifiedAt: stamp,
        updatedAt: stamp
      }
    };
  };

  const shouldWritePushDevice = (deviceId, currentToken, permission) => {
    const existing = liveAppUser?.pushDevices?.[deviceId] || {};
    const lastVerified = existing.lastVerifiedAt ? new Date(existing.lastVerifiedAt).getTime() : 0;
    const refreshMs = 3 * 24 * 60 * 60 * 1000;
    const primaryTokenMissing = liveAppUser?.fcmToken !== currentToken;
    return primaryTokenMissing || existing.token !== currentToken || existing.permission !== permission || existing.host !== window.location.hostname || !lastVerified || Date.now() - lastVerified > refreshMs || liveAppUser?.pushNeedsRepair === true || liveAppUser?.pushForceServiceWorkerRefresh === true;
  };

  const shouldWritePushPermissionState = (permission, errorMessage = '', forceWrite = false) => {
    const explicitRepair = forceWrite || liveAppUser?.pushNeedsRepair === true || liveAppUser?.pushForceServiceWorkerRefresh === true;
    if (!explicitRepair && permission !== 'granted') return false;
    const existingPermission = liveAppUser?.notificationPermission || liveAppUser?.pushTokenPermission || '';
    const existingStatus = liveAppUser?.pushRepairStatus || '';
    const existingError = liveAppUser?.lastPushRepairError || '';
    const lastSync = liveAppUser?.lastPushTokenSyncAt ? new Date(liveAppUser.lastPushTokenSyncAt).getTime() : 0;
    const refreshMs = 7 * 24 * 60 * 60 * 1000;
    if (existingPermission !== permission) return true;
    if (permission === 'granted') return false;
    const nextStatus = permission === 'denied' ? 'blocked-by-browser' : 'permission-not-granted';
    if (existingStatus !== nextStatus) return true;
    if (errorMessage && existingError !== errorMessage) return true;
    return explicitRepair && (!lastSync || Date.now() - lastSync > refreshMs);
  };

  const repairPushOnThisDevice = async (source = 'manual') => {
    if (!getPushProfileDocId() || ghostTenant || isDemoMode || typeof window === 'undefined' || !('Notification' in window)) {
      addToast('Push Repair Blocked', 'Push repair is only available from the real logged-in device.');
      return false;
    }
    setIsPushRepairing(true);
    const originalRepairRequestId = getPushRepairRequestId();
    try {
      let permission = Notification.permission;
      if (permission === 'default') permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        await writePushProfilePatch({
          notificationPermission: permission,
          pushTokenPermission: permission,
          pushRepairStatus: permission === 'denied' ? 'blocked-by-browser' : 'permission-not-granted',
          lastPushRepairError: 'Browser notification permission is not granted.',
          lastPushTokenSyncAt: new Date().toISOString()
        }).catch(() => {});
        addToast('Notifications Blocked', 'This device needs browser notification permission before 86 Chaos can save a push token.');
        clearPushRepairLinkRequest('permission-not-granted');
        return false;
      }

      const supportedMessaging = await messagingReady.catch(() => null);
      if (!supportedMessaging) {
        await writePushProfilePatch({
          notificationPermission: permission,
          pushTokenPermission: permission,
          pushRepairStatus: 'unsupported-browser',
          lastPushRepairError: 'Firebase Messaging is not supported on this browser/session.',
          lastPushFailureCode: 'messaging/unsupported-browser',
          lastPushTokenSyncAt: new Date().toISOString()
        }).catch(() => {});
        addToast('Push Unavailable', 'This browser cannot run Firebase push notifications. You can still use 86 Chaos normally.');
        clearPushRepairLinkRequest('unsupported-browser');
        return false;
      }

      let registration = null;
      if ('serviceWorker' in navigator) {
        if (liveAppUser?.pushForceServiceWorkerRefresh) {
          const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
          await Promise.all((regs || []).filter(isFirebaseMessagingServiceWorkerRegistration).map(reg => reg.update?.().catch(() => null)));
        }
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { updateViaCache: 'none' }).catch(() => null);
        if (registration?.update) await registration.update().catch(() => null);
      }

      const tokenOptions = { vapidKey: getActiveVapidKey() };
      if (registration) tokenOptions.serviceWorkerRegistration = registration;
      const currentToken = await getToken(supportedMessaging, tokenOptions);
      if (!currentToken) throw new Error('Firebase returned no push token for this browser.');

      const stamp = new Date().toISOString();
      const device = buildPushDevicePatch(currentToken, permission, stamp);
      await writePushProfilePatch({
        [device.field]: device.data,
        fcmToken: currentToken,
        fcmTokenUpdatedAt: stamp,
        lastPushTokenSyncAt: stamp,
        notificationPermission: permission,
        pushTokenPermission: permission,
        pushTokenHost: window.location.hostname,
        pushTokenCanonical: true,
        pushTokenDedupeVersion: '16.0.65',
        pushNeedsRepair: false,
        pushForceServiceWorkerRefresh: false,
        pushRepairStatus: 'connected',
        pushRepairCompletedAt: stamp,
        pushRepairCompletedHost: window.location.hostname,
        lastPushRepairError: null,
        lastPushFailureCode: null
      }, { forceServerRepair: true, repairRequestId: originalRepairRequestId });
      setAppUser(prev => prev?.id === liveAppUser.id ? { ...prev, fcmToken: currentToken, pushNeedsRepair: false, pushForceServiceWorkerRefresh: false, notificationPermission: permission, pushTokenPermission: permission, pushTokenHost: window.location.hostname, pushRepairStatus: 'connected', lastPushRepairError: null, lastPushFailureCode: null } : prev);
      setPushRepairDismissed(true);
      try { localStorage.removeItem(getPushRepairDismissalKey(originalRepairRequestId)); } catch (_) {}
      addToast(source === 'auto' ? 'Push Reconnected' : 'Notifications Fixed', 'This device is connected for 86 Chaos push notifications.');
      clearPushRepairLinkRequest('repair-success');
      return true;
    } catch (err) {
      console.warn('86 Chaos push repair failed:', err?.message || err);
      const unsupportedMessaging = isFirebaseMessagingUnsupportedError(err);
      await writePushProfilePatch({
        notificationPermission: Notification.permission,
        pushTokenPermission: Notification.permission,
        pushRepairStatus: unsupportedMessaging ? 'unsupported-browser' : 'repair-failed',
        lastPushRepairError: err?.message || String(err),
        lastPushFailureCode: err?.code || (unsupportedMessaging ? 'messaging/unsupported-browser' : null),
        lastPushTokenSyncAt: new Date().toISOString()
      }).catch(() => {});
      if (source !== 'auto' && !pushRepairDismissed) addToast(unsupportedMessaging ? 'Push Unavailable' : 'Push Repair Failed', getPushErrorMessage(err));
      clearPushRepairLinkRequest(unsupportedMessaging ? 'unsupported-browser' : 'repair-failed');
      return false;
    } finally {
      setIsPushRepairing(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search || '');
    const hadRepairParam = params.has('pushRepair') || params.has('pushRepairNonce') || params.has('repairNonce');
    if (!hadRepairParam) return;
    const rawNonce = String(params.get('pushRepairNonce') || params.get('repairNonce') || params.get('pushRepair') || '').trim();
    const nonce = rawNonce && rawNonce !== '1' ? rawNonce.slice(0, 140) : '';
    setPushRepairLinkRequest({ requested: true, consumed: true, nonce, capturedNonce: nonce, capturedAt: new Date().toISOString() });
    ['pushRepair', 'pushRepairNonce', 'repairNonce'].forEach(key => params.delete(key));
    const cleanSearch = params.toString();
    const nextUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${window.location.hash || ''}`;
    try { window.history.replaceState({ ...(window.history.state || {}), pushRepairConsumed: true }, '', nextUrl); } catch (_) {}
  }, []);

  const pushRepairRequestedByLink = Boolean(pushRepairLinkRequest.requested);
  const pushRepairRequested = Boolean(!ghostTenant && !isDemoMode && liveAppUser?.id && (pushRepairRequestedByLink || liveAppUser?.pushNeedsRepair === true || liveAppUser?.pushForceServiceWorkerRefresh === true));
  useEffect(() => {
    if (!pushRepairRequested || typeof window === 'undefined') {
      setPushRepairDismissed(false);
      return;
    }
    try { setPushRepairDismissed(localStorage.getItem(getPushRepairDismissalKey()) === '1'); } catch (_) { setPushRepairDismissed(false); }
  }, [pushRepairRequested, liveAppUser?.pushTokenRepairNonce, pushRepairLinkRequest.nonce, liveAppUser?.id, liveAppUser?.uid, liveAppUser?.authUid, rId]);


  useEffect(() => {
    if (!liveAppUser?.id || ghostTenant || isDemoMode || typeof window === 'undefined' || !('Notification' in window)) return;

    const lastSyncAt = liveAppUser?.lastPushTokenSyncAt ? new Date(liveAppUser.lastPushTokenSyncAt).getTime() : 0;
    const autoSyncFreshMs = 6 * 60 * 60 * 1000;
    const permissionState = Notification.permission;
    const autoPushSyncStillFresh = Boolean(!pushRepairRequested && permissionState === 'granted' && lastSyncAt && Date.now() - lastSyncAt < autoSyncFreshMs && !liveAppUser?.pushNeedsRepair && !liveAppUser?.pushForceServiceWorkerRefresh);
    if (autoPushSyncStillFresh) {
      rememberSkippedFirestoreWrite();
      return;
    }
    if (pushRepairRequested) {
      try {
        const requestId = getPushRepairRequestId();
        const dismissalKey = getPushRepairDismissalKey(requestId);
        const autoAttemptKey = getPushRepairAutoAttemptKey(requestId);
        if (localStorage.getItem(dismissalKey) === '1') {
          setPushRepairDismissed(true);
          rememberSkippedFirestoreWrite();
          return;
        }
        if (sessionStorage.getItem(autoAttemptKey) === '1') {
          rememberSkippedFirestoreWrite();
          return;
        }
        sessionStorage.setItem(autoAttemptKey, '1');
      } catch (_) {}
    }

    let canceled = false;

    const syncPushToken = async (permission, showToast = false) => {
      if (canceled || permission !== 'granted') {
        if (!canceled && getPushProfileDocId() && shouldWritePushPermissionState(permission, '', pushRepairRequested)) {
          writePushProfilePatch({
            notificationPermission: permission,
            pushTokenPermission: permission,
            pushRepairStatus: permission === 'denied' ? 'blocked-by-browser' : 'permission-not-granted',
            lastPushTokenSyncAt: new Date().toISOString()
          }).catch(() => {});
        } else if (!canceled) {
          try {
            window.__chaosFirestoreDiagnostics = window.__chaosFirestoreDiagnostics || {};
            window.__chaosFirestoreDiagnostics.skippedNoOpWrites = (window.__chaosFirestoreDiagnostics.skippedNoOpWrites || 0) + 1;
          } catch (_) {}
        }
        if (pushRepairRequested) clearPushRepairLinkRequest(permission === 'denied' ? 'permission-denied' : 'permission-not-granted');
        return;
      }

      try {
        const supportedMessaging = await messagingReady.catch(() => null);
        if (!supportedMessaging) {
          if (shouldWritePushPermissionState(permission, 'messaging/unsupported-browser', pushRepairRequested)) {
            writePushProfilePatch({
              notificationPermission: permission,
              pushTokenPermission: permission,
              pushRepairStatus: 'unsupported-browser',
              lastPushRepairError: 'Firebase Messaging is not supported on this browser/session.',
              lastPushFailureCode: 'messaging/unsupported-browser',
              lastPushTokenSyncAt: new Date().toISOString()
            }).catch(() => {});
          }
          if (pushRepairRequested) clearPushRepairLinkRequest('unsupported-browser');
          return;
        }
        let registration = null;
        if ('serviceWorker' in navigator) {
          if (liveAppUser?.pushForceServiceWorkerRefresh) {
            const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
            await Promise.all((regs || []).filter(isFirebaseMessagingServiceWorkerRegistration).map(reg => reg.update?.().catch(() => null)));
          }
          registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { updateViaCache: 'none' }).catch(() => null);
          if (registration?.update) await registration.update().catch(() => null);
        }
        const tokenOptions = { vapidKey: getActiveVapidKey() };
        if (registration) tokenOptions.serviceWorkerRegistration = registration;
        const currentToken = await getToken(supportedMessaging, tokenOptions);
        if (!currentToken || canceled) return;
        const stamp = new Date().toISOString();
        const device = buildPushDevicePatch(currentToken, permission, stamp);
        if (!shouldWritePushDevice(device.deviceId, currentToken, permission)) return;
        await writePushProfilePatch({
          [device.field]: device.data,
          fcmToken: currentToken,
            fcmTokenUpdatedAt: stamp,
          lastPushTokenSyncAt: stamp,
          notificationPermission: permission,
          pushTokenPermission: permission,
          pushTokenHost: window.location.hostname,
          pushTokenCanonical: true,
          pushTokenDedupeVersion: '16.0.65',
          pushNeedsRepair: false,
          pushForceServiceWorkerRefresh: false,
          pushRepairStatus: 'connected',
          pushRepairCompletedAt: stamp,
          pushRepairCompletedHost: window.location.hostname,
          lastPushRepairError: null,
          lastPushFailureCode: null
        }, { forceServerRepair: pushRepairRequested, repairRequestId: getPushRepairRequestId() });
        setAppUser(prev => prev?.id === liveAppUser.id ? { ...prev, fcmToken: currentToken, pushNeedsRepair: false, pushForceServiceWorkerRefresh: false, notificationPermission: permission, pushTokenPermission: permission, pushTokenHost: window.location.hostname, pushRepairStatus: 'connected', lastPushRepairError: null, lastPushFailureCode: null } : prev);
        if (showToast) addToast('Push Ready', 'Push notifications are enabled for this device.');
        if (pushRepairRequested) clearPushRepairLinkRequest('auto-sync-success');
      } catch (err) {
        console.warn('86 Chaos push token sync failed:', err?.message || err);
        const unsupportedMessaging = isFirebaseMessagingUnsupportedError(err);
        const pushErrorMessage = err?.message || String(err);
        if (shouldWritePushPermissionState(permission, pushErrorMessage, pushRepairRequested)) {
          writePushProfilePatch({
            notificationPermission: permission,
            pushTokenPermission: permission,
            pushRepairStatus: unsupportedMessaging ? 'unsupported-browser' : 'sync-failed',
            lastPushRepairError: pushErrorMessage,
            lastPushFailureCode: err?.code || (unsupportedMessaging ? 'messaging/unsupported-browser' : null),
            lastPushTokenSyncAt: new Date().toISOString()
          }).catch(() => {});
        }
        if (pushRepairRequested) clearPushRepairLinkRequest(unsupportedMessaging ? 'unsupported-browser' : 'sync-failed');
      }
    };

    const timer = setTimeout(async () => {
      if (Notification.permission === 'default') {
        if (pushRepairRequested) {
          try {
            const permission = await Notification.requestPermission();
            await syncPushToken(permission, permission === 'granted');
          } catch (err) {
            console.warn('86 Chaos notification permission request failed:', err?.message || err);
          }
        } else {
          rememberSkippedFirestoreWrite();
        }
      } else if (pushRepairRequested || Notification.permission === 'granted') {
        await syncPushToken(Notification.permission, pushRepairRequested);
      } else {
        await syncPushToken(Notification.permission, false);
      }
    }, pushRepairRequested ? 600 : 2500);

    return () => { canceled = true; clearTimeout(timer); };
  }, [liveAppUser?.id, liveAppUser?.pushNeedsRepair, liveAppUser?.pushForceServiceWorkerRefresh, pushRepairLinkRequest.requested, pushRepairLinkRequest.nonce, pushRepairDismissed, ghostTenant, isDemoMode]);                      
  // --- FOREGROUND NOTIFICATION CATCHER ---
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    messagingReady.then((supportedMessaging) => {
      if (!active || !supportedMessaging) return;
      try {
        unsubscribe = onMessage(supportedMessaging, (payload) => {
          console.log("Foreground message caught:", payload);
          addToast(
            payload.notification?.title || 'System Alert', 
            payload.notification?.body || 'You have a new notification.'
          );
        });
      } catch (err) {
        if (!isFirebaseMessagingUnsupportedError(err)) console.warn('86 Chaos foreground messaging failed:', err?.message || err);
      }
    }).catch((err) => {
      if (!isFirebaseMessagingUnsupportedError(err)) console.warn('86 Chaos foreground messaging unavailable:', err?.message || err);
    });
    return () => { active = false; try { unsubscribe(); } catch (_) {} };
  }, [addToast]);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setIsGlobalSearchOpen(true); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const updateAlertMemory = useRememberedAlert({
    user: liveAppUser,
    workspaceId: rId,
    alertId: 'system-update-available',
    fingerprint: buildAlertFingerprint(CURRENT_VERSION, availableVersion || 'unknown')
  });
  const broadcastAlertMemory = useRememberedAlert({
    user: liveAppUser,
    workspaceId: rId,
    alertId: 'workspace-system-banner',
    fingerprint: buildAlertFingerprint(displayClientData?.systemBanner || '', displayClientData?.systemBannerUpdatedAt || '')
  });
  const pushRepairAlertMemory = useRememberedAlert({
    user: liveAppUser,
    workspaceId: rId,
    alertId: 'push-repair-needed',
    fingerprint: buildAlertFingerprint(
      getPushRepairRequestId(),
      typeof window !== 'undefined' ? window.location.hostname : ''
    )
  });

  const prevDay = () => { const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() - 1); setCurrentDate(formatDate(d)); };
  const nextDay = () => { const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() + 1); setCurrentDate(formatDate(d)); };
  const prevMonth = () => { const d = new Date(currentDate + 'T12:00:00'); d.setMonth(d.getMonth() - 1); setCurrentDate(formatDate(d)); };
  const nextMonth = () => { const d = new Date(currentDate + 'T12:00:00'); d.setMonth(d.getMonth() + 1); setCurrentDate(formatDate(d)); };

  const globalManagerBriefMathText = useMemo(() => {
    const today = getToday();
    const activeUserIds = new Set((displayUsers || []).filter(u => u?.isActive !== false).flatMap(u => [u.id, u.uid, u.authUid, u.userId].filter(Boolean)));
    const scheduled = (shifts || []).filter(s => {
      const shiftDate = String(s.date || s.scheduleDateKey || '');
      const statusText = String(s.status || s.scheduleStatus || '').toLowerCase();
      const deleted = s.isDeleted === true || s.cancelled === true || !!s.deletedAt || ['cancelled', 'canceled', 'deleted'].includes(statusText);
      const employeeOk = !s.employeeId || activeUserIds.has(s.employeeId);
      return shiftDate === today && !deleted && employeeOk;
    }).length;
    const rawClockedIn = (timePunches || []).filter(p => {
      const punchDate = String(p.date || p.shiftDate || p.clockInDate || '').slice(0, 10);
      const status = String(p.status || '').toLowerCase();
      const openPunch = Boolean(p.clockIn || p.clockInAt || p.startTime) && !(p.clockOut || p.clockOutAt || p.endTime);
      return (!punchDate || punchDate === today) && (['clocked_in', 'clocked in', 'on_break', 'on break'].includes(status) || openPunch);
    }).length;
    const clockedIn = Math.min(rawClockedIn, Math.max(scheduled, 0));
    const lowStock = (inventoryItems || []).filter(i => Number(i.parLevel || 0) > 0 && Number(i.currentStock || 0) < Number(i.parLevel || 0)).length;
    const urgentMaintenance = (maintenanceLogs || []).filter(m => !['completed', 'closed', 'resolved'].includes(String(m.status || '').toLowerCase()) && ['high', 'critical', 'urgent'].includes(String(m.urgency || m.priority || '').toLowerCase())).length;
    const pendingPeople = (timeOffRequests || []).filter(r => String(r.status || '').toLowerCase() === 'pending').length + (shiftSwaps || []).filter(sw => ['available', 'pending'].includes(String(sw.status || '').toLowerCase())).length;
    const needsEyes = lowStock + urgentMaintenance + pendingPeople;
    return `${scheduled} On Schedule ${clockedIn} Clocked In ${needsEyes} Needs Eyes`;
  }, [displayUsers, shifts, timePunches, inventoryItems, maintenanceLogs, timeOffRequests, shiftSwaps]);

  const cachedSessionAccessHydrating = shouldHoldAccessHydration({
    hasCachedSession: appUser?.sessionCached === true,
    signedOut: authRestoreState.status === WHOAMI_STATES.SIGNED_OUT,
    authPending: authRestoreState.status === WHOAMI_STATES.PENDING,
    profileLoading: Boolean(appUser?.sessionCached && directAccountUserState.loading),
    membershipLoading: Boolean(appUser?.sessionCached && rId && !ghostTenant && (
      currentMembershipDocument.loading ||
      currentMembershipCanonical.loading ||
      currentMembershipUid.loading ||
      currentMembershipAuthUid.loading ||
      currentMembershipEmail.loading
    )),
    whoamiStatus,
    localUserLooksSystemAdmin: Boolean(serverSaysSuperAdmin || localProfileHasSystemAdminMarker),
    roleControlsHydrating: Boolean(appUser?.sessionCached && appUser?.accessHydrationRequired && !directAccountUserState.resolved && !directAccountUserState.error)
  });

  const chunkRecoveryBanner = chunkRecoveryNotice ? (
    <div data-chaos-recovery-state={chunkRecoveryNotice.stage || 'manual-update-available'} role="alert" className="w-full max-w-3xl rounded-2xl border border-red-500/50 bg-red-950/50 text-white p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xl">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#D4A381]">Recovering app shell</p>
        <p className="text-xs font-bold text-slate-200 mt-1">A stale 86 Chaos file failed to load. This recovery surface stays visible while the app refreshes safely, without a blank page or reload loop.</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button type="button" aria-label="Recover app manually" onClick={runManualChunkRecovery} className="bg-white text-red-700 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest">RECOVER APP</button>
        <button type="button" aria-label="Dismiss app recovery notice" onClick={dismissChunkRecoveryNotice} className="bg-red-800/70 text-white px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest">Dismiss</button>
      </div>
    </div>
  ) : null;

  if (labelsToPrint) return <div className="non-admin-controls-compact"><DayDotPrintScreen labelsToPrint={labelsToPrint.items} prepDate={labelsToPrint.prepDate} appUser={liveAppUser} onClose={() => setLabelsToPrint(null)} /></div>;

  if (cachedSessionAccessHydrating) {
    return (
      <div className="non-admin-controls-compact min-h-screen bg-[#0B0E11] text-white flex flex-col items-center justify-center p-6 gap-4">
        {chunkRecoveryBanner}
        {showUpdateBanner && !updateAlertMemory.isDismissed && (
          <div data-chaos-recovery-state="manual-update-available" role="alert" className="w-full max-w-2xl rounded-2xl border border-red-500/50 bg-red-950/50 text-white p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xl">
            <span className="text-xs font-black uppercase tracking-widest">Update available. Refresh app to recover the newest version.</span>
            <button type="button" aria-label="Refresh now to recover the newest version" onClick={() => window.location.reload(true)} className="bg-white text-red-700 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest">REFRESH NOW</button>
          </div>
        )}
        <div className="max-w-sm w-full rounded-3xl border border-[#2A353D] bg-[#161D22]/95 p-6 text-center shadow-2xl">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-[#D4A381]" />
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#D4A381]">Restoring session</p>
          <h2 className="text-xl font-black mt-2">Checking your access</h2>
          <p className="text-xs font-bold text-slate-400 mt-3 leading-relaxed">86 Chaos is restoring your Firebase login, workspace membership, and verified permissions before showing role-based controls.</p>
        </div>
      </div>
    );
  }

  if (!liveAppUser) return <div className="non-admin-controls-compact"><LoginScreen users={displayUsers} setAppUser={setAppUser} addToast={addToast} /></div>;


  const renderMainContent = () => {
    if (mfaFrontendLockActive && !['settings', 'help'].includes(activeTabState)) {
      return (
        <div className={`${T.card} p-5 sm:p-8 max-w-2xl mx-auto text-center space-y-4 border-amber-500/40`}>
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl">🔐</div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">Elevated Account Protection</p>
            <h2 className="text-2xl font-black text-white mt-2">Two-Step Login Required</h2>
            <p className="text-sm font-bold text-slate-400 mt-3">This owner/manager/admin account needs MFA enrollment before elevated tools unlock. Open Account Security in Settings, finish setup, then log out and sign back in with the second factor.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={() => setActiveTab('settings')} className={T.btn}>Open Account Security</button>
            <button onClick={clearSessionAndLogout} className={T.btnAlt}>Log Out</button>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Keep enforcement off until every elevated account has tested enrollment and a fresh MFA login.</p>
        </div>
      );
    }
    const routeAccess = planAccess.canRoute(activeTabState, { clientFeatures: displayClientFeatures, serverVerifiedPlatformAdmin: serverSaysSuperAdmin, platformAdminPending: serverAdminCheckPending || serverAdminCheckTemporarilyUnavailable });
    const routeAllowed = routeAccess && routeAccess.allowed === true;
    const routeIsInternalAdmin = activeTabState === 'godmode';
    if (!routeIsInternalAdmin && routeAccess && routeAccess.allowed === false) return <LockedFeatureScreen access={routeAccess} appUser={liveAppUser} setActiveTab={stableSetActiveTab} />;
    if (activeTabState === 'today') return <TabToday key={`tdy-${rId}`} currentDate={currentDate} appUser={liveAppUser} users={displayUsers} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} sales={sales} timePunches={timePunches} inventoryItems={inventoryItems} maintenanceLogs={maintenanceLogs} prepItems={prepItems} tasks={tasks} recipes={recipes} menuDependencies={menuDependencies} restaurantAdminAlerts={restaurantAdminAlerts} clientData={displayClientData} setActiveTab={setActiveTab} addToast={addToast} registerUndo={registerUndo} />;
    if (activeTabState === 'schedule' && routeAllowed) return <TabMasterSchedule key={`schpub-${rId}-${liveAppUser?.id}`} currentDate={currentDate} setCurrentDate={setCurrentDate} onSubTabChange={setActiveScheduleSubTab} appUser={liveAppUser} users={scheduleDisplayUsers} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} addToast={addToast} initialSubTab="schedule-builder" voiceScheduleSubTabTarget={voiceScheduleSubTabTarget} clientData={displayClientData} scheduleBuilderProps={{ currentDate, users: scheduleDisplayUsers, shifts, events, timeOffRequests, timePunches, addToast, appUser: liveAppUser, clientData: displayClientData }} />;
    if (activeTabState === 'events' && routeAllowed) return <TabSchedule key={`evt-${rId}`} currentDate={currentDate} users={scheduleDisplayUsers} shifts={shifts} events={events} timeOffRequests={timeOffRequests} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} initialSubTab="events" hideSubTabs />;
    if (activeTabState === 'published') return <TabMasterSchedule key={`pub-${rId}-${liveAppUser?.id}`} currentDate={currentDate} setCurrentDate={setCurrentDate} onSubTabChange={setActiveScheduleSubTab} appUser={liveAppUser} users={scheduleDisplayUsers} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} addToast={addToast} voiceScheduleSubTabTarget={voiceScheduleSubTabTarget} clientData={displayClientData} scheduleBuilderProps={{ currentDate, users: scheduleDisplayUsers, shifts, events, timeOffRequests, timePunches, addToast, appUser: liveAppUser, clientData: displayClientData }} />;
    if (activeTabState === 'ops' && routeAllowed) return <TabOpsCenter key={`ops-${rId}`} currentDate={currentDate} appUser={liveAppUser} users={displayUsers} shifts={shifts} events={events} sales={sales} timePunches={timePunches} addToast={addToast} setActiveTab={setActiveTab} clientData={displayClientData} />;
    if (activeTabState === 'back-office' && routeAllowed) return <TabBackOffice key={`bo-${rId}`} currentDate={currentDate} users={displayUsers} sales={sales} timePunches={timePunches} restaurantAdminAlerts={restaurantAdminAlerts} appUser={liveAppUser} clientData={displayClientData} setActiveTab={setActiveTab} addToast={addToast} />;
    if ((activeTabState === 'financials' || activeTabState === 'sales' || activeTabState === 'labor') && routeAllowed) return <TabFinancials key={`fin-${rId}`} currentDate={currentDate} users={displayUsers} shifts={shifts} sales={sales} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} setActiveTab={setActiveTab} initialSubTab={activeTabState === 'sales' ? 'ledger' : activeTabState === 'labor' ? 'labor' : 'overview'} />;
    if (activeTabState === 'messages' && routeAllowed) return <TabMessages key={`msg-${rId}`} events={events} appUser={liveAppUser} users={displayUsers} addToast={addToast} />;
    if (activeTabState === 'prep' && routeAllowed) return <TabPrep key={`prp-${rId}`} currentDate={currentDate} appUser={liveAppUser} addToast={addToast} setLabelsToPrint={setLabelsToPrint} />;
    if (activeTabState === 'recipes' && routeAllowed) return <TabRecipes key={`rec-${rId}`} appUser={liveAppUser} addToast={addToast} voiceRecipeTarget={voiceRecipeTarget} />;
    if (activeTabState === 'inventory' && routeAllowed) return <TabInventory key={`inv-${rId}-${inventorySubTabTarget || 'default'}`} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} initialSubTab={inventorySubTabTarget} onInitialSubTabConsumed={() => setInventorySubTabTarget(null)} />;
    if (activeTabState === 'ai-tools' && routeAllowed) return <TabAITools key={`ai-${rId}`} appUser={liveAppUser} clientData={displayClientData} setActiveTab={setActiveTab} setInventorySubTabTarget={setInventorySubTabTarget} addToast={addToast} />;
    if (activeTabState === 'menu-intelligence' && routeAllowed) return <TabMenuIntelligence key={`mi-${rId}`} appUser={liveAppUser} clientData={displayClientData} inventoryItems={inventoryItems} addToast={addToast} />;
    if (activeTabState === 'reminders' && routeAllowed) return <TabPersonalReminders key={`rem-${rId}-${liveAppUser?.id}`} appUser={liveAppUser} addToast={addToast} />;
    if (activeTabState === 'team' && routeAllowed) return <TabTeam key={`tea-${rId}`} appUser={liveAppUser} users={displayUsers} clientData={displayClientData} addToast={addToast} />;
    if (activeTabState === 'hr-training' && routeAllowed) return <TabHrTraining key={`hrt-${rId}-${liveAppUser?.id}`} appUser={liveAppUser} users={displayUsers} addToast={addToast} />;
    if (activeTabState === 'maintenance' && routeAllowed) return <TabMaintenance key={`mtn-${rId}`} appUser={liveAppUser} addToast={addToast} />;
    if (activeTabState === 'settings' && routeAllowed) return <TabSettings key={`set-${rId}`} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} users={displayUsers} presenceSelf={selfPresenceRecord} />;
    if (activeTabState === 'help' && routeAllowed) return <TabHelpCenter key={`help-${rId}`} appUser={liveAppUser} activeTab={activeTabState} helpOrigin={helpOriginState} voiceHelpSearchTarget={voiceHelpSearchTarget} addToast={addToast} setActiveTab={stableSetActiveTab} setScheduleSubTabTarget={setVoiceScheduleSubTabTarget} setInventorySubTabTarget={setInventorySubTabTarget} />;
    if (activeTabState === 'godmode' && serverSaysSuperAdmin) return <TabGodMode key={`god-${rId}-${serverAdminRetryKey}`} appUser={{ ...liveAppUser, isSuperAdmin: true, serverAdminCheck }} addToast={addToast} setGhostTenant={setGhostTenant} setActiveTab={stableSetActiveTab} />;
    if (activeTabState === 'godmode' && (serverAdminCheckPending || serverAdminCheckTemporarilyUnavailable) && pendingLocalSystemAdminHint) return (
      <div className={`${T.card} p-5 sm:p-8 max-w-2xl mx-auto text-center space-y-4 border-amber-500/40`}>
        <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 text-2xl">🔐</div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">Verifying secure access</p>
          <h2 className="text-xl font-black text-white mt-2">System Administrator check is temporarily unavailable</h2>
          <p className="text-sm font-bold text-slate-400 mt-2">Your normal 86 Chaos tools are still available. Protected platform controls will open after the server verifies this account.</p>
          {serverAdminCheck?.error && <p className="text-xs font-bold text-amber-200/80 mt-3">Last check: {String(serverAdminCheck.error).slice(0, 180)}</p>}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
            <div className="rounded-xl bg-black/20 border border-white/10 p-2">HTTP: <span className="text-slate-200">{platformAdminAccessState.statusCode || 'pending'}</span></div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-2">Reason: <span className="text-slate-200">{platformAdminAccessState.reasonCategory || serverAdminCheck?.reasonCategory || 'verification-pending'}</span></div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-2">Retryable: <span className="text-slate-200">{platformAdminAccessState.retryable ? 'yes' : 'checking'}</span></div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-2">API: <span className="text-slate-200">{serverAdminCheck?.version || 'unknown'}</span></div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-2">Firebase: <span className="text-slate-200">{serverAdminCheck?.runtime?.firebaseProjectId || 'unknown'}</span></div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-2">State: <span className="text-slate-200">{platformAdminAccessState.state}</span></div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={() => setServerAdminRetryKey(k => k + 1)} className={T.btn}>Retry Verification</button>
          <button onClick={() => setActiveTab('today')} className={T.btnAlt}>Use Normal App</button>
          <button onClick={() => setActiveTab('help')} className={T.btnAlt}>Open Help Center</button>
        </div>
      </div>
    );
    if (activeTabState === 'godmode') return (
      <div className={`${T.card} p-5 sm:p-8 max-w-2xl mx-auto text-center space-y-4 border-red-900/40`}>
        <div className="mx-auto w-12 h-12 rounded-2xl bg-red-900/20 border border-red-900/50 flex items-center justify-center text-red-300 text-2xl">🔐</div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-300">Restricted Platform Tools</p>
          <h2 className="text-xl font-black text-white mt-2">Your role does not include this area</h2>
          <p className="text-sm font-bold text-slate-400 mt-2">These internal platform controls are hidden for this account.</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
            <div className="rounded-xl bg-black/20 border border-white/10 p-2">HTTP: <span className="text-slate-200">{platformAdminAccessState.statusCode || serverAdminCheck?.statusCode || 'not checked'}</span></div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-2">Reason: <span className="text-slate-200">{platformAdminAccessState.reasonCategory || serverAdminCheck?.reasonCategory || 'platform-authority-required'}</span></div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-2">API: <span className="text-slate-200">{serverAdminCheck?.version || 'unknown'}</span></div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-2">Firebase: <span className="text-slate-200">{serverAdminCheck?.runtime?.firebaseProjectId || 'unknown'}</span></div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={() => setActiveTab('today')} className={T.btn}>Go to Today</button>
          <button onClick={() => setActiveTab('help')} className={T.btnAlt}>Open Help Center</button>
          <button onClick={clearSessionAndLogout} className={T.btnAlt}>Log Out</button>
        </div>
      </div>
    );
    if (activeTabState === 'audit' && routeAllowed) return <TabAuditLog key={`aud-${rId}`} appUser={liveAppUser} />;

    return (
      <div className={`${T.card} p-5 sm:p-8 max-w-2xl mx-auto text-center space-y-4`}>
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#12161A] border border-[#2A353D] flex items-center justify-center text-[#D4A381]">
          <Menu size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">This page is not available</h2>
          <p className="text-sm font-bold text-slate-400 mt-2">The tab may be turned off for this workspace, your permissions may have changed, or an old app link opened a page that no longer exists.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={() => setActiveTab('today')} className={T.btn}>Go to Today</button>
          <button onClick={() => setIsMenuOpen(true)} className={T.btnAlt}>Open Menu</button>
        </div>
      </div>
    );
  };

  // MAINTENANCE LOCK SCREEN
  // Global lockdown should affect every workspace, including the active workspace, but never lock out
  // the platform owner/super-admin account that needs to lift the lockdown.
  const maintenanceBypass = Boolean(
    liveAppUser?.isSuperAdmin === true ||
    serverSaysSuperAdmin
  );
  const maintenanceEndsMs = clientData?.maintenanceEndsAt ? new Date(clientData.maintenanceEndsAt).getTime() : 0;
  const maintenanceExpired = maintenanceEndsMs && Number.isFinite(maintenanceEndsMs) && maintenanceEndsMs <= Date.now();
  const maintenanceAudience = clientData?.maintenanceAudience || 'everyone_except_super_admin';
  const maintenanceAppliesToUser = maintenanceAudience === 'employees_only'
    ? !liveAppUser?.isAdmin
    : maintenanceAudience === 'non_admins'
      ? !liveAppUser?.isAdmin
      : true;
  if ((clientData?.maintenanceMode === true || clientData?.subscription?.status === 'past_due') && !maintenanceExpired && maintenanceAppliesToUser && !ghostTenant && !maintenanceBypass) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${T.bg}`}>
        <div className="bg-[#1A2126] p-8 rounded-3xl border border-red-900/50 shadow-2xl max-w-md w-full">
          <span className="text-6xl mb-4 block">🛠️</span>
          <h1 className="text-2xl font-black text-white mb-2">Down for Maintenance</h1>
          <p className="text-slate-400 font-medium mb-6">{clientData.maintenanceMessage || `86 Chaos is temporarily down for maintenance for ${clientData.name || 'this workspace'}. Please check back shortly or contact your management team if service does not return soon.`}</p>
          {clientData.maintenanceEndsAt && <div className="mb-4 bg-[#12161A] border border-[#2A353D] rounded-xl p-3 text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Scheduled return: {new Date(clientData.maintenanceEndsAt).toLocaleString()}</div>}
          <button onClick={clearSessionAndLogout} className="w-full bg-red-900/20 text-red-500 font-black py-3 rounded-xl border border-red-900/50 hover:bg-red-900/40 transition-all uppercase tracking-widest">Log Out</button>
        </div>
      </div>
    );
  }

  const appAccentColor = /^#[0-9A-Fa-f]{6}$/.test(displayClientData?.systemSettings?.accentColor || '') ? displayClientData.systemSettings.accentColor : '#D4A381';
  const appThemeStyle = { '--chaos-accent': appAccentColor };

return (
    <div style={appThemeStyle} onClickCapture={blockDemoMutation} onSubmitCapture={blockDemoMutation} className={`desktop-pro-shell ui-v13-polished ui-v12-compact cockpit-shell ${activeTabState === 'godmode' ? '' : 'non-admin-controls-compact'} kitchen-simple-shell ui-density-${liveAppUser?.preferences?.uiDensity || displayClientData?.systemSettings?.uiDensity || 'compact'} recipe-density-${liveAppUser?.preferences?.recipeDensity || displayClientData?.systemSettings?.recipeCardDensity || 'tight'} motion-${liveAppUser?.preferences?.motionMode || displayClientData?.systemSettings?.cockpitLights || 'normal'} min-h-screen font-sans flex flex-col w-full max-w-[100vw] overflow-x-hidden ${T.bg}`}>
      
      {/* GHOST / DEMO MODE BANNER */}
      {ghostTenant && (
        <div className={`${isDemoMode ? 'bg-gradient-to-r from-blue-900 to-cyan-900 border-cyan-500/50' : 'bg-gradient-to-r from-purple-900 to-fuchsia-900 border-fuchsia-500/50'} text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-between sticky top-0 z-[99999] shadow-2xl uppercase tracking-wider border-b`}>
          <div className="flex items-center gap-2 min-w-0">
            <Moon size={16} className={`flex-shrink-0 animate-pulse ${isDemoMode ? 'text-cyan-300' : 'text-fuchsia-300'}`} />
            <span className="truncate">{isDemoMode ? `DEMO MODE: ${liveAppUser?.demoRole === 'employee' ? 'Regular Employee' : 'Manager'} view @ ${ghostTenant.name} • contact info hidden • read-only` : `GHOST MODE OVERRIDE: ${ghostTenant.impersonate ? `${ghostTenant.impersonate.name || ghostTenant.impersonate.email} @ ${ghostTenant.name}` : ghostTenant.name}`}</span>
          </div>
          <button onClick={() => { setGhostTenant(null); disarmPwaBackExit(); writeTopLevelTabHistory('godmode', { replace: true }); transitionActiveTabState('godmode'); }} className="bg-white text-slate-900 px-3 py-1.5 rounded-lg font-black text-[10px] shadow-md hover:bg-slate-100 transition-all tracking-widest flex-shrink-0 ml-3">
            {isDemoMode ? 'EXIT DEMO' : 'EXIT GHOST MODE'}
          </button>
        </div>
      )}
      
      <style>{`
        html, body { overflow-x: hidden !important; max-width: 100vw !important; width: 100% !important; background-color: #0F1318 !important; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes toastSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-toast { animation: toastSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="date"]::-webkit-calendar-picker-indicator, input[type="month"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .cockpit-shell { --chaos-copper: var(--chaos-accent, #D4A381); --chaos-panel: #1A2126; --chaos-deck: #12161A; --chaos-accent-soft: color-mix(in srgb, var(--chaos-accent, #D4A381) 82%, white); --chaos-accent-strong: color-mix(in srgb, var(--chaos-accent, #D4A381) 78%, black); }
        .cockpit-shell [class*="text-[#D4A381]"], .cockpit-shell [class*="hover:text-[#D4A381]"]:hover { color: var(--chaos-accent, #D4A381) !important; }
        .cockpit-shell [class*="border-[#D4A381]"], .cockpit-shell [class*="focus:border-[#D4A381]"]:focus { border-color: var(--chaos-accent, #D4A381) !important; }
        .cockpit-shell [class*="bg-[#8F6040]"] { background-color: var(--chaos-accent-strong) !important; }
        .cockpit-shell [class*="accent-[#8F6040]"] { accent-color: var(--chaos-accent, #D4A381) !important; }
        .cockpit-shell [class*="from-[#C59373]"][class*="to-[#8F6040]"] { background-image: linear-gradient(to right, var(--chaos-accent-soft), var(--chaos-accent-strong)) !important; }
        .cockpit-shell .brand-logo-stack img { object-fit: contain; }
        .ui-v12-compact button { touch-action: manipulation; }
        .ui-v12-compact textarea { line-height: 1.35 !important; }
        .cockpit-light { position: relative; display: inline-flex; width: .55rem; height: .55rem; border-radius: 999px; box-shadow: 0 0 6px currentColor; }
        .cockpit-light::after { content: ''; position: absolute; inset: -4px; border-radius: 999px; background: currentColor; opacity: .08; animation: none; }
        .cockpit-light.quiet::after { animation: none !important; opacity: .08; }
        .cockpit-light.slow::after { animation: cockpitPing 5.5s infinite; opacity: .12; }
        .cockpit-light.hot::after { animation: cockpitPing 1.8s infinite; opacity: .24; }
        @keyframes cockpitPing { 0% { transform: scale(.75); opacity: .28; } 70%,100% { transform: scale(1.8); opacity: 0; } }
        @keyframes softGlow { 0%,100% { box-shadow: 0 0 0 rgba(212,163,129,0); } 50% { box-shadow: 0 0 18px rgba(212,163,129,.22); } }
        .cockpit-panel { background: linear-gradient(180deg, rgba(26,33,38,.98), rgba(15,19,24,.98)); border: 1px solid #2A353D; box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 16px 50px rgba(0,0,0,.18); }
        .cockpit-grid { background-image: radial-gradient(circle at 1px 1px, rgba(212,163,129,.09) 1px, transparent 0); background-size: 18px 18px; }
        .kitchen-simple-shell .cockpit-grid { background-image: none; }
        .kitchen-simple-shell .cockpit-light { box-shadow: none; }
        .kitchen-simple-shell [class*="tracking-[0.35em]"] { letter-spacing: .18em !important; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .message-pro .message-card-pro { box-shadow: inset 0 1px 0 rgba(255,255,255,.025), 0 8px 28px rgba(0,0,0,.12); }
        .recipe-card-v13 { min-height: 0 !important; }
        .recipe-card-v13:hover { transform: translateY(-1px); }
        .ui-density-ultra main { padding: .6rem !important; }
        .ui-density-ultra .p-5 { padding: .75rem !important; }
        .ui-density-ultra .p-4 { padding: .65rem !important; }
        .ui-density-ultra .gap-4 { gap: .55rem !important; }
        .ui-density-comfortable main { padding: 1.25rem !important; }
        .recipe-density-tight .recipe-card-v13 .p-2\.5 { padding: .55rem !important; }
        .recipe-density-tight .recipe-card-v13 h3 { font-size: .9rem !important; line-height: 1.15rem !important; }
        .motion-reduced .cockpit-light::after, .motion-quiet .cockpit-light::after { animation: none !important; opacity: .08 !important; }
        .motion-quiet .cockpit-light { box-shadow: none !important; }

        @media (max-width: 640px) {
          .ui-v12-compact main { padding: .75rem !important; }
          .ui-v12-compact button:not(.no-compact) { min-height: 44px !important; padding-top: .42rem !important; padding-bottom: .42rem !important; }
          .ui-v12-compact textarea { min-height: 42px !important; font-size: 14px !important; }
          .ui-v12-compact .rounded-3xl { border-radius: 1rem !important; }
          .ui-v12-compact .rounded-2xl { border-radius: .85rem !important; }
          .ui-v12-compact .p-6 { padding: 1rem !important; }
          .ui-v12-compact .p-5 { padding: .85rem !important; }
          .ui-v12-compact .p-4 { padding: .75rem !important; }
          .ui-v12-compact .gap-5 { gap: .75rem !important; }
          .ui-v12-compact .gap-4 { gap: .65rem !important; }
          .ui-v12-compact .text-2xl { font-size: 1.25rem !important; line-height: 1.55rem !important; }
          .ui-v12-compact .text-xl { font-size: 1.05rem !important; line-height: 1.4rem !important; }
          .ui-v12-compact .text-lg { font-size: .98rem !important; line-height: 1.3rem !important; }
        }
      `}</style>

      {chunkRecoveryBanner && <div className="px-3 pt-3 flex justify-center">{chunkRecoveryBanner}</div>}

      {/* UPDATE ALERT BANNER */}
      {showUpdateBanner && !updateAlertMemory.isDismissed && (
        <div data-chaos-recovery-state="manual-update-available" role="alert" className="bg-red-600 text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-between sticky top-0 z-[9999] shadow-2xl uppercase tracking-wider">
          <div className="flex items-center gap-2 min-w-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 animate-pulse text-white"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
            <span className="truncate">Update available. Refresh app to recover the newest version.</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button 
              onClick={() => window.location.reload(true)} 
              aria-label="Refresh now to recover the newest version"
              className="bg-white text-red-600 px-3 py-1.5 rounded-lg font-black text-[10px] shadow-md hover:bg-slate-100 transition-all tracking-widest"
            >
              REFRESH NOW
            </button>
            <button type="button" onClick={updateAlertMemory.dismiss} className="p-1.5 rounded-lg bg-red-700/70 hover:bg-red-800 text-white" title="Dismiss this update notice"><X size={14}/></button>
          </div>
        </div>
      )}

      {pushRepairRequested && !pushRepairDismissed && !pushRepairAlertMemory.isDismissed && (
        <div className="bg-amber-500 text-slate-950 text-[11px] sm:text-xs font-black px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sticky top-0 z-[9998] shadow-2xl uppercase tracking-wider border-b border-amber-300">
          <div className="flex items-center gap-2 min-w-0">
            <Bell size={15} className="flex-shrink-0" />
            <span className="truncate">Reconnect notifications on this device so your restaurant can send alerts.</span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => repairPushOnThisDevice('manual')} disabled={isPushRepairing} className="bg-slate-950 text-amber-200 px-3 py-1.5 rounded-lg font-black text-[10px] shadow-md disabled:opacity-60">{isPushRepairing ? 'FIXING...' : 'FIX NOW'}</button>
            <button onClick={() => { try { localStorage.setItem(getPushRepairDismissalKey(), '1'); } catch (_) {} setPushRepairDismissed(true); clearPushRepairLinkRequest('dismissed'); pushRepairAlertMemory.dismiss(); }} className="bg-amber-200/60 text-slate-950 px-3 py-1.5 rounded-lg font-black text-[10px]">DON'T SHOW AGAIN</button>
          </div>
        </div>
      )}

      <header className="app-header sticky top-0 z-40 shadow-sm border-b h-16 flex items-center justify-between px-4 bg-[#12161A]/95 backdrop-blur-md border-[#2A353D]">
        <CheersLogo clientData={displayClientData} />

        {/* ACTIVE WORKSPACE NAME / SWITCHER */}
        {liveAppUser && (
          <div className="flex-1 text-center px-4 truncate mt-1">
            <button
              type="button"
              onClick={() => availableWorkspaces.length > 1 && !ghostTenant && !isDemoMode ? setIsWorkspaceSwitcherOpen(true) : null}
              className={`max-w-full truncate min-h-[44px] px-3 py-2 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest ${availableWorkspaces.length > 1 && !ghostTenant && !isDemoMode ? 'text-[#D4A381] hover:text-white cursor-pointer' : 'text-slate-400 cursor-default'}`}
              title={availableWorkspaces.length > 1 ? `Switch workspace: ${liveAppUser.restaurantName || 'Restaurant'}` : `Active workspace: ${liveAppUser.restaurantName || 'Restaurant'}`}
              aria-label={availableWorkspaces.length > 1 ? `Switch workspace. Active workspace ${liveAppUser.restaurantName || 'Restaurant'}.` : `Active workspace ${liveAppUser.restaurantName || 'Restaurant'}`}
            >
              {liveAppUser.restaurantName || "Restaurant"}{availableWorkspaces.length > 1 && !ghostTenant && !isDemoMode ? ' • Switch' : ''}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <button type="button" aria-label="Report a problem" onClick={() => openProblemReport({ title: 'Manual Problem Report', message: `Page: ${activeTabState}`, category: 'Bug / Error' })} className="hidden sm:flex p-2 border rounded-xl shadow-sm bg-[#1A2126] border-[#2A353D] text-orange-300 hover:text-white" title="Report a problem"><Bug size={18}/></button>
          {offlineQueue.length > 0 && <button type="button" aria-label="Report a problem" onClick={() => openProblemReport({ title: 'Offline Queue', message: `${offlineQueue.length} queued action(s) waiting to sync.`, category: 'Data Looks Wrong' })} className="hidden sm:flex px-2.5 py-2 border rounded-xl shadow-sm bg-amber-900/20 border-amber-500/40 text-amber-200 text-[10px] font-black uppercase tracking-widest" title="Offline queued actions">Queue {offlineQueue.length}</button>}
        <button type="button" aria-label="Open navigation menu" title="Open navigation menu" onClick={openMenu} className={`relative p-2 border rounded-xl shadow-sm transition-all outline-none bg-[#1A2126] border-[#2A353D] ${T.copper} hover:text-white flex-shrink-0`}>
          <Menu size={20} />
          {hasAnyMenuAlert && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#12161A] shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>}
        </button>
        </div>
      </header>

      {/* SYSTEM BROADCAST BANNER */}
      {displayClientData?.systemBanner && !broadcastAlertMemory.isDismissed && (
        <div className="bg-blue-600 border-b border-blue-800 text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-center shadow-lg uppercase tracking-wider w-full relative z-30 animate-[slideIn_0.2s_ease-out]">
          <div className="flex items-center gap-2 text-center pr-10">
            <Bell size={14} className="animate-pulse flex-shrink-0" />
            <span>{displayClientData.systemBanner}</span>
          </div>
          <button type="button" onClick={broadcastAlertMemory.dismiss} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-blue-700/70 hover:bg-blue-800 text-white" title="Dismiss this announcement"><X size={14}/></button>
        </div>
      )}

      <DrawerMenu isOpen={isMenuOpen} onClose={closeMenu} activeTab={activeTabState} setActiveTab={stableSetActiveTab} appUser={liveAppUser} setAppUser={setAppUser} hasUnreadMessages={hasUnreadMessages} hasMyShiftAlert={hasMyShiftAlert} hasScheduleBuilderAlert={hasScheduleBuilderAlert} hasHelpUpdate={hasHelpUpdate} clientFeatures={displayClientFeatures} clientData={displayClientData} addToast={addToast} availableWorkspaces={availableWorkspaces} activeWorkspaceName={liveAppUser?.restaurantName || displayClientData?.name || ''} onOpenWorkspaceSwitcher={openWorkspaceSwitcherFromDrawer} platformAdminAccessState={platformAdminAccessState} />
      <GlobalSearchModal isOpen={isGlobalSearchOpen} onClose={closeGlobalSearch} queryText={globalSearchQuery} setQueryText={setGlobalSearchQuery} users={displayUsers} events={events} shifts={shifts} recipes={recipes} inventoryItems={inventoryItems} maintenanceLogs={maintenanceLogs} setActiveTab={stableSetActiveTab} appUser={liveAppUser} clientData={displayClientData} clientFeatures={displayClientFeatures} />
      <KitchenTVMode isOpen={isKitchenTVOpen} onClose={closeKitchenTV} shifts={shifts} events={events} prepItems={prepItems} maintenanceLogs={maintenanceLogs} inventoryItems={inventoryItems} />
      <UndoBar undoItem={undoItem} clearUndo={clearUndoItem} />
      <VoiceCommandDock appUser={liveAppUser} inventoryItems={inventoryItems} recipes={recipes} users={displayUsers} prepItems={prepItems} tasks={tasks} events={events} maintenanceLogs={maintenanceLogs} menuDependencies={menuDependencies} shifts={shifts} timePunches={timePunches} timeOffRequests={timeOffRequests} sales={sales} clientFeatures={displayClientFeatures} clientData={displayClientData} setActiveTab={stableSetActiveTab} setCurrentDate={setCurrentDate} setScheduleSubTabTarget={setVoiceScheduleSubTabTarget} setHelpSearchTarget={setVoiceHelpSearchTarget} setRecipeTarget={setVoiceRecipeTarget} addToast={addToast} />

      <Modal isOpen={problemModal.open} onClose={() => !isSubmittingProblem && setProblemModal({ open: false, title: '', message: '', category: 'Bug / Error' })} title="Report Problem" sizeClass="max-w-3xl">
        <form onSubmit={submitProblemReport} className="space-y-4">
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Problem context</div>
            <div className="text-sm font-black text-white mt-1">{problemModal.title || 'Manual report'}</div>
            {problemModal.message && <div className="text-xs font-bold text-slate-400 mt-1 whitespace-pre-wrap">{problemModal.message}</div>}
          </div>
          <select value={problemModal.category || 'Bug / Error'} onChange={e => setProblemModal(prev => ({ ...prev, category: e.target.value }))} className={T.input}>
            <option>Bug / Error</option><option>Permission Problem</option><option>Data Looks Wrong</option><option>Mobile Layout Problem</option><option>Device Problem</option><option>Feature Request</option>
          </select>
          <textarea value={problemText} onChange={e => setProblemText(e.target.value)} rows={5} className={T.input} placeholder="Tell me what you clicked, what you expected, and what happened." required />
          <div className="grid sm:grid-cols-2 gap-2">
            {getDeviceDiagnostics().map(([label, value]) => <div key={label} className="bg-[#12161A] border border-[#2A353D] rounded-xl px-3 py-2"><div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</div><div className="text-xs font-bold text-slate-200 break-all mt-1">{value}</div></div>)}
          </div>
          {offlineQueue.length > 0 && <button type="button" onClick={syncOfflineQueueFromShell} disabled={offlineSyncing} className={`${T.btnAlt} w-full disabled:opacity-50`}>{offlineSyncing ? 'Syncing Offline Queue...' : `Try Sync Offline Queue (${offlineQueue.length})`}</button>}
          <button type="submit" disabled={isSubmittingProblem || !problemText.trim()} className={`${T.btn} w-full flex items-center justify-center gap-2 disabled:opacity-50`}>{isSubmittingProblem ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>} Send Problem Report</button>
        </form>
      </Modal>

      {ghostTenant?.impersonate && (
        <div className="bg-fuchsia-950/60 border-b border-fuchsia-500/30 px-4 py-2 text-[10px] sm:text-xs text-fuchsia-100 font-bold flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>Viewing user: <strong>{ghostTenant.impersonate.name || 'Unnamed'}</strong></span>
          <span>Email: <strong>{ghostTenant.impersonate.email || 'No email'}</strong></span>
          <span>Role: <strong>{ghostTenant.impersonate.role || 'No role'}</strong></span>
          <span>User ID: <strong className="font-mono">{ghostTenant.impersonate.id}</strong></span>
        </div>
      )}
      
      {['schedule', 'events', 'published', 'month', 'financials', 'sales', 'back-office', 'prep'].includes(activeTabState) && !( ['schedule','published'].includes(activeTabState) && activeScheduleSubTab === 'time-off') && (
        <div className="desktop-date-strip py-4 px-4 shadow-sm z-30 border-b flex justify-between items-center bg-[#1A2126] border-[#2A353D] relative">
          {(activeTabState === 'sales' || activeTabState === 'financials' || activeTabState === 'back-office') ? (
            <div className="w-full text-center">
              <h2 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase">{activeTabState === 'back-office' ? 'Back Office' : 'Financials'}</h2>
            </div>
          ) : (
            <>
              <button onClick={activeTabState === 'prep' ? prevDay : prevMonth} className="p-2 border rounded-xl transition-colors bg-[#12161A] border-[#2A353D] text-slate-400 hover:text-[#D4A381] relative z-10"><ChevronLeft size={20} /></button>
              
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <h2 onClick={() => setIsDateModalOpen(true)} className="text-xl sm:text-2xl font-black tracking-tight text-center cursor-pointer transition-colors text-white hover:text-[#D4A381] pointer-events-auto">
                  {activeTabState === 'events' ? 'Event Calendar' : activeTabState === 'prep' || ((activeTabState === 'schedule' || activeTabState === 'published') && activeScheduleSubTab === 'full-schedule') ? formatDisplayFullDate(currentDate) : formatDisplayMonth(getMonthStr(currentDate))}
                </h2>
              </div>

              <button onClick={activeTabState === 'prep' ? nextDay : nextMonth} className="p-2 border rounded-xl transition-colors bg-[#12161A] border-[#2A353D] text-slate-400 hover:text-[#D4A381] relative z-10"><ChevronRight size={20} /></button>
            </>
          )}
        </div>
      )}

      <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Select Date">
        <div className="space-y-4">
          <input 
            type={activeTabState === 'prep' || activeTabState === 'sales' || ((activeTabState === 'schedule' || activeTabState === 'published') && activeScheduleSubTab === 'full-schedule') ? 'date' : 'month'} 
            value={activeTabState === 'prep' || activeTabState === 'sales' || ((activeTabState === 'schedule' || activeTabState === 'published') && activeScheduleSubTab === 'full-schedule') ? currentDate : getMonthStr(currentDate)} 
            onChange={e => { 
              if (e.target.value) { 
                setCurrentDate(activeTabState === 'prep' || activeTabState === 'sales' || ((activeTabState === 'schedule' || activeTabState === 'published') && activeScheduleSubTab === 'full-schedule') ? e.target.value : e.target.value + '-01'); 
                setIsDateModalOpen(false); 
              } 
            }} 
            className={T.input} 
          />
          <button onClick={() => setIsDateModalOpen(false)} className={`w-full ${T.btn}`}>Close</button>
        </div>
      </Modal>


      <Modal isOpen={isWorkspaceSwitcherOpen} onClose={closeWorkspaceSwitcher} title="Switch Workspace">
        <div className="space-y-3">
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 text-xs font-bold text-slate-300">
            One login can belong to more than one restaurant. Pick the workplace you are clocking in, scheduling, or managing right now.
          </div>
          {availableWorkspaces.map(workspace => {
            const selected = workspace.restaurantId === rId;
            return (
              <button
                key={workspace.restaurantId}
                type="button"
                data-testid={selected ? 'workspace-switcher-current-workspace' : 'workspace-switcher-workspace'}
                data-current-workspace={selected ? 'true' : 'false'}
                aria-label={selected ? `Current workspace ${safeWorkspaceName(workspace)}. Close switcher.` : `Open workspace ${safeWorkspaceName(workspace)}`}
                onClick={() => selected ? setIsWorkspaceSwitcherOpen(false) : switchWorkspace(workspace)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${selected ? 'bg-[#D4A381]/10 border-[#D4A381] text-white' : 'bg-[#12161A] border-[#2A353D] text-slate-300 hover:border-[#D4A381]'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-sm truncate">{safeWorkspaceName(workspace)}</div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 truncate">{workspace.role || 'Staff'}{workspace.isAdmin ? ' • Admin' : ''}</div>
                  </div>
                  {selected && <span className="text-[9px] font-black uppercase tracking-widest text-[#D4A381]">Current</span>}
                </div>
              </button>
            );
          })}
          <button type="button" onClick={closeWorkspaceSwitcher} className={`w-full ${T.btnAlt}`}>Close</button>
        </div>
      </Modal>

      <Modal isOpen={!!tourMode} onClose={dismissTourForNow} title={tourMode === 'manager' ? 'Manager Quick Start' : 'Employee Quick Start'}>
        {tourMode && <div className="space-y-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Step {tourStep + 1} of {activeTourSteps.length}</div>
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-4">
            <h3 className="text-xl font-black text-white">{activeTourSteps[tourStep]?.title}</h3>
            <p className="text-sm text-slate-300 font-bold mt-2 leading-relaxed">{activeTourSteps[tourStep]?.body}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTourStep(Math.max(0, tourStep - 1))} className={T.btnAlt} disabled={tourStep === 0}>Back</button>
            {tourStep < activeTourSteps.length - 1 ? <button type="button" onClick={() => setTourStep(tourStep + 1)} className={`${T.btn} flex-1`}>Next</button> : <button type="button" onClick={finishTour} className={`${T.btn} flex-1`}>Finish</button>}
          </div>
          <button type="button" onClick={dismissTourForNow} className="w-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white">Skip and don't show again</button>
        </div>}
      </Modal>

      <main className="app-content-shell flex-1 max-w-[1560px] mx-auto w-full p-2 sm:p-3 lg:p-2 xl:p-3 pb-20">
        <span
          data-testid="manager-brief-math-summary-global"
          aria-label={globalManagerBriefMathText}
          className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden whitespace-nowrap"
        >
          {globalManagerBriefMathText}
        </span>
        <AppSurfaceErrorBoundary
          key={`${activeTabState}-${liveAppUser?.restaurantId || 'no-restaurant'}`}
          resetKey={`${activeTabState}-${liveAppUser?.restaurantId || 'no-restaurant'}-${CURRENT_VERSION}-${surfaceRetryKey}`}
          onRetry={() => setSurfaceRetryKey(value => value + 1)}
        >
          <React.Suspense fallback={<RouteLoading />} >
            <React.Fragment key={`${activeTabState}-${liveAppUser?.restaurantId || 'no-restaurant'}-${surfaceRetryKey}`}>
              {renderMainContent()}
            </React.Fragment>
          </React.Suspense>
        </AppSurfaceErrorBoundary>
      </main>
      
      <div className="fixed top-20 inset-x-0 mx-auto w-full max-w-md z-50 flex flex-col gap-2 px-4 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-[#1A2126] text-white p-3 rounded-xl shadow-2xl pointer-events-auto flex items-start gap-3 border border-[#2A353D] animate-toast">
            <div className="bg-[#12161A] p-1.5 rounded-full text-[#D4A381] mt-0.5 border border-[#2A353D]"><Bell size={16} /></div>
            <div className="flex-1"><h4 className="font-bold text-sm leading-tight">{t.title}</h4><p className="text-xs text-slate-300 font-medium mt-0.5">{t.message}</p>{t.reportable && <button type="button" aria-label="Report a problem" onClick={() => openProblemReport({ title: t.title, message: t.message, category: 'Bug / Error' })} className="mt-2 text-[9px] font-black uppercase tracking-widest text-orange-300 hover:text-white">Report Problem</button>}</div>
            <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="text-slate-400 hover:text-white"><X size={16}/></button>
          </div>
        ))}
      </div>
      
      <div className="app-footer w-full flex flex-col items-center justify-center py-4 border-t z-10 mt-auto bg-[#161D22] border-[#2A353D]">
        <img src="/6139.png" alt="86 Chaos OS" className="h-6 sm:h-8 w-auto mb-1.5 rounded shadow-sm opacity-80" onError={(e) => e.target.style.display = 'none'}/>
        <span className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">Version {CURRENT_VERSION}</span>
        <span className="text-slate-600 font-bold text-[8px] tracking-widest uppercase mt-1">© 2026 Chilton App Works LLC</span>
      </div>
    </div>
  );
}
