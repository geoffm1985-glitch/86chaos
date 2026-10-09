import { useEffect, useState } from 'react';
import { secureFetch, hasAnyPermission } from '../core/appCore';

export function useItemDemandHistory(appUser,enabled) {
  const restaurantId=appUser?.restaurantId;
  const allowed=hasAnyPermission(appUser,['sales','salesRead','financialRead','labor','laborRead','wageView','wageEdit']);
  const [revision,setRevision]=useState(0);
  const [state,setState]=useState({data:[],resolved:false,error:null,stale:false});
  useEffect(()=>{
    const controller=new AbortController();setState({data:[],resolved:false,error:null,stale:false});
    if(!enabled || !allowed || !restaurantId || appUser?.demoMode || appUser?.isDemo)return()=>controller.abort();
    (async()=>{
      try {
        const response=await secureFetch('/api/demand-history',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({restaurantId,action:'read'})});
        const result=await response.json();if(!response.ok || !result.ok)throw new Error(result.error || 'History could not be loaded.');
        if(!controller.signal.aborted)setState({data:result.data,resolved:true,error:result.complete ? null : result.reason,stale:false});
      } catch(error) {if(!controller.signal.aborted)setState({data:[],resolved:true,error:error.message,stale:true});}
    })();
    return()=>controller.abort();
  },[enabled,allowed,restaurantId,revision,appUser?.demoMode,appUser?.isDemo]);
  return {...state,allowed,reload:()=>setRevision(value=>value+1)};
}
