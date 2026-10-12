import {useCallback,useEffect,useRef,useState} from 'react';

// A saved profile may arrive after the form first renders. Hydrate untouched
// values, but never replace a user's pending edit with that late snapshot.
export function useHydratedPreference(remoteValue, normalize) {
 const dirty=useRef(false);
 const [value,setValue]=useState(()=>normalize(remoteValue));
 useEffect(()=>{if(!dirty.current)setValue(normalize(remoteValue));},[remoteValue,normalize]);
 const edit=useCallback(next=>{dirty.current=true;setValue(normalize(next));},[normalize]);
 const markSaved=useCallback(()=>{dirty.current=false;},[]);
 return [value,edit,markSaved];
}
