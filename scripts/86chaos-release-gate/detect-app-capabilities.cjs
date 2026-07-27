#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.env.CHAOS_APP_ROOT || process.cwd();
const outDir = path.join(root, 'test-results', '86chaos-play-store-release-gate');
fs.mkdirSync(outDir, { recursive: true });
function read(rel) { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch (_) { return ''; } }
function json(rel) { try { return JSON.parse(read(rel)); } catch (_) { return {}; } }
function walk(dir, out=[]) { if (!fs.existsSync(dir)) return out; for (const e of fs.readdirSync(dir,{withFileTypes:true})) { const p=path.join(dir,e.name); if (e.isDirectory()) walk(p,out); else if (/\.(js|jsx|cjs|json)$/i.test(e.name)) out.push(p); } return out; }
const sourceFiles = walk(path.join(root,'src')).concat(walk(path.join(root,'api')));
let source=''; for (const f of sourceFiles) { try { source += '\n'+fs.readFileSync(f,'utf8'); } catch (_) {} }
const packageJson=json('package.json');
const versionJson=json('public/version.json');
const version=process.env.CHAOS_EXPECTED_VERSION || versionJson.version || packageJson.version || '';
const featurePatterns={
  today:/manager brief|need attention|tab.?today/i,
  kitchen:/kitchen command|command center/i,
  schedule:/schedule builder|tab.?schedule/i,
  published:/time clock|published schedule|my schedule/i,
  events:/event calendar|tab.?events/i,
  financials:/financials|daily close|labor|timesheet/i,
  inventory:/inventoryitems|tab.?inventory|inventory/i,
  recipes:/tab.?recipes|recipe book|recipes/i,
  prep:/prepitems|tab.?prep|line check/i,
  messages:/86 alert|message board|tab.?messages/i,
  reminders:/personalreminders|tab.?reminders/i,
  team:/staff roster|tab.?team|workspaceMembers/i,
  maintenance:/maintenancelogs|tab.?maintenance/i,
  settings:/tab.?settings|preferences/i,
  help:/help center|trainingmanual|tab.?help/i,
  godmode:/system administrator|tab.?godmode|TabGodMode/i,
  menuIntelligence:/menu intelligence|menuDependencies/i,
  aiOrderAssistant:/AI Order Assistant|aiOrderAssistant|ai_order_assistant/i,
  restaurantAiAssistants:/AI restaurant assistants|restaurant ai assistants|prep predictor|maintenance pattern/i,
  voice:/86Voice|voice-command|voice command/i,
  pwa:/serviceWorker|firebase-messaging-sw|manifest\.json/i,
  crashPipeline:/report-bug|crashReports|chunkloaderror/i,
  nativeBackup:/backupSchedules|firestore-backup-watchdog/i,
};
const features=Object.fromEntries(Object.entries(featurePatterns).map(([k,re])=>[k,re.test(source)]));
const manifest={generatedAt:new Date().toISOString(),root,version,packageVersion:packageJson.version||'',sourceFiles:sourceFiles.length,features,files:{manifest:fs.existsSync(path.join(root,'public','manifest.json')),serviceWorker:fs.existsSync(path.join(root,'public','firebase-messaging-sw.js')),rules:fs.existsSync(path.join(root,'firestore.rules')),indexes:fs.existsSync(path.join(root,'firestore.indexes.json'))}};
const out=path.join(outDir,'app-capabilities.json'); fs.writeFileSync(out,JSON.stringify(manifest,null,2)); console.log(JSON.stringify({...manifest,output:out},null,2));
