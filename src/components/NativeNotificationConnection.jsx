import React, { useEffect, useRef, useState } from 'react';
import { nativePush } from '../core/nativePush';

export default function NativeNotificationConnection({ onConnect }) {
  const [permission, setPermission] = useState('checking');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    nativePush.permission().then(value => { if (active.current) setPermission(value); }).catch(() => { if (active.current) setPermission('unavailable'); });
    return () => { active.current = false; };
  }, []);
  const connect = async () => {
    setBusy(true); setConnected(false);
    try {
      const saved = await onConnect?.();
      const currentPermission = await nativePush.permission();
      if (!active.current) return;
      setPermission(currentPermission);
      setConnected(saved === true);
    } catch (_) { if (active.current) setConnected(false); }
    finally { if (active.current) setBusy(false); }
  };
  const status = permission === 'granted' ? 'Allowed on this phone' : permission === 'denied' ? 'Blocked: allow notifications in Android Settings' : permission === 'checking' ? 'Checking phone permission' : 'Connect to enable phone notifications';
  return <div className="p-3 bg-[#0B0E11] border border-[#2A353D] rounded-xl flex justify-between items-center gap-3">
    <div><div className="text-sm font-black text-white">Device Connection</div><p className="text-[10px] text-slate-400" role="status">{connected ? 'Connected on this phone' : status}</p></div>
    <button type="button" onClick={connect} disabled={busy || !onConnect} className="px-4 py-2 bg-[#C59373] text-slate-900 rounded-lg text-xs font-bold disabled:opacity-50">{busy ? 'Connecting…' : connected ? 'Reconnect Device' : 'Connect Device'}</button>
  </div>;
}
