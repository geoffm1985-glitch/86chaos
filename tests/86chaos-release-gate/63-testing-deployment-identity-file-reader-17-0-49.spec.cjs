'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '../..');

test('17.0.49 testing deployment identity wait is ARG_MAX-safe', async () => {
  const pkg = require('../../package.json');
  expect(pkg.version).toMatch(/^17\.0\.\d+$/);

  const workflow = fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8');
  expect(workflow).toContain('curl --fail --silent --show-error -o "$identity_file"');
  expect(workflow).toContain('node scripts/ci/read-deployment-identity.cjs commit "$identity_file"');
  expect(workflow).toContain('node scripts/ci/read-deployment-identity.cjs version "$version_file"');
  expect(workflow).not.toContain('JSON.parse(process.argv[1])');

  const temp = path.join(os.tmpdir(), `86chaos-17-0-49-large-identity-${process.pid}.json`);
  try {
    fs.writeFileSync(temp, JSON.stringify({ gitCommit: 'large-payload-ok', padding: 'x'.repeat(1024 * 1024) }));
    const result = cp.spawnSync(process.execPath, ['scripts/ci/read-deployment-identity.cjs', 'commit', temp], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('large-payload-ok');
  } finally {
    fs.rmSync(temp, { force: true });
  }
});
