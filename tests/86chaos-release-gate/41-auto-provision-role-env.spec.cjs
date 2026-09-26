const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const runner = fs.readFileSync(path.join(root, 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'), 'utf8');

test.describe('41 auto-provision role environment safety', () => {
  test('full gate bootstraps testing-only role pairs before preflight without exposing passwords', async ({}, testInfo) => {
    const autoFlag = runner.indexOf('CHAOS_QA_AUTO_PROVISION_TEST_USERS = "true"');
    const initCall = runner.indexOf('Initialize-AutoProvisionRoleAccounts', autoFlag);
    const preflight = runner.indexOf('Run-Step "Environment preflight"');
    const evidence = {
      autoProvisionEnabled: autoFlag >= 0,
      bootstrapAfterEnablement: initCall > autoFlag,
      bootstrapBeforePreflight: preflight > initCall,
      cryptographicPassword: /RandomNumberGenerator\]::Create\(\)/.test(runner),
      partialPairFailsClosed: /\$emailPresent -ne \$passwordPresent/.test(runner) && /Auto-provision refuses a partial QA role credential pair/.test(runner),
      testingBranchStamp: /20260925-0619/.test(runner),
      experimentalBranchStamp: /20260925-0620/.test(runner),
      safeEmailShape: /86chaos\.qa\.\$\(\$role\.Slug\)\.\$stamp@example\.test/.test(runner),
      passwordStoredOnlyInProcessEnv: /SetEnvironmentVariable\(\$role\.Password, \(New-ReleaseGateQaPassword\), 'Process'\)/.test(runner),
    };
    const helperStart = runner.indexOf('function New-ReleaseGateQaPassword');
    const helperEnd = runner.indexOf('function Import-EnvFile', helperStart);
    const helperAndBootstrap = runner.slice(helperStart, helperEnd);
    evidence.passwordNotLogged = !/Write-(Host|Output)[^\r\n]*(password|Password|\$password)/.test(helperAndBootstrap);
    await testInfo.attach('41-auto-provision-role-env.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
    expect(Object.entries(evidence).filter(([, ok]) => !ok)).toEqual([]);
  });
});
