'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = path.resolve(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
function objectBody(source,name) {
  const start = source.indexOf(`export const ${name} = {`);
  if(start < 0) throw new Error(`Missing authoritative ${name}`);
  return source.slice(start,source.indexOf('\n};',start)+3);
}
function inventory(directory = root) {
  const plans = fs.readFileSync(path.join(directory,'src/config/plans.js'),'utf8');
  const features = [...objectBody(plans,'FEATURE_KEYS').matchAll(/^\s+([A-Z][A-Z0-9_]*): '([^']+)'/gm)].map(m=>({key:m[1],id:m[2]}));
  const routes = [...objectBody(plans,'ROUTE_FEATURES').matchAll(/^\s+(?:'([^']+)'|([\w-]+)): FEATURE_KEYS\.([A-Z0-9_]+)/gm)].map(m=>({route:m[1]||m[2],feature:m[3]}));
  const labels = new Map([...objectBody(plans,'FEATURE_LABELS').matchAll(/\[FEATURE_KEYS\.([A-Z0-9_]+)\]: '([^']+)'/g)].map(m=>[m[1],m[2]]));
  const files = cp.execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:directory,encoding:'utf8'}).split('\0').filter(f=>/^(src|api|tests)\//.test(f)&&/\.(?:js|jsx|cjs|mjs)$/.test(f));
  const sources = files.map(file=>({file,text:fs.readFileSync(path.join(directory,file),'utf8')}));
  return features.map(feature=>{
    const linkedRoutes=routes.filter(r=>r.feature===feature.key).map(r=>r.route);
    const matches=sources.filter(s=>s.text.includes(`FEATURE_KEYS.${feature.key}`)||s.text.includes(`'${feature.id}'`));
    return {...feature,label:labels.get(feature.key)||feature.id.replaceAll('_',' '),routes:linkedRoutes,implementation:matches.filter(s=>s.file.startsWith('src/')&&!/\.test\./.test(s.file)).map(s=>s.file),tests:matches.filter(s=>s.file.startsWith('tests/')||/\.test\./.test(s.file)).map(s=>s.file)};
  });
}
function render(rows) {
  const lines = ['# Universal platform parity matrix','', 'Generated from actual feature keys, route gates and source references by `node scripts/generate-platform-parity.cjs`. Source inventory is evidence of implementation references, not proof of functional parity. All platform acceptance starts pending and requires source-bound workflow evidence.','', '## Acceptance contract','', 'Roles/permissions: existing plan eligibility, tenant membership and `src/lib/featureAccess.js` apply to every feature; owner wages and server-verified System Administrator authority remain independently enforced. Exact role-by-workflow acceptance is pending.','', 'Required surfaces: Android APK, Android browser, iPhone browser, Windows Chrome/Edge, installed desktop PWA and native iOS when tooling is available. Hardware adapters provide supported camera/file, speech/typed, push/in-app, export/share/download/print and navigation alternatives; capability-specific verification remains pending.','', '| Feature | Actual implementation references | Routes | Existing automated references | Android APK | Android web | iPhone web | PC Chrome/Edge | Desktop PWA | Native iOS | Evidence / limitations / device acceptance |','|---|---|---|---|---|---|---|---|---|---|---|'];
  for(const row of rows)lines.push(`| ${row.label} (${row.id}) | ${row.implementation.slice(0,5).join(', ')||'Plan/feature declaration; implementation audit pending'} | ${row.routes.join(', ')||'Subfeature; route mapping audit pending'} | ${row.tests.slice(0,3).join(', ')||'Workflow coverage audit pending'} | Pending | Pending | Pending | Pending | Pending | Pending | No parity claim; role, capability, fallback and physical-device audit pending |`);
  lines.push('', '## Additional capability audit', '', 'The feature-key catalog is not exhaustive. Audit every route/subroute in App.js and feature components, enabled flags, API contracts and docs/feature-status.json, including Demo Mode, 86Voice, HR/training, Food Safety, events, labels, vendors/purchasing/receiving, calendar access, POS, backup/restore/forensics, preferences and native services. Expand this matrix with distinct workflows and evidence during the phases. Do not equate route presence with functional coverage.', '');
  return lines.join('\n');
}
module.exports={inventory,render};
if(require.main===module){const rows=inventory();fs.writeFileSync(path.join(root,'docs/UNIVERSAL_PLATFORM_PARITY_MATRIX.md'),render(rows)); console.log(`Inventoried ${rows.length} feature keys; functional parity remains unverified.`);}
