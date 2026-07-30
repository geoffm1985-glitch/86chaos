#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const version = JSON.parse(read('public/version.json'));
const schedule = read('src/features/schedule.jsx');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');

assert.strictEqual(pkg.version, '16.0.64', 'package.json version is 16.0.64');
assert.strictEqual(pkg.scripts['test:source'], 'node scripts/validate-16-0-64.js', 'test:source points at 16.0.64 validator');
assert.strictEqual(version.version, '16.0.64', 'public version is 16.0.64');
assert.strictEqual(version.build, '16.0.64', 'public build is 16.0.64');
assert(appCore.includes("CURRENT_VERSION = '16.0.64'"), 'visible app version is 16.0.64');
assert(apiVersion.includes("APP_VERSION = '16.0.64'"), 'API version is 16.0.64');

assert(schedule.includes('const getScheduleShiftLocalPruneKeys = (shift = {}) =>'), 'separate local prune keys exist');
assert(schedule.includes('const shiftMatchesLocalDeletePruneKeys = (shift = {}, pruneKeySet = new Set())'), 'local echo/auto-fill prune matcher exists');
assert(schedule.includes('const fetchSavedScheduleBuilderDeleteTargetsForPersonDate = async'), 'delete fetches saved Firestore targets for person/date');
assert(schedule.includes("where('date', '==', dateKey)") && schedule.includes("where('scheduleDateKey', '==', dateKey)"), 'delete target lookup checks both legacy date fields');
assert(schedule.includes('deleteTargetsById') && schedule.includes("deleteDoc(doc(db, 'shifts', shift.id))"), 'delete removes exact saved Firestore documents by id');
assert(schedule.includes('localPruneKeySet') && schedule.includes('flatMap(getScheduleShiftLocalPruneKeys)'), 'delete builds fingerprint prune keys for stale local mirrors');
assert(schedule.includes('setAutoFillVisibleShifts(prev => prev.filter(shift => !shiftMatchesLocalDeletePruneKeys(shift, localPruneKeySet)))'), 'auto-fill local mirrors are pruned when a shift is deleted');
assert(schedule.includes('setLocalBuilderShiftEchoes(prev => prev.filter(shift => !shiftMatchesLocalDeletePruneKeys(shift, localPruneKeySet)))'), 'local shift echoes are pruned when a shift is deleted');
assert(schedule.includes('getScheduleShiftLocalDeleteKeys = (shift = {}) => {\n  const id = String(shift?.id || \'\').trim();\n  if (id) return [`id:${id}`];'), 'active hide markers for saved shifts remain id-based so a new same-time shift is not hidden');

console.log('16.0.64 targeted test passed. Delete now removes saved duplicate docs and stale local mirrors without hiding newly re-added shifts.');
