'use strict';
const TRANSIENT_AUTH_RE=/auth\/(?:the-service-is-currently-unavailable|network-request-failed)\b/i;
async function submitAuditLogin({submit,wait,isLogin,refresh,pause,onRecovery=()=>{}}) {
  await submit();
  let text=await wait();
  if(isLogin(text)&&TRANSIENT_AUTH_RE.test(text)) {
    const reason=text.match(TRANSIENT_AUTH_RE)[0];
    onRecovery({reason,attempt:1});
    await pause();
    await refresh();
    await submit();
    text=await wait();
  } else if(isLogin(text)&&!/invalid|wrong|error|failed|not attached/i.test(text)) {
    // Preserve the existing one-shot actionability recovery.
    await submit();
    text=await wait();
  }
  if(isLogin(text))throw Error('Login did not leave the login screen. Body: '+text.slice(0,2000));
  return text;
}

function firestoreListenKey(url) {
  try {
    const parsed=new URL(url);
    const database=parsed.searchParams.get('database')||'';
    if(parsed.protocol==='https:'&&parsed.hostname==='firestore.googleapis.com'&&parsed.port===''&&parsed.pathname==='/google.firestore.v1.Firestore/Listen/channel'&&/^projects\/chaos-test-d1601\/databases\/[^/]+$/.test(database))return database;
  } catch (_) {}
  return '';
}
function createFirestoreListenRecovery(problems) {
  const entries=[];
  const recoveries=[];
  const remove=row=>{const index=problems.indexOf(row);if(index>=0)problems.splice(index,1);};
  function track(row,url) {
    const key=firestoreListenKey(url);
    if(!key)return;
    if(row.type==='requestfailed'&&row.failure==='net::ERR_CONNECTION_CLOSED') {
      entries.push({key,url,row,recovered:false});
    } else if(row.type==='console-error'&&/^Failed to load resource: net::ERR_CONNECTION_CLOSED$/.test(row.message)) {
      // Chrome supplies the failed resource URL. Never suppress an unlocated
      // console error or an unrelated app resource with the same error code.
      const recovered=entries.filter(entry=>entry.url===url&&entry.row.type==='requestfailed').at(-1);
      if(recovered?.recovered) {
        remove(row);
        const receipt=recoveries.find(receipt=>receipt.failures.includes(recovered.row));
        if(receipt)receipt.failures.push(row);
      } else entries.push({key,url,row,recovered:false});
    }
  }
  function response(url,status) {
    if(status!==200)return;
    const key=firestoreListenKey(url);
    if(!key)return;
    const pending=entries.filter(entry=>entry.key===key&&!entry.recovered);
    if(!pending.some(entry=>entry.row.type==='requestfailed'))return;
    const rows=pending.map(entry=>entry.row);
    pending.forEach(entry=>{entry.recovered=true;remove(entry.row);});
    recoveries.push({database:key,status,failures:rows});
  }
  return {track,response,recoveries,pending:()=>entries.filter(entry=>!entry.recovered).length};
}
module.exports={submitAuditLogin,firestoreListenKey,createFirestoreListenRecovery};
