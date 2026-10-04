'use strict';
const bridge = require('../yardmaster.firebase.json');
const { getFirebaseTarget } = require('./86chaos-firebase-target.cjs');
// Applies to every browser visiting the local app, before any script runs.
const CONNECT_POLICY = "default-src 'self'; connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://*.google.com https://www.googleapis.com; script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://*.google.com https://www.googleapis.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'none'; object-src 'none'; frame-src 'self' https://*.firebaseapp.com https://*.web.app https://accounts.google.com https://*.google.com; form-action 'self'; base-uri 'self'";

function bootstrapAcknowledgment(target, blockLiveFirebase = process.env.CHAOS_BLOCK_LIVE_FIREBASE === '1') {
  if (!target?.emulator || target.projectId !== bridge.projectId || !blockLiveFirebase) throw new Error('Yardmaster bootstrap is not pinned to demo-86chaos with live Firebase blocked.');
  return { target: 'emulator', projectId: target.projectId, blockLiveFirebase: true };
}

function connectedAcknowledgment(diagnostics, readiness, target) {
  if (!target.emulator || diagnostics?.target !== 'EMULATOR' || diagnostics.projectId !== bridge.projectId || !diagnostics.failClosed || !readiness?.ok) throw new Error('Local app SDK is not ready on demo-86chaos.');
  for (const product of bridge.products) {
    if (!diagnostics.connectedProducts?.includes(product)) throw new Error(`SDK emulator connection missing: ${product}`);
    const field = product === 'database' ? 'databasePort' : `${product}Port`;
    if (diagnostics.emulator?.host !== target.host || diagnostics.emulator[field] !== target.ports[product]) throw new Error(`SDK emulator endpoint mismatch: ${product}`);
  }
  return { ...bootstrapAcknowledgment(target, true), products: diagnostics.connectedProducts };
}

function installReadiness(app) {
  const target = getFirebaseTarget(process.env);
  if (!target.emulator) throw new Error('Yardmaster readiness cannot run against live Firebase.');
  let state = null, updated = 0, error = 'Waiting for the local application SDK.', browser, page;
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', CONNECT_POLICY);
    next();
  });
  const bootstrap = bootstrapAcknowledgment(target);
  app.get(bridge.localApp.readyPath, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (state && Date.now() - updated < 5000) res.json(state);
    else res.status(503).json({ ...bootstrap, ready: false, error });
  });
  app.get('/yardmaster-tailwind.css', (req, res) => res.sendFile(require('node:path').resolve('.cache/yardmaster-tailwind.css')));
  // Observe a real bundled browser SDK, not a constant server acknowledgment.
  // Poll in the background so Yardmaster's short HTTP readiness timeout is honored.
  const observe = async () => {
    try {
      if (!browser?.isConnected()) {
        browser = await require('@playwright/test').chromium.launch({ headless: true });
        page = await browser.newPage({ serviceWorkers: 'block' });
      }
      if (!page.url().startsWith(bridge.localApp.url)) await page.goto(bridge.localApp.url, { timeout: 10000, waitUntil: 'commit' });
      await page.waitForFunction(() => Boolean(window.__CHAOS_FIREBASE_CHECK_READY__), null, { timeout: 15000 });
      const evidence = await page.evaluate(async () => {
        if (!window.__CHAOS_FIREBASE_DIAGNOSTICS__ || !window.__CHAOS_FIREBASE_CHECK_READY__) throw new Error('Firebase SDK has not initialized.');
        await window.__CHAOS_FIREBASE_EMULATOR_READY__;
        return { diagnostics: window.__CHAOS_FIREBASE_DIAGNOSTICS__, readiness: await window.__CHAOS_FIREBASE_CHECK_READY__() };
      });
      state = connectedAcknowledgment(evidence.diagnostics, evidence.readiness, target);
      updated = Date.now();
    } catch (cause) {
      state = null;
      error = String(cause.message || cause).slice(0, 500);
      // Reload failures and repaired source; no stale successful acknowledgment.
      if (page && !page.isClosed()) await page.goto('about:blank').catch(() => {});
    }
    timer = setTimeout(observe, 1000);
    timer.unref();
  };
  let timer = setTimeout(observe, 1000);
  timer.unref();
  process.once('exit', () => { clearTimeout(timer); });
}
module.exports = { CONNECT_POLICY, bootstrapAcknowledgment, connectedAcknowledgment, installReadiness };
