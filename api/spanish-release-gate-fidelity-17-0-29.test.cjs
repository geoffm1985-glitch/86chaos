'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.29 Spanish browser gate verifies visible translated Preferences text instead of the English accessibility name', () => {
  const spec = read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');
  assert.doesNotMatch(spec, /getByRole\(['\"]button['\"],\s*\{\s*name:\s*\/preferencias\/i\s*\}\)/);
  assert.match(spec, /button\.settings-tab-button/);
  assert.match(spec, /hasText:\s*\/\^Preferencias\$\/i/);
});

test('17.0.29 Spanish browser gate remains behaviorally strict after the locator fidelity repair', () => {
  const spec = read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');
  assert.match(spec, /toHaveAttribute\(['\"]lang['\"],\s*['\"]es['\"]/);
  assert.match(spec, /Reloj y horario/);
  assert.match(spec, /Preparación y tareas/);
  assert.match(spec, /Configuración/);
  assert.match(spec, /Mi horario/);
  assert.match(spec, /Pedir libre/);
  assert.match(spec, /FICHAR \(ENTRADA\|SALIDA\)/);
  assert.match(spec, /Control de línea/);
  assert.match(spec, /Resumen del gerente/);
  assert.match(spec, /selectOption\(['\"]es['\"]\)/);
});

test('17.0.29 Settings implementation still renders Preferences through the i18n key', () => {
  const management = read('src/features/management.jsx');
  const i18n = read('src/core/i18n.js');
  assert.match(management, /tab === ['\"]preferences['\"] \? t\(['\"]settings\.preferences['\"]\)/);
  assert.match(i18n, /['\"]settings\.preferences['\"]:\s*['\"]Preferencias['\"]/);
  assert.match(management, /data-testid=['\"]app-language-select['\"]/);
});
