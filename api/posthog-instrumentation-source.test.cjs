const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('PostHog client is environment gated and privacy guarded', () => {
  const client = read('src/core/posthogClient.js');
  assert.match(client, /REACT_APP_POSTHOG_KEY/);
  assert.match(client, /REACT_APP_POSTHOG_HOST/);
  assert.match(client, /REACT_APP_DISABLE_POSTHOG/);
  assert.match(client, /autocapture:\s*false/);
  assert.match(client, /disable_session_recording:\s*true/);
  assert.match(client, /respect_dnt:\s*true/);
  assert.match(client, /sanitize_properties/);
  assert.match(client, /identifyChaosPostHogUser/);
  assert.match(client, /trackChaosPageView/);
  assert.match(client, /trackChaosRuntimeError/);
  assert.doesNotMatch(client, /posthog\.identify\([^,]+,\s*\{[^}]*email/i);
});

test('App wires PostHog to identity, page views, runtime errors, and logout reset', () => {
  const app = read('src/App.js');
  assert.match(app, /initChaosPostHog\(\{ appVersion: CURRENT_VERSION \}\)/);
  assert.match(app, /identifyChaosPostHogUser\(liveAppUser/);
  assert.match(app, /trackChaosPageView\(activeTabState/);
  assert.match(app, /trackChaosRuntimeError\(error/);
  assert.match(read('src/core/appCore.js'), /__chaosPostHogRuntimeError\?\.\(payload\.error \|\| payload\.reason \|\| message/);
  assert.match(app, /trackChaosPostHogEvent\('86chaos_problem_report_submitted'/);
  assert.match(app, /resetChaosPostHogIdentity\(\)/);
});

test('Vercel CSP allows PostHog SDK and capture endpoints', () => {
  const vercel = read('vercel.json');
  assert.match(vercel, /script-src[^;]*https:\/\/\*\.posthog\.com/);
  assert.match(vercel, /script-src-elem[^;]*https:\/\/\*\.posthog\.com/);
  assert.match(vercel, /connect-src[^;]*https:\/\/\*\.posthog\.com/);
  assert.match(vercel, /worker-src[^;]*blob:\s*data:/);
});

test('Server bug reports forward sanitized events to PostHog without blocking reports', () => {
  const helper = read('api/_posthog-server.js');
  const reportBug = read('api/report-bug.js');
  assert.match(helper, /POSTHOG_PROJECT_API_KEY/);
  assert.match(helper, /POSTHOG_HOST/);
  assert.match(helper, /\/i\/v0\/e\//);
  assert.match(helper, /redactSensitive/);
  assert.match(reportBug, /capturePostHogEvent/);
  assert.match(reportBug, /86chaos_api_crash_report_saved/);
  assert.match(reportBug, /86chaos_problem_report_saved/);
  assert.match(reportBug, /postHogAccepted/);
});
