const POSTHOG_DEFAULT_HOST = 'https://us.i.posthog.com';
const POSTHOG_DEFAULTS_VERSION = '2026-05-30';
const MAX_PROP_TEXT = 500;

const envValue = (key, fallback = '') => {
  try { return String(process.env?.[key] || fallback || '').trim(); } catch (_) { return String(fallback || '').trim(); }
};

const posthogToken = () => envValue('REACT_APP_POSTHOG_KEY') || envValue('REACT_APP_POSTHOG_PROJECT_KEY') || envValue('REACT_APP_POSTHOG_PROJECT_API_KEY');
const posthogHost = () => envValue('REACT_APP_POSTHOG_HOST', POSTHOG_DEFAULT_HOST).replace(/\/$/, '') || POSTHOG_DEFAULT_HOST;

const flagEnabled = (value = '') => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase().trim());
const flagDisabled = (value = '') => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase().trim());

const isLocalHost = () => {
  if (typeof window === 'undefined') return false;
  const host = String(window.location?.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
};

export const getChaosPostHogStatus = () => {
  const key = posthogToken();
  const disabled = flagDisabled(envValue('REACT_APP_DISABLE_POSTHOG')) || flagDisabled(envValue('REACT_APP_POSTHOG_DISABLED'));
  const allowLocal = flagEnabled(envValue('REACT_APP_POSTHOG_CAPTURE_LOCAL'));
  const localBlocked = isLocalHost() && !allowLocal;
  return {
    configured: Boolean(key),
    enabled: Boolean(key) && !disabled && !localBlocked,
    disabled,
    localBlocked,
    host: posthogHost(),
    defaults: POSTHOG_DEFAULTS_VERSION
  };
};

const cleanText = (value, max = MAX_PROP_TEXT) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
const cleanKey = (value, fallback = 'unknown') => cleanText(value, 200).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 200) || fallback;
const cleanBool = (value) => value === true;

const redactSensitive = (value, depth = 0) => {
  if (depth > 4) return '[depth-limit]';
  if (value == null) return value;
  if (typeof value === 'string') {
    const text = cleanText(value, 1200);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return '[email]';
    if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text)) return '[phone]';
    return text;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(item => redactSensitive(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    Object.entries(value).slice(0, 60).forEach(([key, nested]) => {
      const lower = String(key || '').toLowerCase();
      if (/(email|phone|token|secret|password|credential|authorization|auth|rawstack|stack|notes?|reason|wage|pay|salary|ssn|pin)/.test(lower)) {
        out[key] = '[redacted]';
      } else {
        out[key] = redactSensitive(nested, depth + 1);
      }
    });
    return out;
  }
  return cleanText(value);
};

const installPostHogStub = (token, config) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (window.__chaosPostHogInitialized) return true;
  try {
    // Browser SDK bootstrap based on PostHog's official JavaScript snippet.
    const target = document;
    const existing = window.posthog || [];
    window.posthog = existing;
    existing._i = existing._i || [];
    existing.init = existing.init || function initPostHog(projectToken, options, instanceName) {
      const script = target.createElement('script');
      script.type = 'text/javascript';
      script.crossOrigin = 'anonymous';
      script.async = true;
      const apiHost = String(options?.api_host || POSTHOG_DEFAULT_HOST).replace(/\/$/, '');
      script.src = apiHost.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';
      const firstScript = target.getElementsByTagName('script')[0];
      firstScript?.parentNode?.insertBefore(script, firstScript);
      const queue = instanceName ? (existing[instanceName] = existing[instanceName] || []) : existing;
      queue.people = queue.people || [];
      const methods = 'init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug'.split(' ');
      methods.forEach((method) => {
        queue[method] = queue[method] || function queueMethod() { queue.push([method].concat(Array.prototype.slice.call(arguments, 0))); };
      });
      existing._i.push([projectToken, options, instanceName || 'posthog']);
    };
    window.__chaosPostHogInitialized = true;
    window.posthog.init(token, config);
    return true;
  } catch (err) {
    try { console.warn('PostHog bootstrap skipped:', err?.message || err); } catch (_) {}
    return false;
  }
};

export const initChaosPostHog = (options = {}) => {
  const status = getChaosPostHogStatus();
  if (!status.enabled) return status;
  const token = posthogToken();
  installPostHogStub(token, {
    api_host: status.host,
    defaults: POSTHOG_DEFAULTS_VERSION,
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    disable_session_recording: true,
    respect_dnt: true,
    sanitize_properties: (properties) => redactSensitive(properties),
    loaded: (posthog) => {
      try {
        posthog.register({
          app: '86chaos',
          app_version: cleanText(options.appVersion || '', 80),
          runtime: 'browser'
        });
      } catch (_) {}
    }
  });
  return status;
};

const safePostHog = () => {
  const status = getChaosPostHogStatus();
  if (!status.enabled || typeof window === 'undefined') return null;
  if (!window.__chaosPostHogInitialized) initChaosPostHog();
  return window.posthog || null;
};

export const identifyChaosPostHogUser = (user = {}, context = {}) => {
  const posthog = safePostHog();
  const uid = cleanText(context.authUid || user.authUid || user.uid || user.id || '', 200);
  if (!posthog || !uid) return false;
  const workspaceId = cleanText(context.restaurantId || user.restaurantId || user.activeRestaurantId || '', 200);
  try {
    posthog.identify(uid, redactSensitive({
      app_version: context.appVersion || '',
      role: user.role || '',
      account_role: user.accountRole || '',
      is_admin: cleanBool(user.isAdmin),
      is_owner: cleanBool(user.isOwner || user.workspaceOwner || user.accountOwner),
      is_super_admin: cleanBool(user.isSuperAdmin),
      demo_mode: cleanBool(context.isDemoMode || user.demoMode),
      has_workspace: Boolean(workspaceId)
    }));
    if (workspaceId && typeof posthog.group === 'function') {
      posthog.group('workspace', cleanKey(workspaceId, 'workspace'), redactSensitive({
        app_version: context.appVersion || '',
        plan: context.plan || context.tier || '',
        demo_mode: cleanBool(context.isDemoMode),
        workspace_known: true
      }));
    }
    return true;
  } catch (_) { return false; }
};

export const resetChaosPostHogIdentity = () => {
  const posthog = typeof window !== 'undefined' ? window.posthog : null;
  try { posthog?.reset?.(); return true; } catch (_) { return false; }
};

export const trackChaosPostHogEvent = (eventName = '', properties = {}) => {
  const posthog = safePostHog();
  const event = cleanText(eventName, 120);
  if (!posthog || !event) return false;
  try {
    posthog.capture(event, redactSensitive({
      ...properties,
      app: '86chaos',
      app_version: properties.app_version || properties.appVersion || '',
      path: typeof window !== 'undefined' ? window.location?.pathname || '' : '',
      route: typeof window !== 'undefined' ? `${window.location?.pathname || ''}${window.location?.search || ''}` : ''
    }));
    return true;
  } catch (_) { return false; }
};

export const trackChaosPageView = (tab = '', context = {}) => trackChaosPostHogEvent('$pageview', {
  tab: cleanText(tab, 120),
  active_tab: cleanText(tab, 120),
  workspace_id: context.restaurantId ? cleanKey(context.restaurantId, 'workspace') : '',
  role: context.role || '',
  is_admin: cleanBool(context.isAdmin),
  is_super_admin: cleanBool(context.isSuperAdmin),
  app_version: context.appVersion || ''
});

export const trackChaosRuntimeError = (error = {}, context = {}) => trackChaosPostHogEvent('86chaos_runtime_error', {
  category: context.category || context.kind || 'runtime',
  source: context.source || '',
  active_tab: context.activeTab || '',
  workspace_id: context.workspaceId ? cleanKey(context.workspaceId, 'workspace') : '',
  app_version: context.appVersion || '',
  error_name: cleanText(error?.name || context.errorName || 'Error', 120),
  error_message: cleanText(error?.message || context.errorMessage || error || '', 600),
  chunk_url_present: Boolean(context.chunkUrl),
  route: context.route || ''
});


if (typeof window !== 'undefined') {
  window.__chaosPostHogRuntimeError = trackChaosRuntimeError;
}
