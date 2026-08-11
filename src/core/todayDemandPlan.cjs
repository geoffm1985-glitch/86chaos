'use strict';
const BASELINE_16_0_189_TODAY = Object.freeze({ users: 48, shifts: 48, timeOff: 20, events: 20, timePunches: 18, inventory: 32, maintenance: 8, prep: 40, tasks: 32, restaurantAdminAlerts: 8, opsIntelligenceReports: 3 });
const CANDIDATE_16_0_190_TODAY = Object.freeze({ users: 48, shifts: 48, timeOff: 20, events: 20, timePunches: 18, inventory: 32, maintenance: 8, prep: 40, tasks: 32, restaurantAdminAlerts: 8, opsIntelligenceReports: 3 });
const TODAY_CACHE_SCOPE = 'today-brief';
function totalDocs(row = {}) { return Object.values(row).reduce((sum, value) => sum + (Number(value) || 0), 0); }
function buildTodayDemandPlan({ cacheHit = false, manualRefresh = false } = {}) {
  const snapshotRequests = Object.keys(CANDIDATE_16_0_190_TODAY).length;
  return {
    baseline: BASELINE_16_0_189_TODAY,
    candidate: CANDIDATE_16_0_190_TODAY,
    baselineMaxInitialDocs: totalDocs(BASELINE_16_0_189_TODAY),
    candidateMaxInitialDocs: cacheHit && !manualRefresh ? 0 : totalDocs(CANDIDATE_16_0_190_TODAY),
    activeListeners: 0,
    snapshotRequests: cacheHit && !manualRefresh ? 0 : snapshotRequests,
    cacheHit: cacheHit === true && manualRefresh !== true,
    manualRefreshBypassesCache: manualRefresh === true,
    cacheScope: TODAY_CACHE_SCOPE,
    scopedRefresh: {
      invalidatesScope: TODAY_CACHE_SCOPE,
      nonTodayCacheInvalidations: 0,
      ttlMs: 45000,
      usesRefreshKey: true
    },
    rationale: {
      shifts: 'today plus near-future coverage only',
      timePunches: 'active/recent operational window only',
      restaurantAdminAlerts: 'latest few owner/admin alerts on Today, not the back-office queue size',
      opsIntelligenceReports: 'latest three operational-intelligence rows by snapshot, not a live listener',
      maintenance: 'unresolved/high-attention summary rows only where schema permits',
      prep: 'today/master outstanding summary demand',
      inventory: 'bounded summary because below-par is derived in current client schema without a safe index',
      refreshBrief: 'manual refresh invalidates only the today-brief cache scope and keeps Schedule/Team caches reusable'
    }
  };
}
module.exports = { BASELINE_16_0_189_TODAY, CANDIDATE_16_0_190_TODAY, TODAY_CACHE_SCOPE, totalDocs, buildTodayDemandPlan };
