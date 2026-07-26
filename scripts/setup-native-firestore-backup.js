#!/usr/bin/env node
/*
  Safe helper for creating/verifying Firebase native Firestore daily backups.
  This script does not create credentials, does not read .env secrets, and refuses unknown projects.
*/
const { execFileSync } = require('child_process');
const readline = require('readline');

const ALLOWED_PROJECTS = new Set([
  'chaos-test-d1601',
  'cheers-34b8d'
]);

function arg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find(v => v.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}
function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

(async () => {
  const project = arg('project', process.env.FIREBASE_PROJECT_ID || '');
  const location = arg('location', 'nam5');
  const retentionDays = arg('retention-days', '30');
  const schedule = arg('schedule', '0 9 * * *');
  const dryRun = process.argv.includes('--dry-run');
  if (!project || !ALLOWED_PROJECTS.has(project)) {
    throw new Error(`Refusing unknown Firebase project "${project}". Allowed projects: ${[...ALLOWED_PROJECTS].join(', ')}`);
  }
  if (project === 'cheers-34b8d') {
    const answer = await ask('Type CREATE NATIVE BACKUP FOR PRODUCTION to continue: ');
    if (answer !== 'CREATE NATIVE BACKUP FOR PRODUCTION') throw new Error('Production confirmation failed. No changes made.');
  }
  const command = ['firestore', 'backups', 'schedules', 'create', '--project', project, '--location', location, '--recurrence', 'DAILY', '--retention', `${retentionDays}d`];
  console.log(JSON.stringify({ ok: true, dryRun, project, location, schedule, retentionDays, command: `firebase ${command.join(' ')}` }, null, 2));
  if (!dryRun) {
    run('firebase', command);
  }
  const listArgs = ['firestore', 'backups', 'schedules', 'list', '--project', project, '--location', location, '--json'];
  const verification = dryRun ? 'dry-run-not-queried' : run('firebase', listArgs);
  console.log(JSON.stringify({ ok: true, verified: !dryRun, project, location, retentionDays, backupScheduleId: 'see firebase schedules list output', verification }, null, 2));
})().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
