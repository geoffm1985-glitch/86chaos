#!/usr/bin/env node
const { execFileSync } = require('child_process');
const path = require('path');
const readline = require('readline');
const { durationToSeconds: normalizeRetentionSeconds, databaseResourceFromSchedule: scheduleDbResource, scheduleRetentionSeconds, scheduleIsDaily: isDaily } = require('../api/_backup-logic');
const ALLOWED_PROJECTS = new Set(['chaos-test-d1601','cheers-34b8d']);
function arg(name, fallback='') {
  const eq = `--${name}=`; const eqValue = process.argv.find(x => x.startsWith(eq)); if (eqValue) return eqValue.slice(eq.length);
  const idx = process.argv.indexOf(`--${name}`); if (idx >= 0 && process.argv[idx+1] && !process.argv[idx+1].startsWith('--')) return process.argv[idx+1];
  return fallback;
}
function firebaseBin() {
  const isWin = process.platform === 'win32';
  return path.resolve(__dirname, '..', 'node_modules', '.bin', isWin ? 'firebase.cmd' : 'firebase');
}
function run(args) { return execFileSync(firebaseBin(), args, { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim(); }
function runHelp() { return execFileSync(firebaseBin(), ['--help'], { encoding:'utf8', stdio:['ignore','pipe','pipe'] }); }
function ask(q){ const rl=readline.createInterface({input:process.stdin,output:process.stdout}); return new Promise(resolve=>rl.question(q,a=>{rl.close();resolve(a);})); }
function parseJsonMaybe(text){ try { return JSON.parse(text); } catch { return { raw: text }; } }
function rowsFromList(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.backupSchedules)) return parsed.backupSchedules;
  if (Array.isArray(parsed?.result)) return parsed.result;
  if (Array.isArray(parsed?.schedules)) return parsed.schedules;
  return [];
}
function matchingDailySchedules(parsed, project, database) {
  const exact = `projects/${project}/databases/${database}`;
  return rowsFromList(parsed).filter(row => scheduleDbResource(row) === exact && isDaily(row));
}
(async()=>{
  const project=arg('project', process.env.FIREBASE_PROJECT_ID || '');
  const database=arg('database','(default)');
  const recurrence=String(arg('recurrence','DAILY')).toUpperCase();
  const retention=arg('retention','30d');
  const dryRun=process.argv.includes('--dry-run');
  if (!project || !ALLOWED_PROJECTS.has(project)) throw new Error(`Refusing unknown Firebase project "${project}".`);
  if (!database) throw new Error('Database ID is required. Use --database="(default)" only when that is the intended database.');
  if (recurrence !== 'DAILY') throw new Error('Only DAILY native backup schedules are supported by this release setup.');
  const expectedSeconds = normalizeRetentionSeconds(retention);
  if (!Number.isFinite(expectedSeconds) || expectedSeconds <= 0) throw new Error(`Invalid retention value: ${retention}`);
  if (project === 'cheers-34b8d' && !dryRun) {
    const answer = await ask('Type CREATE NATIVE BACKUP FOR PRODUCTION to continue: ');
    if (answer !== 'CREATE NATIVE BACKUP FOR PRODUCTION') throw new Error('Production confirmation failed. No changes made.');
  }
  const help = runHelp();
  const createCommand = help.includes('firestore:backups:schedules:create') ? 'firestore:backups:schedules:create' : '';
  const listCommand = help.includes('firestore:backups:schedules:list') ? 'firestore:backups:schedules:list' : '';
  if (!createCommand || !listCommand) throw new Error('Pinned firebase-tools does not expose Firestore backup schedule commands. Upgrade firebase-tools intentionally and regenerate package-lock.');
  const listArgs=[listCommand,'--database',database,'--project',project,'--json'];
  const createArgs=[createCommand,'--database',database,'--recurrence',recurrence,'--retention',retention,'--project',project,'--json'];
  const before = parseJsonMaybe(run(listArgs));
  const matches = matchingDailySchedules(before, project, database);
  const conflicting = matches.filter(row => scheduleRetentionSeconds(row) !== expectedSeconds);
  if (matches.length > 1) throw new Error(`Multiple daily native backup schedules exist for ${project}/${database}: ${matches.map(r=>r.name||r.id||'unknown').join(', ')}`);
  if (conflicting.length) throw new Error(`Existing daily schedule retention does not match ${retention}: ${JSON.stringify(conflicting)}`);
  if (matches.length === 1) {
    console.log(JSON.stringify({ok:true,dryRun,created:false,verified:true,project,database,recurrence,retentionSeconds:expectedSeconds,scheduleName:matches[0].name||matches[0].id||'',schedule:matches[0]}, null, 2));
    return;
  }
  console.log(JSON.stringify({ok:true,dryRun,willCreate:true,project,database,recurrence,retentionSeconds:expectedSeconds,createCommand:`${firebaseBin()} ${createArgs.join(' ')}`}, null, 2));
  if (dryRun) {
    // Dry run proves exactly what would be created without requiring the schedule to exist afterward.
    return;
  }
  run(createArgs);
  const after = parseJsonMaybe(run(listArgs));
  const afterMatches = matchingDailySchedules(after, project, database);
  if (afterMatches.length !== 1) throw new Error(`Could not verify exactly one DAILY backup schedule after create. Found ${afterMatches.length}.`);
  const row = afterMatches[0];
  if (scheduleRetentionSeconds(row) !== expectedSeconds) throw new Error('Verified backup schedule retention did not match requested policy.');
  console.log(JSON.stringify({ok:true,dryRun,created:!dryRun,verified:true,project,database,recurrence,retentionSeconds:expectedSeconds,scheduleName:row.name||row.id||'',schedule:row}, null, 2));
})().catch(err=>{ console.error(JSON.stringify({ok:false,error:err.message},null,2)); process.exit(1); });
