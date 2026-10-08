'use strict';

const { initializeApp: modularInitializeApp, getApps, getApp, cert, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp, GeoPoint, FieldPath } = require('firebase-admin/firestore');
const { getAppCheck } = require('firebase-admin/app-check');
const { getMessaging } = require('firebase-admin/messaging');
const { getStorage } = require('firebase-admin/storage');
const { getDatabase } = require('firebase-admin/database');

const decoratedApps = new WeakSet();
const proxyTargets = new WeakMap();

const unwrapApp = (app) => proxyTargets.get(app) || app;
const serviceFor = (getter, app) => {
  const target = unwrapApp(app);
  return target ? getter(target) : getter();
};

function makeProxy(app) {
  const proxy = new Proxy(app, {
    get(target, prop, receiver) {
      if (prop === 'auth') return () => getAuth(target);
      if (prop === 'firestore') return () => getFirestore(target);
      if (prop === 'appCheck') return () => getAppCheck(target);
      if (prop === 'messaging') return () => getMessaging(target);
      if (prop === 'storage') return () => getStorage(target);
      if (prop === 'database') return () => getDatabase(target);
      return Reflect.get(target, prop, receiver);
    }
  });
  proxyTargets.set(proxy, app);
  return proxy;
}

function decorateApp(app) {
  if (!app || decoratedApps.has(app)) return app;
  const services = {
    auth: () => getAuth(app),
    firestore: () => getFirestore(app),
    appCheck: () => getAppCheck(app),
    messaging: () => getMessaging(app),
    storage: () => getStorage(app),
    database: () => getDatabase(app)
  };
  if (Object.isExtensible(app)) {
    for (const [name, fn] of Object.entries(services)) {
      if (typeof app[name] !== 'function') {
        Object.defineProperty(app, name, { value: fn, configurable: true, enumerable: false, writable: false });
      }
    }
    decoratedApps.add(app);
    return app;
  }
  return makeProxy(app);
}

function initializeApp(options, name) {
  return decorateApp(modularInitializeApp(options, name));
}

function app(name) {
  return decorateApp(getApp(name));
}

const firestore = Object.assign(
  (appInstance) => serviceFor(getFirestore, appInstance),
  { FieldValue, Timestamp, GeoPoint, FieldPath }
);

const compat = {
  initializeApp,
  app,
  credential: { cert, applicationDefault },
  auth: (appInstance) => serviceFor(getAuth, appInstance),
  firestore,
  appCheck: (appInstance) => serviceFor(getAppCheck, appInstance),
  messaging: (appInstance) => serviceFor(getMessaging, appInstance),
  storage: (appInstance) => serviceFor(getStorage, appInstance),
  database: (appInstance) => serviceFor(getDatabase, appInstance)
};

Object.defineProperty(compat, 'apps', {
  enumerable: true,
  get: () => getApps().map(decorateApp)
});

module.exports = compat;
