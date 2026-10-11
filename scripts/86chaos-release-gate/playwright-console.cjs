'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const cli = path.resolve(__dirname, '../../node_modules/@playwright/test/cli.js');
// Merge stderr before PowerShell receives it, retaining warnings without the
// misleading red NativeCommandError wrapper produced by Windows PowerShell.
const child = spawn(process.execPath, [cli, 'test', ...process.argv.slice(2)], {
  stdio: ['inherit', 'inherit', 1],
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: undefined },
  windowsHide: true,
});
child.on('error', error => { console.log(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
