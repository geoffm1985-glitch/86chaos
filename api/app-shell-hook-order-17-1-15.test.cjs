'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.1.15 keeps every App hook above conditional auth/session returns', () => {
  const app = read('src/App.js');
  const hook = app.indexOf('const openVoiceFromShell = useCallback(() => {');
  const labelsReturn = app.indexOf('if (labelsToPrint) return');
  const hydrationReturn = app.indexOf('if (cachedSessionAccessHydrating) {');
  const loginReturn = app.indexOf('if (!liveAppUser) return <I18nProvider');

  assert.ok(hook > 0, 'shared 86Voice shell callback exists');
  assert.ok(labelsReturn > hook, '86Voice hook is declared before label-print early return');
  assert.ok(hydrationReturn > hook, '86Voice hook is declared before cached-session hydration early return');
  assert.ok(loginReturn > hook, '86Voice hook is declared before signed-out LoginScreen early return');
  assert.equal((app.match(/const openVoiceFromShell = useCallback\(/g) || []).length, 1, 'only one shell voice hook exists');

  const afterFirstAppReturn = app.slice(labelsReturn);
  assert.doesNotMatch(afterFirstAppReturn, /\buse(?:State|Effect|Memo|Callback|Ref|Reducer|Context|LayoutEffect|DeferredValue|ImperativeHandle)\s*\(/, 'no App hooks appear after the first conditional App return');
});

test('17.1.15 keeps the shared 86Voice controller wired into the live shell', () => {
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  assert.match(app, /import \{[^}]*DrawerMenu[^}]*\} from '\.\/components\/common';/);
  assert.match(app, /<Concept17MobileNav[\s\S]*onVoice=\{openVoiceFromShell\}/);
  assert.match(shell, /data-testid="concept17-mobile-voice-button"/);
  assert.match(shell, /onPointerDown=\{activateVoiceFromPointer\}/);
  assert.match(shell, /onClick=\{activateVoiceFromClick\}/);
});

test('17.1.15 preserves the approved redesign and Vercel-safe reference image repair', () => {
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  const css = read('src/concept17.css');
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^17\.1\./);
  assert.match(app, /data-testid="concept17-command-header"/);
  assert.match(shell, /data-testid="concept17-desktop-sidebar"/);
  assert.match(shell, /data-testid="concept17-mobile-bottom-nav"/);
  assert.ok((css.match(/var\(--c17-ref-kitchen-image\)/g) || []).length >= 3);
  assert.doesNotMatch(css, /url\(['"]\/concept17-kitchen-reference\.jpg['"]\)/);
  for (const route of ['today','ops','prep','inventory','recipes','team','published','financials','messages','godmode','settings','help']) {
    assert.ok(app.includes(`{ id: '${route}',`) || shell.includes(`${route}:`) || shell.includes(`'${route}':`), `${route} remains routed`);
  }
});
