import {useEffect,useRef,useState} from 'react';
import {secureFetch} from '../core/appCore';

export function useOperationalHistory(appUser,enabled) {
  const boundary=`${appUser?.restaurantId || ''}|${appUser?.uid || appUser?.id || ''}|${JSON.stringify(appUser?.permissions || {})}`;
  const active=useRef(boundary);active.current=boundary;
  const controller=useRef(null),busy=useRef(false);
  const [state,setState]=useState({boundary,sources:{},loading:false});
  useEffect(()=>{controller.current?.abort();busy.current=false;setState({boundary,sources:{},loading:false});return()=>controller.current?.abort();},[boundary,enabled]);
  const load=async(source,restart=false)=>{
    if(!enabled || !appUser?.restaurantId || appUser.demoMode || appUser.isDemo || busy.current)return;
    const previous=!restart && state.boundary===boundary ? state.sources[source] : null;
    if(previous?.truncated || previous && !previous.error && !previous.nextCursor)return;
    busy.current=true;const requestBoundary=boundary;const abort=new AbortController();controller.current=abort;
    setState(old=>({...old,loading:true}));
    try {
      const response=await secureFetch('/api/operational-history',{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({restaurantId:appUser.restaurantId,source,days:180,after:previous?.nextCursor || '',scanned:previous?.scanned || 0})});
      const result=await response.json();if(!response.ok || !result.ok)throw new Error(result.error || 'History could not be loaded.');
      if(!abort.signal.aborted && active.current===requestBoundary)setState(old=>{
        const prior=restart ? null : old.sources[source];const byId=new Map([...(prior?.data || []),...result.data].map(row=>[row.id,row]));
        const undated=(prior?.undated || 0)+result.undated;
        return {...old,loading:false,sources:{...old.sources,[source]:{...result,data:[...byId.values()],undated,resolved:true,complete:!result.hasMore && !undated && !result.truncated,error:null}}};
      });
    }catch(error){if(!abort.signal.aborted && active.current===requestBoundary)setState(old=>({...old,loading:false,sources:{...old.sources,[source]:{...previous,resolved:true,complete:false,error:error.message}}}));}
    finally{if(controller.current===abort)busy.current=false;}
  };
  return {...(state.boundary===boundary ? state : {sources:{},loading:false}),load};
}
