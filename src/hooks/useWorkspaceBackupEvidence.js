import {useEffect,useState} from 'react';
import {secureFetch} from '../core/appCore';
export function useWorkspaceBackupEvidence(appUser,enabled) {
  const workspaceId=appUser?.restaurantId,uid=appUser?.uid || appUser?.id;
  const [state,setState]=useState({workspaceId:'',resolved:false,data:null});
  useEffect(()=>{
    const controller=new AbortController();setState({workspaceId,resolved:false,data:null,allowed:enabled});
    if(!enabled || !workspaceId || appUser?.demoMode || appUser?.isDemo)return()=>controller.abort();
    (async()=>{try{const response=await secureFetch('/api/operational-history',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({restaurantId:workspaceId,source:'backup'})});const result=await response.json();if(!response.ok || !result.ok)throw new Error('Backup evidence could not be verified.');if(!controller.signal.aborted)setState({workspaceId,resolved:true,allowed:true,data:result.data[0],complete:result.complete});}catch(error){if(!controller.signal.aborted)setState({workspaceId,resolved:true,allowed:true,data:null,error:error.message,complete:false});}})();
    return()=>controller.abort();
  },[workspaceId,uid,enabled,appUser?.demoMode,appUser?.isDemo]);
  return state.workspaceId===workspaceId?state:{resolved:false,data:null,allowed:enabled};
}
