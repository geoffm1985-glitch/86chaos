import {useEffect,useRef,useState} from 'react';
import {secureFetch} from '../../core/appCore';
import {shiftDateBy,workspaceDate} from '../../core/scheduleWorkspace';

// A stalled browser watch must not force managers to edit an unverified preview.
// This read uses the same authenticated scheduling boundary and never queues writes.
export function useVerifiedScheduleWeek({tenant,actor,weekStart,streamReady,enabled=true}) {
  const [refresh,setRefresh]=useState(0),[state,setState]=useState(null);
  const scope=JSON.stringify([tenant,actor,weekStart,enabled,streamReady,refresh]);
  const generation=useRef({scope,number:0});
  if(generation.current.scope!==scope)generation.current={scope,number:generation.current.number+1};
  const key=scope+':'+generation.current.number;
  useEffect(()=>{
    if(!enabled || !tenant || !actor || streamReady)return undefined;
    let active=true,expiry,deadline;
    const controller=new AbortController();
    const invalidate=()=>{if(active)setState(previous=>previous?.key===key?{...previous,stale:true}:previous);};
    const read=async()=>{
      if(navigator.onLine===false || document.visibilityState==='hidden')return;
      try{
        deadline=setTimeout(()=>{controller.abort();if(active)setState({key,resolved:false,stale:true,error:'Server schedule verification timed out. Refresh when connected.'});},8000);
        const response=await secureFetch('/api/schedule-workspace',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({action:'read-week',restaurantId:tenant,weekStart})});
        const result=await response.json();
        if(!active || controller.signal.aborted)return;
        const start=shiftDateBy(weekStart,-1),end=shiftDateBy(weekStart,7),ids=new Set();
        if(!response.ok || !result.ok || result.authoritative!==true || result.restaurantId!==tenant || result.weekStart!==weekStart || result.dateStart!==start || result.dateEnd!==end || !Number.isFinite(Date.parse(result.verifiedAt)) || !Array.isArray(result.shifts) || result.shifts.length>5000)throw new Error('The server could not verify this complete schedule week.');
        for(const row of result.shifts){const date=row.scheduleDateKey || row.date;if(!row.id || ids.has(row.id) || row.restaurantId!==tenant || row.workspaceId!==tenant || !workspaceDate(date) || date<start || date>end)throw new Error('The server returned mismatched schedule evidence.');ids.add(row.id);}
        setState({key,data:result.shifts,resolved:true,stale:navigator.onLine===false || document.visibilityState==='hidden',error:null,expiresAt:Date.now()+30000});
        expiry=setTimeout(invalidate,30000);
      }catch(error){if(active && !controller.signal.aborted)setState({key,resolved:false,stale:true,error:error.message});}
      finally{clearTimeout(deadline);}
    };
    const timer=setTimeout(read,1500);
    window.addEventListener('offline',invalidate);
    const onVisibility=()=>{if(document.visibilityState==='hidden')invalidate();};
    document.addEventListener('visibilitychange',onVisibility);
    return()=>{active=false;controller.abort();clearTimeout(timer);clearTimeout(expiry);clearTimeout(deadline);window.removeEventListener('offline',invalidate);document.removeEventListener('visibilitychange',onVisibility);};
  },[key,enabled,tenant,actor,weekStart,streamReady]);
  const snapshot=state?.key===key?state:{data:[],resolved:false,stale:true,error:null};
  return {snapshot:{...snapshot,data:snapshot.data || [],stale:snapshot.stale || navigator.onLine===false || document.visibilityState==='hidden' || Boolean(snapshot.expiresAt && snapshot.expiresAt<=Date.now())},retry:()=>setRefresh(value=>value+1)};
}
