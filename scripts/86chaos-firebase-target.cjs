'use strict';

const emulatorConfig = require('../src/core/firebase-emulator.config.json');
const LOOPBACK_RE = /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i;

function clean(value = '') { return String(value == null ? '' : value).trim(); }
function normalizeTarget(value = '') { return clean(value).toLowerCase(); }
function splitHostPort(value = '') {
  const raw = clean(value).replace(/^https?:\/\//i, '');
  if (!raw) return { host: '', port: 0 };
  const match = raw.match(/^\[([^\]]+)\]:(\d+)$/) || raw.match(/^([^:]+):(\d+)$/);
  return match ? { host: match[1], port: Number(match[2]) || 0 } : { host: raw.replace(/^\[|\]$/g, ''), port: 0 };
}
function port(env, explicitName, standardName, fallback) {
  const explicit = Number.parseInt(clean(env[explicitName]), 10);
  if (Number.isInteger(explicit) && explicit > 0 && explicit <= 65535) return explicit;
  const standard = splitHostPort(env[standardName]).port;
  if (standard) return standard;
  return fallback;
}
function targetValue(env = process.env) {
  return normalizeTarget(env[emulatorConfig.targetEnv] || env.CHAOS_FIREBASE_TARGET || env.FIREBASE_TARGET || 'live');
}
function getFirebaseTarget(env = process.env) {
  const raw = targetValue(env);
  if (!['live', 'emulator'].includes(raw)) throw new Error(`Unsupported 86 Chaos Firebase target "${raw}". Use LIVE or EMULATOR.`);
  const emulator = raw === 'emulator';
  const standardHost = splitHostPort(env.FIRESTORE_EMULATOR_HOST).host;
  const host = clean(env.REACT_APP_86CHAOS_FIREBASE_EMULATOR_HOST || standardHost || emulatorConfig.defaultHost);
  if (emulator && !LOOPBACK_RE.test(host)) throw new Error(`86 Chaos emulator mode refuses non-loopback Firebase host "${host}".`);
  return {
    target: emulator ? 'EMULATOR' : 'LIVE',
    emulator,
    projectId: emulator ? emulatorConfig.projectId : clean(env.REACT_APP_TEST_FIREBASE_PROJECT_ID || emulatorConfig.liveTestingProjectId),
    host,
    ports: {
      firestore: port(env, 'REACT_APP_86CHAOS_FIRESTORE_EMULATOR_PORT', 'FIRESTORE_EMULATOR_HOST', emulatorConfig.ports.firestore),
      auth: port(env, 'REACT_APP_86CHAOS_AUTH_EMULATOR_PORT', 'FIREBASE_AUTH_EMULATOR_HOST', emulatorConfig.ports.auth),
      functions: port(env, 'REACT_APP_86CHAOS_FUNCTIONS_EMULATOR_PORT', 'FUNCTIONS_EMULATOR_HOST', emulatorConfig.ports.functions),
      database: port(env, 'REACT_APP_86CHAOS_DATABASE_EMULATOR_PORT', 'FIREBASE_DATABASE_EMULATOR_HOST', emulatorConfig.ports.database),
      storage: port(env, 'REACT_APP_86CHAOS_STORAGE_EMULATOR_PORT', 'FIREBASE_STORAGE_EMULATOR_HOST', emulatorConfig.ports.storage),
    },
  };
}
function expectedFirebaseProject(env = process.env) {
  const target = getFirebaseTarget(env);
  return target.emulator ? target.projectId : emulatorConfig.liveTestingProjectId;
}
function applyFirebaseEmulatorEnv(env = process.env) {
  const target = getFirebaseTarget(env);
  if (!target.emulator) return target;
  const hp = (portNumber) => `${target.host}:${portNumber}`;
  env.GCLOUD_PROJECT = target.projectId;
  env.GOOGLE_CLOUD_PROJECT = target.projectId;
  env.FIREBASE_PROJECT_ID = target.projectId;
  env.FIREBASE_ACTIVE_PROJECT_ID = target.projectId;
  env.FIREBASE_TEST_PROJECT_ID = target.projectId;
  env.REACT_APP_FIREBASE_PROJECT_ID = target.projectId;
  env.REACT_APP_TEST_FIREBASE_PROJECT_ID = target.projectId;
  env.CHAOS_EXPECTED_TEST_FIREBASE_PROJECT_ID = target.projectId;
  env.FIRESTORE_EMULATOR_HOST = hp(target.ports.firestore);
  env.FIREBASE_AUTH_EMULATOR_HOST = hp(target.ports.auth);
  env.FIREBASE_DATABASE_EMULATOR_HOST = hp(target.ports.database);
  env.FIREBASE_STORAGE_EMULATOR_HOST = hp(target.ports.storage);
  env.STORAGE_EMULATOR_HOST = `http://${hp(target.ports.storage)}`;
  env.FUNCTIONS_EMULATOR_HOST = hp(target.ports.functions);
  env.CHAOS_ALLOW_LOCAL_UI_ONLY = 'true';
  env.FIREBASE_DEPLOYMENT_MODE = 'testing';
  return target;
}
function firebaseAuthRestUrl(apiKey = 'demo-api-key', action = 'signInWithPassword', env = process.env) {
  const target = getFirebaseTarget(env);
  const root = target.emulator
    ? `http://${target.host}:${target.ports.auth}/identitytoolkit.googleapis.com/v1`
    : 'https://identitytoolkit.googleapis.com/v1';
  return `${root}/accounts:${action}?key=${encodeURIComponent(apiKey || 'demo-api-key')}`;
}
function firestoreRestOrigin(env = process.env) {
  const target = getFirebaseTarget(env);
  return target.emulator ? `http://${target.host}:${target.ports.firestore}` : 'https://firestore.googleapis.com';
}
function storageRestOrigin(env = process.env) {
  const target = getFirebaseTarget(env);
  return target.emulator ? `http://${target.host}:${target.ports.storage}` : 'https://firebasestorage.googleapis.com';
}
module.exports = { emulatorConfig, LOOPBACK_RE, getFirebaseTarget, expectedFirebaseProject, applyFirebaseEmulatorEnv, firebaseAuthRestUrl, firestoreRestOrigin, storageRestOrigin };
