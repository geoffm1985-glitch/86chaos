import React from 'react';
import { Shield } from 'lucide-react';

const TabAuditLog = ({ appUser, useLiveCollection, T }) => {
  const logs = useLiveCollection('auditLogs', appUser?.restaurantId);
  const sortedLogs = [...logs].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24 animate-[slideIn_0.2s_ease-out]">
      <div className={`${T.card} overflow-hidden`}>
        <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
          <h2 className="text-lg font-black text-white flex items-center gap-2"><Shield className="text-red-500"/> System Audit Logs</h2>
          <span className={`bg-red-900/20 border border-red-500/50 text-red-500 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-widest`}>Master Admin View</span>
        </div>
        
        <div className={`divide-y ${T.border} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
          {sortedLogs.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No security events logged yet.</div>}
          
          {sortedLogs.map(log => (
            <div key={log.id} className={`${T.row} flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-white text-sm">{log.userName}</span>
                  <span className={`text-[9px] uppercase font-black tracking-widest bg-[#12161A] border ${T.border} text-red-400 px-2 py-0.5 rounded`}>{log.action}</span>
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  {log.details} <span className="text-slate-500 ml-1">Target: [{log.target}]</span>
                </div>
              </div>
              <div className={`text-[10px] font-bold ${T.muted} whitespace-nowrap`}>
                {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TabAuditLog;
