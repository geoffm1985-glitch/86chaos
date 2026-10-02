import emulatorConfig from '../../firebase-emulator.config.json';

const normalizeTarget = (value = '') => String(value || '').trim().toLowerCase();
const env = (key, fallback = '') => process.env[key] || fallback;
const LOCAL_HOST_RE = /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i;

const rawTarget = normalizeTarget(env(emulatorConfig.targetEnv, 'live'));
if (!['live', 'emulator'].includes(rawTarget)) throw new Error(`Unsupported 86 Chaos Firebase target "${rawTarget}". Use LIVE or EMULATOR.`);
export const firebaseRuntimeTarget = rawTarget === 'emulator' ? 'EMULATOR' : 'LIVE';
export const isFirebaseEmulatorTarget = firebaseRuntimeTarget === 'EMULATOR';

const parsePort = (name, fallback) => {
  const parsed = Number.parseInt(env(name, String(fallback)), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error(`Invalid ${name} emulator port.`);
  return parsed;
};
const configuredHost = String(env('REACT_APP_86CHAOS_FIREBASE_EMULATOR_HOST', emulatorConfig.defaultHost) || '').trim();
if (isFirebaseEmulatorTarget && !LOCAL_HOST_RE.test(configuredHost)) throw new Error(`86 Chaos emulator mode refuses non-loopback Firebase host "${configuredHost}".`);

export const firebaseEmulatorSettings = Object.freeze({
  projectId: emulatorConfig.projectId,
  host: configuredHost || emulatorConfig.defaultHost,
  firestorePort: parsePort('REACT_APP_86CHAOS_FIRESTORE_EMULATOR_PORT', emulatorConfig.ports.firestore),
  authPort: parsePort('REACT_APP_86CHAOS_AUTH_EMULATOR_PORT', emulatorConfig.ports.auth),
  functionsPort: parsePort('REACT_APP_86CHAOS_FUNCTIONS_EMULATOR_PORT', emulatorConfig.ports.functions),
  databasePort: parsePort('REACT_APP_86CHAOS_DATABASE_EMULATOR_PORT', emulatorConfig.ports.database),
  storagePort: parsePort('REACT_APP_86CHAOS_STORAGE_EMULATOR_PORT', emulatorConfig.ports.storage),
});

export function assertFirebaseEmulatorBrowserHost(hostname = '') {
  if (!isFirebaseEmulatorTarget) return true;
  const clean = String(hostname || '').trim();
  if (!LOCAL_HOST_RE.test(clean)) throw new Error(`86 Chaos emulator mode is local-only. Browser host "${clean || '(missing)'}" is not allowed.`);
  return true;
}
const probe = async (name, port, timeoutMs = 3500) => {
  if (typeof fetch !== 'function') return { name, skipped: true };
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    await fetch(`http://${firebaseEmulatorSettings.host}:${port}/`, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: controller?.signal });
    return { name, ok: true };
  } catch (error) {
    throw new Error(`Firebase ${name} emulator is unavailable at ${firebaseEmulatorSettings.host}:${port}. Emulator mode is fail-closed and will not fall back to live Firebase. ${error?.message || error}`);
  } finally { if (timer) clearTimeout(timer); }
};
export async function verifyFirebaseEmulatorAvailability() {
  if (!isFirebaseEmulatorTarget || typeof window === 'undefined') return { ok: true, target: firebaseRuntimeTarget, services: [] };
  const services = await Promise.all([
    probe('Firestore', firebaseEmulatorSettings.firestorePort),
    probe('Authentication', firebaseEmulatorSettings.authPort),
    probe('Functions', firebaseEmulatorSettings.functionsPort),
    probe('Realtime Database', firebaseEmulatorSettings.databasePort),
    probe('Storage', firebaseEmulatorSettings.storagePort),
  ]);
  return { ok: true, target: firebaseRuntimeTarget, projectId: firebaseEmulatorSettings.projectId, services };
}
