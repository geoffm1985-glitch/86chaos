#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const localOnly = args.has('--local-only');
const requireBrowser = args.has('--require-browser');
const manifestPath = path.join(root, 'scripts/repair-regression-pack-16.0.202.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
function expand(cmd) {
  if (!cmd.includes('tests/86chaos-release-gate/*.test.cjs')) return cmd;
  const files = fs.readdirSync(path.join(root, 'tests/86chaos-release-gate')).filter(f => f.endsWith('.test.cjs')).sort().map(f => `tests/86chaos-release-gate/${f}`);
  return cmd.flatMap(part => part === 'tests/86chaos-release-gate/*.test.cjs' ? files : [part]);
}
function run(entry) {
  const cmd = entry.expandGlob ? expand(entry.cmd) : entry.cmd;
  console.log(`\n[${entry.group}] ${cmd.join(' ')}`);
  const result = spawnSync(cmd[0], cmd.slice(1), { cwd: root, stdio: 'inherit', shell: false, env: process.env });
  return { group: entry.group, status: result.status ?? 1 };
}
console.log('86 CHAOS REPAIR REGRESSION PACK');
console.log(`Release: ${manifest.version}`);
console.log('\nLOCAL TEST GROUPS:');
manifest.localCommands.forEach((entry, index) => console.log(`${index + 1}. ${entry.group}`));
console.log(`\nTOTAL LOCAL COMMANDS: ${manifest.localCommands.length}`);
let pass = 0, fail = 0;
const groups = [];
for (const entry of manifest.localCommands) {
  const result = run(entry);
  groups.push(result);
  if (result.status === 0) pass += 1;
  else { fail += 1; console.error(`\nREPAIR REGRESSION PACK FAILED: ${entry.group}`); break; }
}
let browser = { selected: 0, pass: 0, fail: 0, timeout: 0, skip: 0, notRun: true };
if (fail === 0 && !localOnly) {
  const browserArgs = requireBrowser ? ['--required'] : [];
  const result = spawnSync(process.execPath, ['scripts/run-repair-browser-regression.cjs', ...browserArgs], { cwd: root, stdio: 'inherit', shell: false, env: process.env });
  if (result.status === 0) browser.notRun = true;
  else if (requireBrowser) { fail += 1; browser.fail = 1; }
}
console.log('\n86 CHAOS REPAIR REGRESSION SUMMARY');
console.log(`VERSION: ${manifest.version}`);
console.log(`LOCAL:\nPASS: ${pass}\nFAIL: ${fail}\nSKIP: 0\nBLOCKED: 0`);
console.log(`BROWSER:\nSELECTED: ${browser.selected}\nPASS: ${browser.pass}\nFAIL: ${browser.fail}\nTIMEOUT: ${browser.timeout}\nSKIP: ${browser.skip}\nNOT RUN: ${browser.notRun ? 'yes' : 'no'}`);
console.log('\nGROUPS:');
for (const g of groups) console.log(`${g.group}: ${g.status === 0 ? 'PASS' : 'FAIL'}`);
console.log(`\nOVERALL:\n${fail === 0 ? 'PASS' : 'FAIL'}`);
process.exit(fail === 0 ? 0 : 1);
