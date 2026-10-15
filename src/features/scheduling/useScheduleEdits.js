import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { secureFetch } from '../../core/appCore';
import { workspaceEvidence, workspaceStamp } from '../../core/scheduleWorkspace';

export const scheduleOperationId = () => globalThis.crypto?.randomUUID?.() || `schedule_${Date.now()}_${Math.random().toString(36).slice(2)}`;
function readSession(key, fallback) { try { return JSON.parse(sessionStorage.getItem(key)) || fallback; } catch (_) { return fallback; } }
function saveSession(key,value) { try { if(value == null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,JSON.stringify(value)); } catch (_) {} }
// Keep revision floors after listener acknowledgement: another watch or an older
// server-read response can still arrive later. This cache never authorizes writes.
function boundRevisionFloors(rows,visibleIds) {
  const maximum=12000;
  if(rows.size<=maximum)return rows;
  for(const id of rows.keys())if(!visibleIds.has(id)){rows.delete(id);if(rows.size<=maximum)return rows;}
  while(rows.size>maximum)rows.delete(rows.keys().next().value);
  return rows;
}

export function useScheduleEdits({appUser,shifts=[],sourceState=null,onApplied}) {
  const tenant=appUser?.restaurantId || '',actor=appUser?.authUid || appUser?.uid || appUser?.id || '';
  const key=`86chaos:schedule-actions:${tenant}:${actor}`;
  const [history,setHistory]=useState(()=>readSession(key,{undo:[],redo:[]}));
  const [pending,setPending]=useState(()=>readSession(key+':pending',null));
  const [echoes,setEchoes]=useState(new Map());
  const [busy,setBusy]=useState(false),[error,setError]=useState(null),[sync,setSync]=useState('idle');
  const inFlight=useRef(false),scope=useRef(key);
  const pendingRef=useRef(pending);pendingRef.current=pending;
  const latestRows=useRef(new Map());
  const appliedCallback=useRef(onApplied);appliedCallback.current=onApplied;
  scope.current=key;
  useEffect(()=>{setHistory(readSession(key,{undo:[],redo:[]}));setPending(readSession(key+':pending',null));setEchoes(new Map());setError(null);setSync('idle');},[key]);
  useEffect(()=>{saveSession(key,history);},[key,history]);
  useEffect(()=>{
    if(!sourceState?.resolved || sourceState.stale || sourceState.error)return;
    const incoming=new Map(shifts.map(row=>[row.id,row]));
    setEchoes(previous=>{
      let changed=false;const next=new Map(previous);
      for(const [id,echo] of previous){
        const row=echo.after,server=incoming.get(id);
        const newer=server && (Number(server.revision || 0)>echo.revision || (row && Number(server.revision || 0)===echo.revision && Date.parse(workspaceStamp(server.updatedAt))>Date.parse(workspaceStamp(row.updatedAt))));
        if(newer){next.set(id,{after:server,revision:Number(server.revision || 0),acknowledged:true});changed=true;}
        else if(!echo.acknowledged && ((!row && !server) || (row && server && workspaceEvidence(server)===workspaceEvidence(row)))){next.set(id,{...echo,acknowledged:true});changed=true;}
      }
      return changed?next:previous;
    });
  },[shifts,sourceState?.resolved,sourceState?.stale,sourceState?.error]);
  const visibleShifts=useMemo(()=>{
    const rows=new Map(shifts.map(row=>[row.id,row]));
    const verified=sourceState?.resolved && !sourceState.stale && !sourceState.error;
    for(const [id,echo] of echoes){
      // Once acknowledged, a genuinely empty verified query may remove a row.
      // Retain its floor so a subsequent older nonempty snapshot cannot regress it.
      if(echo.after && (rows.has(id) || !echo.acknowledged || !verified))rows.set(id,echo.after);else rows.delete(id);
    }
    return [...rows.values()];
  },[shifts,echoes,sourceState?.resolved,sourceState?.stale,sourceState?.error]);
  latestRows.current=new Map(visibleShifts.map(row=>[row.id,row]));
  const submit=useCallback(async(body,mode='edit')=>{
    if(inFlight.current)return null;
    if(pendingRef.current && pendingRef.current.body.operationId!==body.operationId){setError({message:'Confirm the outcome of the pending edit before starting another mutation.'});return null;}
    if(!tenant || !actor || navigator.onLine===false){setError({message:'You are offline. Your draft is retained; reconnect before saving.'});setSync('offline');return null;}
    const requestScope=key;
    const savedPending={body,mode};
    inFlight.current=true;setBusy(true);setError(null);setSync('saving');setPending(savedPending);saveSession(key+':pending',savedPending);
    try {
      const response=await secureFetch('/api/schedule-workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok || !result.ok)throw Object.assign(new Error(result.error || 'This edit was not saved.'),{code:result.code,findings:result.findings,authoritativeFailure:true});
      if(scope.current!==requestScope)return null;
      const currentResults=(result.currentResults || result.results || []).filter(row=>{const known=latestRows.current.get(row.id),reference=row.after || row.before;return result.currentResults || !(known && reference && (Number(known.revision || 0)>Number(reference.revision || 0) || Date.parse(known.updatedAt || '')>Date.parse(reference.updatedAt || '')));});
      appliedCallback.current?.({...result,results:currentResults});
      setEchoes(previous=>{
        const next=new Map(previous);
        for(const row of currentResults){
          const revision=Number(row.currentRevision ?? row.after?.revision ?? (Number(row.before?.revision || 0)+1));
          if(next.has(row.id) && next.get(row.id).revision>revision)continue;
          next.delete(row.id);next.set(row.id,{after:row.after,revision,acknowledged:false});
        }
        return boundRevisionFloors(next,new Set(latestRows.current.keys()));
      });
      if(result.operationId)setHistory(previous=>{
        const entry={id:result.operationId,published:Boolean(result.events?.length)};
        const target=mode==='undo'?previous.redo:previous.undo;
        if(target.some(row=>(typeof row==='string'?row:row.id)===entry.id))return previous;
        if(mode==='undo')return{undo:previous.undo.slice(0,-1),redo:[...previous.redo,entry].slice(-50)};
        if(mode==='redo')return{undo:[...previous.undo,entry].slice(-50),redo:previous.redo.slice(0,-1)};
        return{undo:[...previous.undo,entry].slice(-50),redo:[]};
      });
      setPending(null);saveSession(key+':pending',null);setSync(result.noChange?'unchanged':'verified');return result;
    } catch(failure) {
      if(scope.current!==requestScope)return null;
      setError({message:failure.message,code:failure.code,findings:failure.findings || []});
      if(failure.authoritativeFailure){setPending(null);saveSession(key+':pending',null);setSync('not-saved');}
      else setSync('unknown');
      return null;
    } finally {inFlight.current=false;if(scope.current===requestScope)setBusy(false);}
  },[tenant,actor,key]);
  // Explicit user actions only: reconnecting never retries a pending mutation.
  const change=useCallback((changes,review={})=>submit({restaurantId:tenant,operationId:scheduleOperationId(),changes,...review}),[tenant,submit]);
  const compensate=useCallback((mode,review={})=>{
    const stack=mode==='undo'?history.undo:history.redo;
    if(!stack.length)return Promise.resolve(null);
    const last=stack[stack.length-1];
    return submit({restaurantId:tenant,operationId:scheduleOperationId(),undoOf:typeof last==='string'?last:last.id,...review},mode);
  },[tenant,submit,history]);
  return {visibleShifts,busy,error,sync,pending,change,undo:review=>compensate('undo',review),redo:review=>compensate('redo',review),retry:()=>pending?submit(pending.body,pending.mode):Promise.resolve(null),canUndo:history.undo.length>0,canRedo:history.redo.length>0,undoNeedsReview:Boolean(history.undo.at(-1)?.published),redoNeedsReview:Boolean(history.redo.at(-1)?.published),clearError:()=>setError(null),markUnchanged:()=>{setSync('unchanged');setError(null);}};
}
