import React from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { T } from '../core/appCore';
import { resolveFeatureAccess, featureLabel } from '../lib/featureAccess';

export const LockedFeatureScreen = ({ access, appUser, setActiveTab, compact = false }) => {
  const isStaff = !appUser?.isAdmin && !appUser?.isOwner && !appUser?.accountOwner && !appUser?.workspaceOwner && !appUser?.isSuperAdmin;
  const title = access?.reason === 'permission_locked'
    ? 'Your role does not include this tool'
    : access?.reason === 'integrations_locked'
      ? 'Integrations are coming soon'
      : `${access?.featureLabel || 'This feature'} is locked`;
  const message = access?.reason === 'integrations_locked'
    ? 'POS and accounting integrations are being tested before customer rollout. Manual entry and report imports can still be used where available.'
    : access?.reason === 'permission_locked'
      ? 'The workspace plan may include this feature, but your account still needs the matching role or permission.'
      : isStaff
        ? 'This tool is not available for your account right now.'
        : `${access?.featureLabel || 'This feature'} unlocks on ${access?.requiredPlan?.label || 'a higher plan'} or by a manual admin feature enablement.`;
  return (
    <div className={`${T.card} ${compact ? 'p-4' : 'p-5 sm:p-8'} max-w-3xl mx-auto space-y-4 border-amber-900/40 bg-amber-950/10 text-center`}>
      <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300">
        {access?.master ? <ShieldCheck size={28}/> : <Lock size={28}/>} 
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">Plan & Permission Gate</p>
        <h2 className="text-2xl font-black text-white mt-2">{title}</h2>
        <p className="text-sm font-bold text-slate-300 mt-3 leading-relaxed">{message}</p>
      </div>
      {!isStaff && access?.reason !== 'permission_locked' && access?.reason !== 'integrations_locked' && (
        <div className="grid sm:grid-cols-2 gap-3 text-left">
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Current Plan</div>
            <div className="text-lg font-black text-white mt-1">{access?.currentPlan?.label || 'Shift'}</div>
          </div>
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Unlocks With</div>
            <div className="text-lg font-black text-[#D4A381] mt-1">{access?.requiredPlan?.label || 'Higher plan'}</div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <button type="button" onClick={() => setActiveTab?.('help')} className={T.btnAlt}>Open Help Center</button>
        {!isStaff && <button type="button" onClick={() => setActiveTab?.('settings')} className={T.btn}>View Plan</button>}
      </div>
    </div>
  );
};

export const FeatureGate = ({ featureKey, appUser, clientData, setActiveTab, children, fallback = null }) => {
  const access = resolveFeatureAccess({ workspace: clientData || {}, user: appUser || {}, featureKey });
  if (access.allowed) return <>{children}</>;
  return fallback || <LockedFeatureScreen access={access} appUser={appUser} setActiveTab={setActiveTab} />;
};

export { featureLabel };
