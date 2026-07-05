import React, { useState, useEffect } from 'react';
import { Bell, Check, Camera, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star, Bug, Wrench, Globe } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { T, db, storage, auth, messaging, firebaseConfig, secureFetch, MASTER_ADMIN_EMAIL, EVENT_TAGS, CURRENT_VERSION, useLiveCollection, formatDate, getToday, getMonthStr, formatDisplayDate, formatDisplayFullDate, formatDisplayMonth, getDaysInMonth, formatShortTime, formatClockTime, formatClockDateTime, getAvatar, generateTempPass, getExpDate, getHoliday, logAudit, customMapIcon, getRestaurantExportPrefix, safeFilenamePart, downloadCsvRows, downloadTextFile, openPrintableReport } from '../core/appCore';
import { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, MapClickListener, SmartEmptyState, MiniProblemCard, getHomeProfile, calculatePunchHours, getWeekStart, getWeekDates, roleMatches, toLocalTimeInput, makeLocalIso, PunchTable, StatusTile, FriendlyEmpty, GlobalSearchModal, QuickActionDock, KitchenTVMode, ChangeLogModal, UndoBar } from '../components/common';

const TabMasterSchedule = ({ currentDate, appUser, users, shifts, shiftSwaps, timeOffRequests, events, addToast, initialSubTab = 'my-schedule', scheduleBuilderProps = null }) => {
  const [rosterFilterDate, setRosterFilterDate] = useState('');
  const monthStr = getMonthStr(currentDate);
  
  // --- TIME CLOCK LOGIC ---
  const [activePunch, setActivePunch] = useState(null);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [tipCash, setTipCash] = useState('');
  const [tipCredit, setTipCredit] = useState('');
  const [subTab, setSubTab] = useState(initialSubTab);

  useEffect(() => {
    try {
      const voiceTarget = sessionStorage.getItem('86voice_schedule_subtab');
      if (voiceTarget) {
        sessionStorage.removeItem('86voice_schedule_subtab');
        setSubTab(voiceTarget);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!appUser?.id) return;
    const q = query(
      collection(db, 'timePunches'), 
      where('employeeId', '==', appUser.id), 
      where('status', 'in', ['clocked_in', 'on_break'])
    );
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) { setActivePunch({ id: snap.docs[0].id, ...snap.docs[0].data() }); } 
      else { setActivePunch(null); }
    });
    return () => unsub();
  }, [appUser?.id]);



// --- GEOFENCE MATH ENGINE ---
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c) * 3.28084; // Convert final result to feet
  };

const handleClockIn = async () => {
    // Check if scheduled today
    const isScheduledToday = shifts.some(s => s.employeeId === appUser.id && s.date === getToday() && s.isPublished);
    
    let isUnscheduled = false;
    if (!isScheduledToday) {
       const confirmUnscheduled = window.confirm("You are not scheduled for a shift today. Do you want to proceed with an unscheduled clock-in?");
       if (!confirmUnscheduled) return;
       isUnscheduled = true;
    }

    const executePunch = async () => {
      try {
        await addDoc(collection(db, "timePunches"), { 
          employeeId: appUser.id, employeeName: appUser.name, clockInTime: new Date().toISOString(), 
          status: 'clocked_in', restaurantId: appUser.restaurantId, date: getToday(), breakMinutes: 0,
          isUnscheduled: isUnscheduled, isApproved: !isUnscheduled
        });
        
        // Blast the manager alert to the Message Board
        if (isUnscheduled) {
           await addDoc(collection(db, "events"), { 
             date: new Date().toISOString(), title: `UNSCHEDULED PUNCH: ${appUser.name.split(' ')[0]} clocked in without a scheduled shift. Please review in Timesheets.`, 
             type: 'note', author: 'System Alert', isImportant: true, restaurantId: appUser.restaurantId, replies: [] 
           });
        }
        
        addToast('Clocked In', isUnscheduled ? 'Unscheduled shift started. Manager notified.' : 'Shift started successfully.');
      } catch (e) { addToast('Error', e.message); }
    };

    if (appUser?.systemSettings?.geofence) {
      if (!navigator.geolocation) return addToast('Error', 'Your device does not support location tracking.');
      
      const targetLat = parseFloat(appUser.systemSettings.lat);
      const targetLon = parseFloat(appUser.systemSettings.lon);
      const allowedRadius = parseInt(appUser.systemSettings.geofenceRadius) || 300; // Default to 300 feet
      
      if (!targetLat || !targetLon) return addToast('Geofence Error', 'Location coordinates are not set in Workspace settings yet.');
      
      addToast('Locating...', 'Verifying GPS coordinates. Hold still.');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = calculateDistance(targetLat, targetLon, pos.coords.latitude, pos.coords.longitude);
          if (dist <= allowedRadius) executePunch();
          else addToast('Access Denied', `Too far away. Move closer to the restaurant. (${Math.round(dist)} feet away)`);
        },
        (err) => addToast('Location Error', err.code === 1 ? 'Location access denied. Please allow location access in your browser to clock in.' : 'Could not lock GPS. Step outside the walk-in and try again.'),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      executePunch();
    }
  };

  const handleStartBreak = async () => {
    await updateDoc(doc(db, "timePunches", activePunch.id), { breakStartTime: new Date().toISOString(), status: 'on_break' });
    addToast('Break Started', 'Enjoy your break.');
  };

  const handleEndBreak = async () => {
    const breakStart = new Date(activePunch.breakStartTime);
    const now = new Date();
    const mins = (now - breakStart) / 60000;
    const currentBreaks = activePunch.breakMinutes || 0;
    await updateDoc(doc(db, "timePunches", activePunch.id), { breakStartTime: null, breakMinutes: currentBreaks + mins, status: 'clocked_in' });
    addToast('Break Ended', 'Welcome back to work.');
  };

  const initiateClockOut = () => {
    if (appUser?.systemSettings?.tips) { setIsTipModalOpen(true); } 
    else { finalizeClockOut(); }
  };

  const finalizeClockOut = async (e) => {
    if(e) e.preventDefault();
    if (!activePunch) return;
    try {
      let finalBreakMins = activePunch.breakMinutes || 0;
      if (activePunch.status === 'on_break') {
         const breakStart = new Date(activePunch.breakStartTime);
         finalBreakMins += (new Date() - breakStart) / 60000;
      }
      
      let clockOutGeo = null;
      if (appUser?.systemSettings?.geofence && navigator.geolocation) {
        try {
          const targetLat = parseFloat(appUser.systemSettings.lat);
          const targetLon = parseFloat(appUser.systemSettings.lon);
          const allowedRadius = parseInt(appUser.systemSettings.geofenceRadius) || 300;
          if (targetLat && targetLon) {
            const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }));
            const dist = calculateDistance(targetLat, targetLon, pos.coords.latitude, pos.coords.longitude);
            clockOutGeo = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy, distanceFromWorkArea: Math.round(dist), requiredRadius: allowedRadius, geofenceStatus: dist <= allowedRadius ? 'inside' : 'outside' };
          }
        } catch (geoErr) {
          clockOutGeo = { geofenceStatus: 'unknown', error: geoErr?.code === 1 ? 'location_denied' : 'location_unavailable' };
        }
      }
      const outsideArea = clockOutGeo?.geofenceStatus === 'outside';
      if (outsideArea) {
        const ok = window.confirm(`You are clocking out outside the required work area (${clockOutGeo.distanceFromWorkArea} ft away). Your clock-out will still be saved, but a manager will be alerted and a note will be added to your timesheet. Clock out anyway?`);
        if (!ok) return;
      }
      
      await updateDoc(doc(db, "timePunches", activePunch.id), { 
        clockOutTime: new Date().toISOString(), 
        status: 'clocked_out',
        cashTips: parseFloat(tipCash) || 0,
        creditTips: parseFloat(tipCredit) || 0,
        breakMinutes: finalBreakMins,
        breakStartTime: null,
        ...(clockOutGeo ? { clockOutLocation: clockOutGeo } : {}),
        ...(outsideArea ? { managerNote: `⚠ Clocked out outside required area. Distance: ${clockOutGeo.distanceFromWorkArea} ft. Manager review needed.`, needsManagerReview: true } : {})
      });
      if (outsideArea) {
        await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: `GEOFENCE CLOCK-OUT ALERT: ${appUser.name} clocked out ${clockOutGeo.distanceFromWorkArea} ft outside required area. Review in Financials → Timesheets.`, type: 'note', author: 'System Alert', isImportant: true, restaurantId: appUser.restaurantId, replies: [], category: 'Geofence Alert' });
      }
      
      setIsTipModalOpen(false);
      setTipCash(''); setTipCredit('');
      addToast('Clocked Out', 'Shift ended. Great work today!');
    } catch (err) { addToast('Error', err.message); }
  };

// --- SHIFT LOGIC ---
  const myMonthShifts = shifts
    .filter(s => s.employeeId === appUser.id && s.date.startsWith(monthStr) && s.isPublished)
    .sort((a,b) => a.date === b.date ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date));

  const myNextShift = shifts
    .filter(s => s.employeeId === appUser.id && s.date >= getToday() && s.isPublished)
    .sort((a,b) => a.date === b.date ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date))[0];

  const activeMonthShifts = shifts
    .filter(s => s.date.startsWith(monthStr) && s.isPublished)
    .sort((a,b) => a.date === b.date ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date));

  // --- TRADE BOARD LOGIC ---
  const availableSwaps = shiftSwaps
    .filter(s => s.status === 'available' && s.date >= getToday())
    .sort((a,b) => a.date.localeCompare(b.date));

  const handleCancelSwap = async (swapId) => {
    if (!window.confirm("Remove this shift from the Trade Board?")) return;
    await deleteDoc(doc(db, "shiftSwaps", swapId));
    addToast('Revoked', 'Shift removed from Trade Board.');
  };

  const handleClaimShift = async (swap) => {
    if (!swap?.shiftId) return addToast('Error', 'This trade-board listing is missing its linked shift ID.');
    if (!window.confirm(`Claim this ${swap.role} shift on ${formatDisplayDate(swap.date)}?`)) return;

    try {
      await updateDoc(doc(db, "shifts", swap.shiftId), {
        employeeId: appUser.id,
        role: swap.role,
        updatedAt: new Date().toISOString(),
        claimedFromTradeBoard: true
      });

      await updateDoc(doc(db, "shiftSwaps", swap.id), {
        status: 'claimed',
        claimedBy: appUser.id,
        claimedByName: appUser.name,
        claimedAt: new Date().toISOString()
      });

      addToast('Shift Claimed', 'The shift has been added to your schedule.');
      setSubTab('my-schedule');
    } catch (e) {
      addToast('Error', e.message || 'Could not claim shift.');
    }
  };

const handleOfferSwap = async (shift) => {
    if (!window.confirm(`Offer your ${shift.role} shift on ${formatDisplayDate(shift.date)} to the Trade Board?`)) return;
    
    try {
      // 1. Add the swap to the database
      await addDoc(collection(db, "shiftSwaps"), {
        shiftId: shift.id,
        originalEmployeeId: appUser.id,
        role: shift.role,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: 'available',
        restaurantId: appUser.restaurantId,
        listedAt: new Date().toISOString()
      });
      
      addToast('Listed', 'Shift is now on the Trade Board.');
      setSubTab('trade-board');

      // 2. Trigger the Universal Push Cannon
      try {
        await secureFetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            restaurantId: appUser.restaurantId,
            type: 'trade', // This tells the cannon to respect the notifTrades toggle
            title: '🔄 Shift up for grabs!',
            body: `${appUser.name.split(' ')[0]} just posted a ${shift.role} shift on ${formatDisplayDate(shift.date)}.`,
            textContent: '', // Not a message, so no keyword scanning needed
            isCritical: false
          })
        });
      } catch (err) {
        console.error("Failed to trigger push:", err);
      }

    } catch (e) {
      addToast('Error', e.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-24">
      
      <Modal isOpen={isTipModalOpen} onClose={() => setIsTipModalOpen(false)} title="Declare Tips">
        <form onSubmit={finalizeClockOut} className="space-y-4">
          <p className="text-xs text-slate-300 font-bold mb-2">Please declare your tips for this shift before clocking out.</p>
          <div>
            <label className={T.label}>Cash Tips ($)</label>
            <input type="number" step="0.01" min="0" value={tipCash} onChange={e=>setTipCash(e.target.value)} className={T.input} placeholder="0.00"/>
          </div>
          <div>
            <label className={T.label}>Credit Card Tips ($)</label>
            <input type="number" step="0.01" min="0" value={tipCredit} onChange={e=>setTipCredit(e.target.value)} className={T.input} placeholder="0.00"/>
          </div>
          <button type="submit" className={`w-full ${T.btn}`}>Finalize Clock Out</button>
        </form>
      </Modal>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 border-b border-[#2A353D] mb-4 pb-2">
        {['my-schedule', 'full-schedule', 'month-view', 'time-off', ...((appUser?.isAdmin || appUser?.permissions?.schedule) && scheduleBuilderProps ? ['schedule-builder'] : [])].map((tab) => (
          <button key={tab} onClick={() => setSubTab(tab)} className={`px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all sm:flex-1 ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {subTab === 'schedule-builder' && scheduleBuilderProps && (
        <div className="animate-[slideIn_0.2s_ease-out]">
          <TabScheduleWorkbench {...scheduleBuilderProps} />
        </div>
      )}

      {subTab === 'my-schedule' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          {events.filter(e => e.type === 'note' && e.isImportant).slice(0,1).map(alert => (
            <div key={alert.id} className="bg-gradient-to-r from-[#7A4F31]/30 to-[#1A2126] border border-[#B88764]/40 p-3 rounded-xl flex gap-3 shadow-lg">
              <Bell size={24} className="text-red-500 flex-shrink-0" />
              <div>
                <span className="text-[9px] font-black uppercase text-[#D4A381] tracking-widest block">System Alert</span>
                <p className="text-xs text-slate-200 font-medium leading-snug">{alert.title}</p>
              </div>
            </div>
          ))}
          <div className={`${T.grad} rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-[#D4A381]/30`}>
            <div className="absolute -top-4 -right-4 text-8xl font-black text-slate-900/10">86</div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900/60 mb-1">My Schedule</h3>
            {myNextShift ? (
              <div className="mb-6"><div className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">Next: {myNextShift.role}</div><div className="text-sm font-bold text-slate-900/80 flex items-center gap-1.5">{formatDisplayDate(myNextShift.date)}   {formatShortTime(myNextShift.startTime)} - {formatShortTime(myNextShift.endTime)} {myNextShift.endTime === 'CLOSE' && <span className="bg-slate-900 text-[#D4A381] text-[9px] px-1.5 py-0.5 rounded ml-1 uppercase tracking-wider">Close</span>}</div></div>
            ) : (<div className="mb-6 text-slate-900 font-bold">No upcoming shifts scheduled.</div>)}
            
            {activePunch ? (
              <div className="space-y-2 relative z-10">
                <button onClick={initiateClockOut} className="w-full py-4 bg-red-900/80 text-red-100 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:bg-red-800 border border-red-500/50 transition-all flex flex-col items-center justify-center gap-1">
                  <span>CLOCK OUT</span>
                  <span className="text-[10px] text-red-300 font-medium normal-case tracking-normal">Clocked in at {formatClockTime(activePunch.clockInTime)}</span>
                </button>
                {appUser?.systemSettings?.breaks && (
                  activePunch.status === 'on_break' ? (
                    <button onClick={handleEndBreak} className="w-full py-3 bg-blue-900/80 text-blue-100 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-800 border border-blue-500/50 transition-all">END BREAK</button>
                  ) : (
                    <button onClick={handleStartBreak} className="w-full py-3 bg-slate-800/50 text-slate-900 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 hover:text-white border border-slate-700 transition-all">START UNPAID BREAK</button>
                  )
                )}
              </div>
            ) : (
              <button onClick={handleClockIn} className="w-full py-4 bg-emerald-600/20 text-emerald-400 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:bg-emerald-600/30 border border-emerald-500/50 transition-all relative z-10">
                CLOCK IN
              </button>
            )}

          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setSubTab('trade-board')} className={`${T.card} p-4 flex flex-col items-center justify-center gap-2 hover:bg-[#2A353D] transition-colors relative`}>
              <Repeat size={24} className={T.copper}/>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Trade Board</span>
              {availableSwaps.length > 0 && <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg">{availableSwaps.length}</span>}
            </button>
            <button onClick={() => setSubTab('time-off')} className={`${T.card} p-4 flex flex-col items-center justify-center gap-2 hover:bg-[#2A353D] transition-colors`}>
              <Calendar size={24} className={T.copper}/>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Request Off</span>
            </button>
          </div>

          <div className={`${T.card} overflow-hidden mt-4`}>
            <div className={T.th}>My Month Shifts</div>
            <div className={`divide-y ${T.border}`}>
              {myMonthShifts.length === 0 ? (
                <div className={`p-4 text-center text-xs font-bold ${T.muted}`}>No shifts scheduled for you this month.</div>
              ) : (
                myMonthShifts.map(s => {
                  const isFuture = s.date >= getToday();
                  const isOffered = shiftSwaps.some(swap => swap.shiftId === s.id && swap.status === 'available');

                  return (
                    <div key={s.id} className={`${T.row} flex justify-between items-center`}>
                      <div>
                        <div className="font-bold text-white text-sm">{formatDisplayDate(s.date)}</div>
                        <div className={`text-[9px] font-black uppercase tracking-widest ${T.copper} mt-0.5`}>{s.role}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-xs font-mono font-bold bg-[#12161A] ${T.copper} px-2 py-1 rounded-md border ${T.border}`}>
                          {formatShortTime(s.startTime)} - {formatShortTime(s.endTime)}
                        </div>
                        {isFuture && (
                          isOffered ? (
                            <span className="text-[8px] font-black uppercase tracking-widest text-orange-400 bg-orange-900/20 border border-orange-900/50 px-2 py-1 rounded">Listed</span>
                          ) : (
                            <button onClick={() => handleOfferSwap(s)} className="text-[8px] font-black uppercase tracking-widest bg-[#1A2126] text-slate-300 border border-[#2A353D] hover:text-[#D4A381] hover:border-[#D4A381]/50 px-2 py-1 rounded transition-colors shadow-sm">
                              Swap
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* THE TRADE BOARD */}
      {subTab === 'trade-board' && (
        <div className="animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}><Repeat size={18} /> Trade Board</h3>
              <button onClick={() => setSubTab('my-schedule')} className="text-xs font-bold text-slate-400 hover:text-white border border-[#2A353D] px-3 py-1.5 rounded-lg">Back to Dashboard</button>
            </div>
            
            <div className={`divide-y ${T.border}`}>
              {availableSwaps.length === 0 ? (
                <div className={`p-8 text-center text-sm font-bold ${T.muted}`}>No shifts currently available.</div>
              ) : (
                availableSwaps.map(swap => {
                  const isMine = swap.originalEmployeeId === appUser.id;
                  const originalEmp = users.find(u => u.id === swap.originalEmployeeId);
                  
                  return (
                    <div key={swap.id} className={`${T.row} p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4`}>
                      <div>
                        <div className="font-bold text-white text-base">{formatDisplayDate(swap.date)}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mt-0.5">
                          {swap.role}   {formatShortTime(swap.startTime)} - {formatShortTime(swap.endTime)}
                        </div>
                        <div className="text-xs text-slate-400 font-medium mt-1">Listed by {originalEmp?.name || 'Unknown Staff'}</div>
                      </div>
                      <div className="flex-shrink-0">
                        {isMine ? (
                          <button onClick={() => handleCancelSwap(swap.id)} className="w-full sm:w-auto px-4 py-2 bg-red-900/20 text-red-500 text-xs font-black uppercase tracking-widest rounded-lg border border-red-900/50 hover:bg-red-900/40 transition-colors">Revoke Listing</button>
                        ) : (
                          <button onClick={() => handleClaimShift(swap)} className="w-full sm:w-auto px-4 py-2 bg-emerald-900/20 text-emerald-400 text-xs font-black uppercase tracking-widest rounded-lg border border-emerald-900/50 hover:bg-emerald-900/40 transition-colors shadow-[0_0_10px_rgba(16,185,129,0.1)]">Claim Shift</button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

{subTab === 'full-schedule' && (() => {
        const filteredRosterShifts = activeMonthShifts.filter(s => rosterFilterDate ? s.date === rosterFilterDate : true);
        return (
          <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
            <div className="bg-[#12161A] p-3 border-b border-[#2A353D] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div className="flex items-center gap-2">
                 <h3 className={`text-xs font-black uppercase tracking-widest ${T.copper}`}>Active Roster</h3>
                 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">({formatDisplayMonth(currentDate)})</span>
              </div>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filter Day:</span>
                 <input type="date" value={rosterFilterDate} onChange={(e) => setRosterFilterDate(e.target.value)} className={`${T.input} py-1 px-2 text-xs w-auto min-w-[130px]`} />
                 {rosterFilterDate && <button onClick={() => setRosterFilterDate('')} className="text-slate-400 hover:text-red-400 p-1"><X size={14}/></button>}
              </div>
            </div>
            <div className="divide-y divide-[#2A353D] max-h-[60vh] overflow-y-auto custom-scrollbar">
              {filteredRosterShifts.map((shift, index) => {
                 const emp = users.find(u => u.id === shift.employeeId);
                 const showDivider = index === 0 || shift.date !== filteredRosterShifts[index - 1].date;
                 
                 return (
                   <React.Fragment key={shift.id}>
                     {showDivider && (
                       <div className="bg-[#1A2126] px-3 py-2 border-y border-[#2A353D] text-[10px] font-black uppercase tracking-widest text-[#D4A381] sticky top-0 z-10 shadow-sm flex flex-wrap items-center gap-2">
                         <span>{formatDisplayDate(shift.date)}</span>
                         {getHoliday(shift.date) && <span className="bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">{getHoliday(shift.date)}</span>}
                       </div>
                     )}
                     <div className={`${T.row} hover:bg-[#12161A]`}>
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3"><img src={getAvatar(emp?.name, emp?.photoURL)} className={`w-8 h-8 rounded-full border ${T.border} object-cover`} alt="avatar"/><div><div className="text-sm font-bold text-white">{emp?.name ? emp.name.split(' ')[0] : 'Unknown'}</div><div className={`text-[9px] ${T.muted} font-bold uppercase`}>{shift.role}</div></div></div>
                         <div className={`text-xs font-mono font-bold bg-[#12161A] ${T.copper} px-2 py-1 rounded-md border ${T.border}`}>{formatShortTime(shift.startTime)} - {formatShortTime(shift.endTime)}</div>
                       </div>
                     </div>
                   </React.Fragment>
                 )
              })}
              {filteredRosterShifts.length === 0 && <div className={`p-6 text-center text-xs font-bold ${T.muted}`}>No shifts found for this selection.</div>}
            </div>
          </div>
        );
      })()}

      {subTab === 'month-view' && <div className="animate-[slideIn_0.2s_ease-out]"><TabMonth currentDate={currentDate} users={users} shifts={shifts} appUser={appUser} /></div>}
      {subTab === 'time-off' && <div className="animate-[slideIn_0.2s_ease-out]"><TabTimeOff timeOffRequests={timeOffRequests} appUser={appUser} users={users} addToast={addToast} events={events} /></div>}  
    </div>
  );
};

const TabSchedule = ({ currentDate, users, shifts, events, timeOffRequests, timePunches = [], addToast, appUser, initialSubTab = 'schedule', hideSubTabs = false }) => {
  const [subTab, setSubTab] = useState(initialSubTab); 
  const [selectedEmp, setSelectedEmp] = useState(''); 
  const [assignDates, setAssignDates] = useState([]); 
  const [presetShift, setPresetShift] = useState('Custom'); 
  const [startTime, setStartTime] = useState('16:00'); 
  const [endTime, setEndTime] = useState('21:00');
  
  const [isEventModalOpen, setIsEventModalOpen] = useState(false); 
const [eventDate, setEventDate] = useState(getToday()); 
  const [eventTime, setEventTime] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventImageFile, setEventImageFile] = useState(null);
  const [isEventUploading, setIsEventUploading] = useState(false);
  
// Repeating Events State
  const [isRepeating, setIsRepeating] = useState(false);
  const [repeatType, setRepeatType] = useState('weekly');
  const [repeatUntil, setRepeatUntil] = useState('');

  // --- EVENTS CALENDAR STATE ---
  const [eventsCalMonth, setEventsCalMonth] = useState(getMonthStr(currentDate));
  useEffect(() => { setEventsCalMonth(getMonthStr(currentDate)); }, [currentDate]);

  const changeEventsMonth = (offset) => {
    const d = new Date(eventsCalMonth + '-01T12:00:00');
    d.setMonth(d.getMonth() + offset);
    setEventsCalMonth(d.toISOString().substring(0, 7));
  };
  
  const eventsMonthDays = Array.from({length: getDaysInMonth(eventsCalMonth)}).map((_, i) => `${eventsCalMonth}-${String(i+1).padStart(2, '0')}`);
  const eventsFirstDayOffset = new Date(eventsCalMonth+'-01T12:00:00').getDay();
  const eventsCalEvents = events.filter(e => e.type === 'special_event' && e.date?.startsWith(eventsCalMonth));

  // --- AUTO-POPULATE STATE ---
  const [isAutoPopulateModalOpen, setIsAutoPopulateModalOpen] = useState(false);
  const [autoPopSourceMonth, setAutoPopSourceMonth] = useState('');
  
  const monthStr = getMonthStr(currentDate); 
  const monthDays = Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => `${monthStr}-${String(i+1).padStart(2, '0')}`);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr));
  const monthEvents = events.filter(e => e.type === 'special_event' && e.date.startsWith(monthStr)).sort((a,b) => (a.date || '').localeCompare(b.date || ''));

  // --- CUSTOM DROPDOWN TIME GENERATOR ---
  const TIME_OPTIONS = [];
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 60; j += 15) {
      TIME_OPTIONS.push(`${String(i).padStart(2, '0')}:${String(j).padStart(2, '0')}`);
    }
  }

  // --- CUSTOM SHIFT PRESETS LOGIC ---
  const [customPresets, setCustomPresets] = useState([]);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState(null);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetStart, setNewPresetStart] = useState('16:00');
  const [newPresetEnd, setNewPresetEnd] = useState('21:00');

  useEffect(() => {
    const saved = localStorage.getItem(`customPresets_${appUser?.restaurantId}`);
    if (saved) {
      setCustomPresets(JSON.parse(saved));
    } else {
      const seed = [ 
        { id: '1', label: "9a-3p", start: "09:00", end: "15:00" }, { id: '2', label: "10a-4p", start: "10:00", end: "16:00" }, 
        { id: '3', label: "10a-9p", start: "10:00", end: "21:00" }, { id: '4', label: "11a-3p", start: "11:00", end: "15:00" }, 
        { id: '5', label: "11a-4p", start: "11:00", end: "16:00" }, { id: '6', label: "4p-9p", start: "16:00", end: "21:00" }
      ];
      setCustomPresets(seed);
      localStorage.setItem(`customPresets_${appUser?.restaurantId}`, JSON.stringify(seed));
    }
  }, [appUser?.restaurantId]);

  const saveCustomPresetsLocally = (newPresets) => {
    setCustomPresets(newPresets);
    localStorage.setItem(`customPresets_${appUser?.restaurantId}`, JSON.stringify(newPresets));
  };

  const SHIFT_PRESETS = [
    ...[...customPresets].sort((a,b) => a.start.localeCompare(b.start)),
    { id: 'custom', label: "Custom", start: "", end: "" }
  ];

  const handlePresetChange = (e) => { 
    const val = e.target.value; 
    setPresetShift(val); 
    const p = SHIFT_PRESETS.find(x => x.label === val); 
    if (p && val !== 'Custom') { 
      setStartTime(p.start); 
      setEndTime(p.end); 
    } 
  };

  const handleSavePreset = (e) => {
    e.preventDefault();
    if (!newPresetLabel || !newPresetStart || !newPresetEnd) return;
    
    if (editingPresetId) {
      const updated = customPresets.map(p => 
        p.id === editingPresetId ? { ...p, label: newPresetLabel.trim(), start: newPresetStart, end: newPresetEnd } : p
      );
      saveCustomPresetsLocally(updated);
      addToast('Updated', 'Shift preset updated.');
    } else {
      const newPreset = {
        id: Date.now().toString(),
        label: newPresetLabel.trim(),
        start: newPresetStart,
        end: newPresetEnd
      };
      saveCustomPresetsLocally([...customPresets, newPreset]);
      addToast('Saved', 'New shift preset added.');
    }
    cancelPresetEdit();
  };

  const handleEditPreset = (preset) => {
    setNewPresetLabel(preset.label);
    setNewPresetStart(preset.start);
    setNewPresetEnd(preset.end);
    setEditingPresetId(preset.id);
    document.getElementById('preset-modal-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelPresetEdit = () => {
    setNewPresetLabel('');
    setNewPresetStart('16:00');
    setNewPresetEnd('21:00');
    setEditingPresetId(null);
  };

  const handleDeletePreset = (id) => {
    if(window.confirm('Delete this preset?')) {
      const filtered = customPresets.filter(p => p.id !== id);
      saveCustomPresetsLocally(filtered);
    }
  };

// --- PAYROLL DATE RANGE ---
  const [periodStart, setPeriodStart] = useState(`${monthStr}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${monthStr}-${String(getDaysInMonth(monthStr)).padStart(2, '0')}`);
  
  // --- PUNCH FILTERS ---
  const [punchFilterDate, setPunchFilterDate] = useState('');
  const [punchFilterEmp, setPunchFilterEmp] = useState('');

  // --- LABOR & FINANCIAL TARGETS ---
  const [isTargetSettingsOpen, setIsTargetSettingsOpen] = useState(false);
  const [targetSales, setTargetSales] = useState(appUser?.systemSettings?.targetSales || '0');
  const [targetLaborPct, setTargetLaborPct] = useState(appUser?.systemSettings?.targetLaborPct || '0');
  
  const handleSaveTargets = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "restaurants", appUser.restaurantId), {
        'systemSettings.targetSales': parseFloat(targetSales) || 0,
        'systemSettings.targetLaborPct': parseFloat(targetLaborPct) || 0,
        'systemSettings.enableTargets': true
      });
      addToast('Saved', 'Financial and labor targets updated.');
      setIsTargetSettingsOpen(false);
    } catch (err) { addToast('Error', err.message); }
  };

  useEffect(() => {
    setPeriodStart(`${monthStr}-01`);
    setPeriodEnd(`${monthStr}-${String(getDaysInMonth(monthStr)).padStart(2, '0')}`);
  }, [monthStr]);

  const activeRoster = users.filter(u => u.isActive !== false);

  const displayUsers = [...activeRoster].sort((a,b) => {
    const roleA = a.role || 'Unassigned';
    const roleB = b.role || 'Unassigned';
    const nameA = a.name || 'Unknown';
    const nameB = b.name || 'Unknown';
    return roleA === roleB ? nameA.localeCompare(nameB) : roleA.localeCompare(roleB);
  });
  
  const groupedUsers = activeRoster.reduce((acc, user) => {
    const role = user.role || 'Unassigned';
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {});
  const sortedRoles = Object.keys(groupedUsers).sort();

  const getRoleColors = (role, isPublished) => {
    if (!isPublished) return 'bg-slate-400 text-slate-900';
    const r = (role || '').toLowerCase();
    if (r.includes('bartender')) return 'bg-blue-400 text-blue-950';
    if (r.includes('cook') || r.includes('chef') || r.includes('kitchen')) return 'bg-orange-400 text-orange-950';
    if (r.includes('server') || r.includes('wait')) return 'bg-pink-400 text-pink-950';
    if (r.includes('host')) return 'bg-emerald-400 text-emerald-950';
    if (r.includes('manager')) return 'bg-purple-400 text-purple-950';
    if (r.includes('dish')) return 'bg-cyan-400 text-cyan-950';
    return 'bg-[#D4A381] text-slate-900'; 
  };

  const handleCellClick = (d, empId) => {
    if (d < getToday()) return addToast("Locked", "Cannot edit past dates.");
    const existing = monthShifts.find(s => s.date === d && s.employeeId === empId);
    if (existing) { if(window.confirm("Delete shift?")) deleteDoc(doc(db,"shifts",existing.id)); return; }
    setSelectedEmp(empId); if (assignDates.includes(d)) setAssignDates(assignDates.filter(x => x!==d)); else setAssignDates([...assignDates, d]);
  };

  const handleAssign = async () => {
    if (!selectedEmp || assignDates.length === 0) return; const emp = users.find(u => u.id === selectedEmp);
    const validDates = [];
    for (const d of assignDates) { 
      const existingShift = monthShifts.find(s => s.date === d && s.employeeId === emp.id);
      if (existingShift) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} is already scheduled on ${formatDisplayDate(d)}.`); return; }
      
      const req = timeOffRequests.find(r => r.date === d && r.userId === emp.id && r.status !== 'pending');
      if (req) {
        if (!req.isPartial) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} requested ${formatDisplayDate(d)} off.`); return; } 
        else { const reqEnd = req.endTime || '23:59'; if ((startTime < reqEnd) && (endTime > req.startTime)) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} is unavailable from ${formatShortTime(req.startTime)} to ${formatShortTime(req.endTime)} on ${formatDisplayDate(d)}.`); return; } }
      }
      validDates.push(d);
    }
    for (const d of validDates) { await addDoc(collection(db, "shifts"), { date: d, employeeId: emp.id, role: emp.role || 'Unassigned', startTime: startTime, endTime: endTime, isPublished: false, restaurantId: appUser.restaurantId }); }
    setAssignDates([]); addToast('Assigned', `Added ${validDates.length} shifts.`);
  };

const handlePublish = async () => { 
    if(!window.confirm("Publish schedule? Notifications will be sent. A backup file will download first.")) return; 
    
    const unpub = shifts.filter(s => !s.isPublished); 
    
    if (unpub.length === 0) {
      addToast('Notice', 'No unpublished shifts found.');
      return;
    }

    try {
      const publishMonth = getMonthStr(currentDate);
      const restaurantPrefix = getRestaurantExportPrefix(appUser, appUser?.restaurantId || '86chaos');
      const now = new Date();
      const backupPayload = {
        app: '86chaos',
        type: 'schedule-publish-backup',
        version: CURRENT_VERSION,
        generatedAt: now.toISOString(),
        restaurantId: appUser?.restaurantId || null,
        restaurantName: appUser?.restaurantName || appUser?.systemSettings?.restaurantName || null,
        publishMonth,
        unpublishedShiftCount: unpub.length,
        allMonthShiftCount: shifts.filter(s => (s.date || '').startsWith(publishMonth)).length,
        unpublishedShifts: unpub.map(s => ({ ...s })),
        monthShifts: shifts.filter(s => (s.date || '').startsWith(publishMonth)).map(s => ({ ...s }))
      };
      const stamp = now.toISOString().replace(/[:.]/g, '-');
      downloadTextFile(`${restaurantPrefix}-Schedule-Publish-Backup-${publishMonth}-${stamp}.json`, JSON.stringify(backupPayload, null, 2), 'application/json;charset=utf-8;');
    } catch (backupErr) {
      console.warn('Schedule publish backup download failed:', backupErr);
      if (!window.confirm('The local backup download failed. Continue publishing anyway?')) return;
    }
    
    addToast('Publishing...', `Pushing ${unpub.length} shifts live. Please wait.`);
    
    try {
      await Promise.all(unpub.map(s => updateDoc(doc(db, "shifts", s.id), { isPublished: true, publishedAt: new Date().toISOString(), publishedBy: appUser?.id || appUser?.email || 'unknown' })));
      
      addToast("Published", "Schedule is live and a backup file was downloaded."); 
      logAudit(appUser, 'PUBLISH_SCHEDULE', 'Master Roster', `Pushed ${unpub.length} shifts live. Local backup JSON downloaded before publish.`); 

// --- NEW: TRIGGER PUSH NOTIFICATIONS ---
      try {
        addToast('Pinging Server', 'Sending alert request to Vercel...');
        const pushRes = await secureFetch('/api/send-schedule-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            restaurantId: appUser.restaurantId,
            restaurantName: appUser.restaurantName || 'Your restaurant'
          })
        });
        
        const pushData = await pushRes.json();
        console.log("VERCEL RESPONSE:", pushData);
        
        if (pushData.message) {
          // This catches the "No devices registered" silent exit
          addToast('Server Reply', pushData.message); 
        } else if (pushData.success) {
          addToast('Alerts Sent!', `Successfully pushed to ${pushData.sentCount} devices.`);
        } else {
          addToast('API Error', pushData.error || 'Unknown server error');
        }

      } catch (pushErr) {
        console.error("Failed to send push notifications:", pushErr);
        addToast('Network Error', 'Failed to reach Vercel API.');
      }

    } catch (err) {
      addToast("Error", "Some shifts failed to publish. Check connection and try again.");
    }
  };
  
const handleAddEvent = async (e) => { 
    e.preventDefault(); 
    if(!eventTitle.trim()) return; 
    setIsEventUploading(true);

    let photoUrl = null;
    if (eventImageFile) {
      try {
        const fileRef = ref(storage, `events/${appUser.restaurantId}/${Date.now()}_${eventImageFile.name}`);
        await uploadBytes(fileRef, eventImageFile);
        photoUrl = await getDownloadURL(fileRef);
      } catch (error) {
        addToast('Error', 'Image upload failed. Check connection.');
        setIsEventUploading(false);
        return;
      }
    }

    const baseEventData = { type: 'special_event', time: eventTime, title: eventTitle.trim(), notes: eventNotes.trim(), addedBy: appUser.name, restaurantId: appUser.restaurantId };
    if (photoUrl) baseEventData.imageUrl = photoUrl; 

    if (editingEventId) {
      await updateDoc(doc(db, "events", editingEventId), { date: eventDate, time: eventTime, title: eventTitle.trim(), notes: eventNotes.trim(), ...(photoUrl && { imageUrl: photoUrl }) });
      addToast('Updated', 'Event modified successfully.');
    } else {
      if (isRepeating && repeatUntil) {
        const seriesId = Date.now().toString();
        let currentDateObj = new Date(eventDate + 'T12:00:00');
        const endDateObj = new Date(repeatUntil + 'T12:00:00');
        const promises = [];
        let count = 0;

        while (currentDateObj <= endDateObj && count < 365) { // Hard cap at 365 events to prevent DB crash loops
          const dateStr = currentDateObj.toISOString().split('T')[0];
          promises.push(addDoc(collection(db, "events"), { ...baseEventData, date: dateStr, seriesId }));
          
          if (repeatType === 'daily') currentDateObj.setDate(currentDateObj.getDate() + 1);
          else if (repeatType === 'weekly') currentDateObj.setDate(currentDateObj.getDate() + 7);
          else if (repeatType === 'bi-weekly') currentDateObj.setDate(currentDateObj.getDate() + 14);
          else if (repeatType === 'monthly') currentDateObj.setMonth(currentDateObj.getMonth() + 1);
          else if (repeatType === 'yearly') currentDateObj.setFullYear(currentDateObj.getFullYear() + 1);
          count++;
        }
        await Promise.all(promises);
        addToast('Events Generated', `Created ${count} recurring events.`);
      } else {
        await addDoc(collection(db, "events"), { ...baseEventData, date: eventDate }); 
        addToast('Event Added', 'Calendar updated.');
      }
    }
    setEventTitle(''); setEventTime(''); setEventNotes(''); setEditingEventId(null); setEventImageFile(null); setIsEventUploading(false); setIsEventModalOpen(false); setIsRepeating(false); setRepeatUntil(''); 
  };

  const openEditEventModal = (ev) => {
    setEventDate(ev.date); setEventTime(ev.time || ''); setEventTitle(ev.title || ''); setEventNotes(ev.notes || ''); setEditingEventId(ev.id); setEventImageFile(null); setIsEventModalOpen(true);
  };

  const openNewEventModal = () => {
    setEventDate(currentDate); setEventTime(''); setEventTitle(''); setEventNotes(''); setEditingEventId(null); setEventImageFile(null); setIsEventModalOpen(true);
  };

  // --- AUTO-POPULATE SCHEDULE ENGINE ---
  const handleAutoPopulate = async () => {
    if (!autoPopSourceMonth) return addToast('Error', 'Please select a source month.');
    const sourceShifts = shifts.filter(s => s.date.startsWith(autoPopSourceMonth));
    if (sourceShifts.length === 0) return addToast('Empty', 'No shifts found in the selected month.');

    const targetMonth = getMonthStr(currentDate);
    if (autoPopSourceMonth === targetMonth) return addToast('Error', 'Cannot copy to the exact same month.');

    // Calculate Day Offset to cleanly align days of the week (Monday to Monday)
    let sMon = new Date(autoPopSourceMonth + '-01T12:00:00');
    while(sMon.getDay() !== 1) sMon.setDate(sMon.getDate() + 1);

    let tMon = new Date(targetMonth + '-01T12:00:00');
    while(tMon.getDay() !== 1) tMon.setDate(tMon.getDate() + 1);

    const dayOffset = Math.round((tMon - sMon) / (1000 * 60 * 60 * 24));

    let addedCount = 0;
    for (const s of sourceShifts) {
      const sDate = new Date(s.date + 'T12:00:00');
      sDate.setDate(sDate.getDate() + dayOffset);
      const newDateStr = sDate.toISOString().split('T')[0];

      if (newDateStr.startsWith(targetMonth)) {
        // Prevent exact duplicates 
        const exists = shifts.find(existing => existing.date === newDateStr && existing.employeeId === s.employeeId && existing.role === s.role && existing.startTime === s.startTime && existing.endTime === s.endTime);
        
        if (!exists) {
          await addDoc(collection(db, "shifts"), { 
            date: newDateStr, 
            employeeId: s.employeeId, 
            role: s.role, 
            startTime: s.startTime, 
            endTime: s.endTime, 
            isPublished: false, 
            restaurantId: appUser.restaurantId 
          });
          addedCount++;
        }
      }
    }
    setIsAutoPopulateModalOpen(false);
    setAutoPopSourceMonth('');
    addToast('Populated', `Drafted ${addedCount} shifts. Conflicts are highlighted in red.`);
  };

  // --- LABOR PROJECTION ENGINE ---
  const calculateShiftHours = (start, end) => {
    if (!start || !end) return 0;
    let sH = parseInt(start.split(':')[0]), sM = parseInt(start.split(':')[1]) / 60;
    let eH = parseInt(end.split(':')[0]), eM = parseInt(end.split(':')[1]) / 60;
    let total = (eH + eM) - (sH + sM);
    if (total < 0) total += 24; 
    return total;
  };

  let projectedMonthLabor = 0;
  const projectedDailyLabor = {};
  monthDays.forEach(d => projectedDailyLabor[d] = 0);

  monthShifts.forEach(shift => {
    const emp = users.find(u => u.id === shift.employeeId);
    const wage = emp?.wage || 0; 
    const hours = calculateShiftHours(shift.startTime, shift.endTime);
    const cost = hours * wage;
    
    projectedMonthLabor += cost;
    if (projectedDailyLabor[shift.date] !== undefined) {
      projectedDailyLabor[shift.date] += cost;
    }
  });

  const periodPunches = timePunches.filter(p => p.date >= periodStart && p.date <= periodEnd).sort((a,b) => new Date(a.clockInTime || 0) - new Date(b.clockInTime || 0));
  
  const calculatePunchHours = (inTime, outTime, breakMins = 0) => {
      if (!inTime || !outTime) return 0;
      const rawMins = (new Date(outTime) - new Date(inTime)) / 60000;
      return Math.max(0, (rawMins - breakMins) / 60);
  };

  const getWeekStart = (dateString) => {
      const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
      const startDayInt = daysMap[appUser?.preferences?.payPeriodStart || 'Monday'];
      let d = new Date(dateString + 'T12:00:00');
      while (d.getDay() !== startDayInt) { d.setDate(d.getDate() - 1); }
      return d.toISOString().split('T')[0];
  };
  const payrollSummary = {};
  const weeklyHours = {}; 
  const OT_THRESHOLD = parseFloat(appUser?.systemSettings?.overtime || 40);

  periodPunches.forEach(p => {
      if (p.status === 'clocked_in' || !p.clockOutTime) return;
      
      const emp = users.find(u => u.id === p.employeeId);
      if (!payrollSummary[p.employeeId]) {
          payrollSummary[p.employeeId] = {
              name: p.employeeName || 'Unknown', regHours: 0, otHours: 0, cashTips: 0, creditTips: 0, rate: emp?.wage || 0, pay: 0
          };
      }
      
      const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
      const weekKey = `${p.employeeId}_${getWeekStart(p.date)}`;
      const prevWeeklyHours = weeklyHours[weekKey] || 0;
      const newWeeklyHours = prevWeeklyHours + hours;
      
      let reg = 0; let ot = 0;
      if (prevWeeklyHours >= OT_THRESHOLD) { ot = hours; } else if (newWeeklyHours > OT_THRESHOLD) { reg = OT_THRESHOLD - prevWeeklyHours; ot = newWeeklyHours - OT_THRESHOLD; } else { reg = hours; }
      
      weeklyHours[weekKey] = newWeeklyHours;
      payrollSummary[p.employeeId].regHours += reg; payrollSummary[p.employeeId].otHours += ot;
      payrollSummary[p.employeeId].cashTips += (parseFloat(p.cashTips) || 0); payrollSummary[p.employeeId].creditTips += (parseFloat(p.creditTips) || 0);
      
      const rate = emp?.wage || 0;
      payrollSummary[p.employeeId].pay += (reg * rate) + (ot * rate * 1.5);
  });
  
  const summaryList = Object.values(payrollSummary).sort((a, b) => a.name.localeCompare(b.name));
  const actualPeriodLabor = summaryList.reduce((acc, s) => acc + s.pay, 0);

  const handleForceClockOut = async (punch) => {
      if (!window.confirm(`Force clock out ${punch.employeeName}?`)) return;
      await updateDoc(doc(db, "timePunches", punch.id), { clockOutTime: new Date().toISOString(), status: 'clocked_out' });
      addToast('Updated', `Punched out ${punch.employeeName}.`);
  };

  const handleDeletePunch = async (id) => {
      if (!window.confirm("Delete this time punch permanently?")) return;
      await deleteDoc(doc(db, "timePunches", id));
      addToast('Deleted', 'Time punch removed.');
  };

const [isPunchModalOpen, setIsPunchModalOpen] = useState(false);
  const [editingPunch, setEditingPunch] = useState(null);
  const [editPunchEmpId, setEditPunchEmpId] = useState(''); // NEW: For creating punches
  const [editPunchIn, setEditPunchIn] = useState('');
  const [editPunchOut, setEditPunchOut] = useState('');
  const [editBreakMins, setEditBreakMins] = useState('');
  const [editCash, setEditCash] = useState('');
  const [editCredit, setEditCredit] = useState('');

  const openEditPunchModal = (punch) => {
    setEditingPunch(punch);
    const formatForInput = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    };
    setEditPunchIn(formatForInput(punch.clockInTime));
    setEditPunchOut(punch.clockOutTime && punch.status === 'clocked_out' ? formatForInput(punch.clockOutTime) : '');
    setEditBreakMins(punch.breakMinutes || 0);
    setEditCash(punch.cashTips || 0);
    setEditCredit(punch.creditTips || 0);
    setIsPunchModalOpen(true);
  };

  const openAddPunchModal = () => {
    setEditingPunch(null);
    setEditPunchEmpId('');
    setEditPunchIn('');
    setEditPunchOut('');
    setEditBreakMins('0');
    setEditCash('0');
    setEditCredit('0');
    setIsPunchModalOpen(true);
  };

  const handleSavePunchEdit = async (e) => {
    e.preventDefault();
    try {
      if (editingPunch) {
        if (!editPunchIn) return;
        const updateData = { clockInTime: new Date(editPunchIn).toISOString(), breakMinutes: parseFloat(editBreakMins) || 0, cashTips: parseFloat(editCash) || 0, creditTips: parseFloat(editCredit) || 0 };
        if (editPunchOut) { updateData.clockOutTime = new Date(editPunchOut).toISOString(); updateData.status = 'clocked_out'; } else { updateData.clockOutTime = null; updateData.status = 'clocked_in'; }
        await updateDoc(doc(db, "timePunches", editingPunch.id), updateData);
        addToast('Updated', 'Time punch modified successfully.');
      } else {
        if (!editPunchEmpId || !editPunchIn) return addToast('Error', 'Employee and Clock In Time required.');
        const emp = users.find(u => u.id === editPunchEmpId);
        const newData = {
          employeeId: emp.id,
          employeeName: emp.name,
          clockInTime: new Date(editPunchIn).toISOString(),
          breakMinutes: parseFloat(editBreakMins) || 0,
          cashTips: parseFloat(editCash) || 0,
          creditTips: parseFloat(editCredit) || 0,
          date: editPunchIn.split('T')[0], // Extract YYYY-MM-DD
          restaurantId: appUser.restaurantId
        };
        if (editPunchOut) { newData.clockOutTime = new Date(editPunchOut).toISOString(); newData.status = 'clocked_out'; } 
        else { newData.clockOutTime = null; newData.status = 'clocked_in'; }
        await addDoc(collection(db, "timePunches"), newData);
        addToast('Added', 'Missing time punch created.');
      }
      setIsPunchModalOpen(false);
      setEditingPunch(null);
    } catch (err) { addToast('Error', err.message); }
  };

const handleExportTimesheets = () => {
    if (periodPunches.length === 0) return addToast("Empty", "No punches to export for this period.");
    const pStartStr = new Date(periodStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const pEndStr = new Date(periodEnd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // Header for the Payroll Summary
    let csv = `"--- PAYROLL SUMMARY ---"\n"Pay Period: ${pStartStr} - ${pEndStr}"\n\n"Employee Name","Reg Hours","OT Hours","Hourly Rate","Total Gross Pay","Declared Cash Tips","Declared Credit Tips"\n`;
    summaryList.forEach(s => { 
      csv += `"${s.name}","${s.regHours.toFixed(2)}","${s.otHours.toFixed(2)}","$${s.rate.toFixed(2)}","$${s.pay.toFixed(2)}","$${s.cashTips.toFixed(2)}","$${s.creditTips.toFixed(2)}"\n`; 
    });
    
    // Header for Individual Punches
    csv += '\n"--- INDIVIDUAL PUNCHES ---"\n"Employee Name","Date","Clock In","Clock Out","Break (Mins)","Total Hours","Hourly Rate","Total Pay","Cash Tips","Credit Tips"\n';
    
    const sortedPunches = [...periodPunches].sort((a,b) => new Date(b.clockInTime || 0) - new Date(a.clockInTime || 0));
    sortedPunches.forEach(p => {
       const emp = users.find(u => u.id === p.employeeId); 
       const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0); 
       const rate = emp?.wage || 0; 
       const estCost = hours * rate; 
       const inStr = p.clockInTime ? formatClockTime(p.clockInTime) : 'Unknown';
       const outStr = p.status === 'clocked_in' ? 'ON CLOCK' : (p.clockOutTime ? formatClockTime(p.clockOutTime) : 'Unknown');
       
       csv += `"${p.employeeName || 'Unknown'}","${p.date || 'Unknown'}","${inStr}","${outStr}","${p.breakMinutes||0}","${hours.toFixed(2)}","$${rate.toFixed(2)}","$${estCost.toFixed(2)}","$${parseFloat(p.cashTips||0).toFixed(2)}","$${parseFloat(p.creditTips||0).toFixed(2)}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); 
    link.setAttribute("href", url); 
    link.setAttribute("download", `${getRestaurantExportPrefix(appUser)}-Payroll-Export-${periodStart}-to-${periodEnd}.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
    URL.revokeObjectURL(url); 
    addToast('Exported', 'Spreadsheet generated with the restaurant name in the filename.');
  };

  const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
  const startDayInt = daysMap[appUser?.preferences?.payPeriodStart || 'Monday'];
  const endDayInt = startDayInt === 0 ? 6 : startDayInt - 1;

  const weeksInMonth = []; let currentWeek = [];
  monthDays.forEach(d => { currentWeek.push(d); if (new Date(d+'T12:00').getDay() === endDayInt) { weeksInMonth.push(currentWeek); currentWeek = []; } });
  if (currentWeek.length > 0) weeksInMonth.push(currentWeek);

  const scheduledHours = displayUsers.map(u => {
     const userShifts = monthShifts.filter(s => s.employeeId === u.id);
     const weekly = weeksInMonth.map(weekDaysArr => { return weekDaysArr.reduce((sum, d) => { const shift = userShifts.find(s => s.date === d); return sum + (shift ? calculateShiftHours(shift.startTime, shift.endTime) : 0); }, 0); });
     return { id: u.id, name: u.name, weekly, total: weekly.reduce((a,b)=>a+b,0) };
  }).filter(u => u.total > 0);

  return (
    <div className="space-y-4 pb-12 w-full">

{/* MANAGER EXPLANATION BANNER */}
      {timeOffRequests.filter(r => r.status === 'pending' && r.date.startsWith(monthStr)).length > 0 && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl flex items-center justify-between gap-4 shadow-lg animate-[slideIn_0.2s_ease-out]">
          <div className="flex items-center gap-3">
            <Shield className="text-red-500 flex-shrink-0 animate-pulse" size={24} />
            <div>
              <h3 className="text-red-400 font-black text-sm uppercase tracking-widest">Action Required</h3>
              <p className="text-xs text-red-200/80 font-medium mt-0.5">
                You have pending time-off requests this month. Go to <strong className="text-white">My Shift {'->'} Request Off</strong> to approve them in the Master Override Log.
              </p>
            </div>
          </div>
        </div>
      )}

    
      {/* --- AUTO POPULATE MODAL --- */}
      <Modal isOpen={isAutoPopulateModalOpen} onClose={() => setIsAutoPopulateModalOpen(false)} title="Auto-Populate Schedule">
        <div className="space-y-4">
          <p className="text-xs text-slate-300 font-bold leading-relaxed">
            Select a previous month to copy shifts from. <br/><br/>
            <span className="text-[#D4A381]">Smart Mapping:</span> Days will automatically align to match the correct day of the week (e.g. 1st Monday to 1st Monday). All copied shifts will be added as unpublished drafts.
          </p>
          <div>
            <label className={T.label}>Source Month</label>
            <input type="month" value={autoPopSourceMonth} onChange={e=>setAutoPopSourceMonth(e.target.value)} className={T.input} />
          </div>
          <button onClick={handleAutoPopulate} className={`w-full ${T.btn} py-3`}>Copy Schedule</button>
        </div>
      </Modal>

      <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title={editingEventId ? "Edit Special Event" : "Add Special Event"}>
        <form onSubmit={handleAddEvent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={T.label}>Date</label><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className={T.input} required/></div>
         <div>
              <label className={T.label}>Time (Optional)</label>
              <input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} className={T.input}/>
            </div>
          </div>
<div><label className={T.label}>Event Title</label><input type="text" value={eventTitle} onChange={e=>setEventTitle(e.target.value)} className={T.input} placeholder="e.g., Packers Playoff Game" required/></div>
        
        {!editingEventId && (
          <div className="bg-[#12161A] p-3 rounded-xl border border-[#2A353D]">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer mb-2">
              <input type="checkbox" checked={isRepeating} onChange={e => setIsRepeating(e.target.checked)} className="w-4 h-4 rounded bg-[#1A2126] border-[#2A353D] accent-[#8F6040]" />
              Make this a repeating event
            </label>
            
            {isRepeating && (
              <div className="grid grid-cols-2 gap-3 mt-3 animate-[slideIn_0.2s_ease-out]">
                <div>
                  <label className={T.label}>Repeats Every</label>
                  <select value={repeatType} onChange={e => setRepeatType(e.target.value)} className={T.input}>
                    <option value="daily">Day</option>
                    <option value="weekly">Week</option>
                    <option value="bi-weekly">Two Weeks</option>
                    <option value="monthly">Month</option>
                    <option value="yearly">Year</option>
                  </select>
                </div>
                <div>
                  <label className={T.label}>Until Date</label>
                  <input type="date" min={eventDate} value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} className={T.input} required={isRepeating} />
                </div>
              </div>
            )}
          </div>
        )}

          <div>
            <label className={T.label}>Notes & Photo (Optional)</label>
            <textarea rows="2" value={eventNotes} onChange={e=>setEventNotes(e.target.value)} className={`${T.input} mb-2`} placeholder="Extra details..."/>
            
            {eventImageFile && (
              <div className="text-xs text-emerald-400 font-bold bg-emerald-900/20 p-2 rounded-lg border border-emerald-900/50 flex justify-between items-center mb-2">
                <span className="truncate pr-2">📷 {eventImageFile.name} attached</span>
                <button type="button" onClick={()=>setEventImageFile(null)} className="text-red-400 hover:text-red-300 p-1"><X size={14}/></button>
              </div>
            )}
            
            <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full">
              <div className={`flex flex-1 sm:flex-none bg-[#12161A] border border-[#2A353D] rounded-xl overflow-hidden shadow-sm h-12 ${isEventUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="flex-1 sm:w-16 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors border-r border-[#2A353D] text-[#D4A381]" title="Take Photo">
                    <Camera size={20} />
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => setEventImageFile(e.target.files[0])} className="hidden" disabled={isEventUploading} />
                 </label>
                 <label className="flex-1 sm:w-20 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors text-[#D4A381]" title="Upload Photo">
                    <span className="text-[10px] font-black uppercase tracking-wider">Upload</span>
                    <input type="file" accept="image/*" onChange={(e) => setEventImageFile(e.target.files[0])} className="hidden" disabled={isEventUploading} />
                 </label>
              </div>
              <button type="submit" disabled={isEventUploading || !eventTitle.trim()} className={`flex-1 sm:flex-1 ${T.btn} h-12 disabled:opacity-50 flex items-center justify-center`}>
                {isEventUploading ? <Loader2 className="animate-spin" size={20}/> : (editingEventId ? 'Update Event' : 'Save Event')}
              </button>
            </div>
          </div>
        </form>
      </Modal>

<Modal isOpen={isPunchModalOpen} onClose={()=>setIsPunchModalOpen(false)} title={editingPunch ? `Edit Punch: ${editingPunch?.employeeName}` : "Add Missing Time Punch"}>
        <form onSubmit={handleSavePunchEdit} className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
          {!editingPunch && (
            <div>
              <label className={T.label}>Select Employee</label>
              <select value={editPunchEmpId} onChange={e=>setEditPunchEmpId(e.target.value)} className={T.input} required>
                <option value="">-- Select Staff Member --</option>
                {users.filter(u => u.isActive !== false).sort((a,b) => a.name.localeCompare(b.name)).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={T.label}>Clock In Time</label>
              <input type="datetime-local" value={editPunchIn} onChange={e=>setEditPunchIn(e.target.value)} className={T.input} required/>
            </div>
            <div>
              <label className={T.label}>Clock Out Time (Leave blank if currently on clock)</label>
              <input type="datetime-local" value={editPunchOut} onChange={e=>setEditPunchOut(e.target.value)} className={T.input}/>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={T.label}>Break (Mins)</label>
              <input type="number" min="0" value={editBreakMins} onChange={e=>setEditBreakMins(e.target.value)} className={T.input}/>
            </div>
            <div>
              <label className={T.label}>Cash Tips ($)</label>
              <input type="number" step="0.01" min="0" value={editCash} onChange={e=>setEditCash(e.target.value)} className={T.input}/>
            </div>
            <div>
              <label className={T.label}>Credit Tips ($)</label>
              <input type="number" step="0.01" min="0" value={editCredit} onChange={e=>setEditCredit(e.target.value)} className={T.input}/>
            </div>
          </div>
          <button type="submit" className={`w-full ${T.btn}`}>{editingPunch ? 'Save Changes' : 'Create Time Punch'}</button>
        </form>
      </Modal>

      {/* --- PRESET MANAGER MODAL --- */}
      <Modal isOpen={isPresetModalOpen} onClose={() => { setIsPresetModalOpen(false); cancelPresetEdit(); }} title="Manage Custom Shifts">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 pb-10">
            <form id="preset-modal-form" onSubmit={handleSavePreset} className="space-y-3 p-4 bg-[#1A2126] border border-[#2A353D] rounded-xl">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-black text-[#D4A381] uppercase tracking-widest">{editingPresetId ? 'Edit Preset' : 'Add New Preset'}</h4>
                    {editingPresetId && <button type="button" onClick={cancelPresetEdit} className="text-xs font-bold text-slate-400 hover:text-white transition-colors">Cancel ✖</button>}
                </div>
                <div>
                    <label className={T.label}>Label (e.g., "Mid Shift 12p-5p")</label>
                    <input type="text" value={newPresetLabel} onChange={e=>setNewPresetLabel(e.target.value)} className={T.input} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={T.label}>Start Time</label>
                        <select value={newPresetStart} onChange={e=>setNewPresetStart(e.target.value)} className={T.input} required>
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatShortTime(t)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={T.label}>End Time</label>
                        <select value={newPresetEnd} onChange={e=>setNewPresetEnd(e.target.value)} className={T.input} required>
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatShortTime(t)}</option>)}
                        </select>
                    </div>
                </div>
                <button type="submit" className={`w-full ${T.btn} py-3 text-sm flex items-center justify-center`}><Plus size={18} className="inline mr-2"/> {editingPresetId ? 'Update Preset' : 'Save Custom Time'}</button>
            </form>

            <div className="space-y-2 pt-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-[#2A353D] pb-2">Your Custom Shifts</h4>
                {customPresets.length === 0 && <p className="text-xs font-bold text-slate-500 text-center p-4 border border-dashed border-[#2A353D] rounded-xl">No custom times added yet.</p>}
                {customPresets.map(preset => (
                    <div key={preset.id} className="flex justify-between items-center bg-[#12161A] p-3 rounded-lg border border-[#2A353D]">
                        <div>
                            <div className="font-bold text-base text-white">{preset.label}</div>
                            <div className="text-xs font-mono font-bold text-[#D4A381]">{formatShortTime(preset.start)} - {formatShortTime(preset.end)}</div>
                        </div>
                        <div className="flex items-center gap-1 border-l border-[#2A353D] pl-2 ml-2">
                            <button type="button" onClick={() => handleEditPreset(preset)} className="p-2 text-slate-400 hover:text-[#D4A381] transition-colors bg-[#1A2126] rounded border border-[#2A353D]">
                                <Edit size={16}/>
                            </button>
                            <button type="button" onClick={() => handleDeletePreset(preset.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-[#1A2126] rounded border border-[#2A353D]">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </Modal>

{/* TOP NAVIGATION TOGGLE */}
      {!hideSubTabs && (
        <div className="flex flex-wrap gap-2 border-b border-[#2A353D] pb-3 mb-4">
          <button onClick={() => setSubTab('schedule')} className={`px-4 py-2 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all ${subTab === 'schedule' ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>Schedule Builder</button>
          <span className="text-[10px] font-bold text-slate-500 self-center">Labor and punch editing moved to the Labor tab.</span>
        </div>
      )}

      {subTab === 'schedule' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          
          <div className={`${T.card} p-3 sm:p-4 flex flex-col 2xl:flex-row gap-3 items-center justify-between`}>
            <div className="flex flex-wrap xl:flex-nowrap gap-3 w-full 2xl:w-auto items-center">
              
              {/* Staff Selector */}
              <select value={selectedEmp} onChange={e=>{setSelectedEmp(e.target.value); setAssignDates([]);}} className={`${T.input} w-full sm:w-auto sm:flex-1 xl:w-40 py-2.5 px-3 text-sm font-bold h-12 shadow-inner shrink-0`}>
                <option value="">-- Select Staff --</option>
                {displayUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              
              {/* Preset Selector & Edit Button */}
              <div className="flex gap-2 items-center w-full sm:w-auto sm:flex-1 xl:w-auto shrink-0">
                <select value={presetShift} onChange={handlePresetChange} className={`${T.input} w-full py-2.5 px-3 text-sm font-bold h-12 shadow-inner`}>
                  {SHIFT_PRESETS.map(p=><option key={p.label} value={p.label}>{p.label}</option>)}
                </select>
                <button onClick={() => setIsPresetModalOpen(true)} className="px-4 bg-[#12161A] text-slate-400 hover:text-[#D4A381] border border-[#2A353D] rounded-xl transition-colors h-12 flex items-center justify-center shrink-0 shadow-sm" title="Edit Presets">
                  <Edit size={18} />
                </button>
              </div>

        {/* Custom Time Overrides */}
              <div className="flex gap-2 w-full sm:w-auto sm:flex-1 xl:w-auto shrink-0">
                <div className="relative flex-1 xl:w-32">
                    <span className="absolute -top-2.5 left-2 bg-[#1A2126] px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">In</span>
                    <input type="time" value={startTime} onChange={e=>{setStartTime(e.target.value);setPresetShift('Custom');}} className={`${T.input} w-full py-2.5 px-2 text-sm font-bold h-12 shadow-inner`}/>
                </div>
                <div className="relative flex-1 xl:w-32">
                    <span className="absolute -top-2.5 left-2 bg-[#1A2126] px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">Out</span>
                    <input type="time" value={endTime} onChange={e=>{setEndTime(e.target.value);setPresetShift('Custom');}} className={`${T.input} w-full py-2.5 px-2 text-sm font-bold h-12 shadow-inner`}/>
                </div>
              </div>

              {/* Assign Button */}
              <button onClick={handleAssign} disabled={!selectedEmp||assignDates.length===0} className={`w-full xl:w-auto ${T.btn} py-2.5 px-6 text-sm h-12 disabled:opacity-50 flex items-center justify-center shadow-lg shrink-0 whitespace-nowrap`}>Assign ({assignDates.length})</button>

            </div>
            
            {/* Action Row */}
            <div className="flex w-full 2xl:w-auto gap-2 items-center pt-3 2xl:pt-0 border-t 2xl:border-t-0 border-[#2A353D]">
              <div className="hidden sm:flex flex-col items-end mr-3 bg-[#12161A] border border-[#2A353D] px-4 py-1.5 rounded-xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Proj. Month Labor</span>
                <span className="text-emerald-400 font-black text-base">${projectedMonthLabor.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
<button onClick={() => {
                if (appUser?.planType === 'Starter' || appUser?.planType === 'Pro') return addToast('Locked', 'Upgrade to Elite to use Smart Auto-Fill.');
                setIsAutoPopulateModalOpen(true);
              }} className={`flex-1 2xl:flex-none ${T.btnAlt} py-2.5 h-12 flex items-center justify-center font-black ${(appUser?.planType === 'Starter' || appUser?.planType === 'Pro') ? 'opacity-50 text-slate-500 border-[#2A353D]' : 'border-blue-900/50 text-blue-400'}`}>
                <Repeat size={16} className="mr-1"/> {(appUser?.planType === 'Starter' || appUser?.planType === 'Pro') ? '🔒 Auto-Fill' : 'Auto-Fill'}
              </button>              <button onClick={handlePublish} className={`flex-1 2xl:flex-none ${T.btnAlt} py-2.5 h-12 flex items-center justify-center font-black`}>Publish</button>
              <button onClick={openNewEventModal} className={`flex-1 2xl:flex-none ${T.btnAlt} border-[#D4A381] text-[#D4A381] py-2.5 h-12 flex items-center justify-center font-black`}><Plus size={16} className="mr-1"/> Event</button>
            </div>
          </div>

          <div className={`${T.card} w-full overflow-hidden`}>
            <div className="overflow-x-auto w-full no-scrollbar">
              <table className="w-full text-left text-[10px] border-collapse table-fixed min-w-[1200px] xl:min-w-full">
                <thead>
                  <tr className="bg-[#12161A] border-b border-[#2A353D]">
                    <th className={`p-1 sm:p-2 font-bold bg-[#12161A] sticky left-0 z-20 w-16 sm:w-24 border-r border-[#2A353D] ${T.copper} truncate`}>Staff</th>
                    {monthDays.map(d => {
                      const holiday = getHoliday(d);
                      const dayEvents = monthEvents.filter(e => e.date === d);
                      const hasAlert = holiday || dayEvents.length > 0;
                      
                      return (
                      <th key={d} className={`p-0.5 sm:p-1 text-center border-r border-[#2A353D] align-top relative group cursor-help ${new Date(d+'T12:00').getDay()%6===0?'bg-[#1A2126]':''}`}>
                        <div className={`font-bold uppercase text-[8px] sm:text-[9px] ${T.muted}`}>{new Date(d+'T12:00').toLocaleDateString('en-US',{weekday:'narrow'})}</div>
                        <div className={`text-xs sm:text-sm font-black mt-0.5 ${hasAlert ? (holiday ? 'text-amber-400' : 'text-red-400') : 'text-white'}`}>
                          {parseInt(d.split('-')[2])}
                        </div>
                        
                        {hasAlert && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-32 bg-[#1A2126] border border-[#D4A381] text-white text-[10px] p-2 rounded shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 pointer-events-none transition-all">
                            {holiday && <div className="text-amber-400 font-black mb-1 leading-tight">{holiday}</div>}
                            {dayEvents.map(ev => (
                              <div key={ev.id} className="text-red-400 font-bold leading-tight mt-1 border-t border-[#2A353D] pt-1">
                                {ev.title} {ev.time && <span className="block text-white opacity-80">{formatShortTime(ev.time)}</span>}
                                {ev.notes && <span className="block text-slate-300 font-normal mt-0.5">{ev.notes}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </th>
                    )})}
                  </tr>
                </thead>
              <tbody className="divide-y divide-[#2A353D]">
                  {sortedRoles.map(role => (
                    <React.Fragment key={`role-group-${role}`}>
                      <tr className="bg-[#1A2126]">
                        <td colSpan={monthDays.length + 1} className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest ${T.copper} border-b border-[#2A353D] sticky left-0 z-10`}>
                          {role}
                        </td>
                      </tr>
                      {groupedUsers[role].sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(u => (
                        <tr key={u.id} className={selectedEmp===u.id?'bg-[#12161A]/50':''}>
                          <td onClick={()=>{setSelectedEmp(u.id);setAssignDates([]);}} className={`px-2 py-1 text-xs font-bold sticky left-0 z-10 border-r border-[#2A353D] cursor-pointer truncate shadow-sm ${selectedEmp===u.id?`${T.grad} text-slate-900`:'bg-[#1A2126] text-white'}`}>{u.name.split(' ')[0]}</td>
                          {monthDays.map(d => {
                            const shift = monthShifts.find(s=>s.date===d&&s.employeeId===u.id); 
                            const req = timeOffRequests.find(r=>r.date===d&&r.userId===u.id && r.status !== 'pending'); 
                            const sel = assignDates.includes(d) && selectedEmp===u.id;

                            // Conflict Check: Alert if a shift overlaps with ANY time-off request (pending or approved)
                            const allUserReqs = timeOffRequests.filter(r => r.date === d && r.userId === u.id);
                            const hasConflict = shift && allUserReqs.some(r => {
                               if (!r.isPartial) return true; // Full day off conflict
                               return (shift.startTime < (r.endTime || '23:59')) && (shift.endTime > (r.startTime || '00:00'));
                            });

                            return (
                            <td key={d} onClick={()=>handleCellClick(d,u.id)} className={`p-0.5 border-r border-[#2A353D] cursor-pointer transition-all align-top h-7 sm:h-8 ${sel?'bg-[#8F6040] outline outline-2 outline-[#D4A381] shadow-inner z-0 relative':'hover:bg-[#12161A]'}`}>
                            <div className="flex flex-col gap-[1px] w-full justify-start overflow-hidden">
                              {req && !req.isPartial && <div className="w-full rounded font-black text-[7px] sm:text-[8px] py-0.5 text-center text-red-400 bg-red-900/40 uppercase tracking-tighter" title="Requested Off">Off</div>}
                              {req && req.isPartial && <div className="w-full rounded font-black text-[7px] sm:text-[8px] py-0.5 text-center text-amber-400 bg-amber-900/40 uppercase tracking-tighter truncate" title={`Off: ${formatShortTime(req.startTime)}-${formatShortTime(req.endTime)}`}>{formatShortTime(req.startTime)}-{formatShortTime(req.endTime)}</div>}
                              {shift && (
                                <div 
                                  className={`w-full rounded font-bold text-[7px] sm:text-[8px] py-0.5 text-center truncate ${getRoleColors(shift.role, shift.isPublished)} ${hasConflict ? 'border-2 border-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : ''}`} 
                                  title={`${formatShortTime(shift.startTime)} - ${formatShortTime(shift.endTime)} ${hasConflict ? '(CONFLICT DETECTED)' : ''}`}
                                >
                                  {formatShortTime(shift.startTime)}-{formatShortTime(shift.endTime)}
                                </div>
                              )}
                            </div>
                          </td>)
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  <tr className="bg-[#0B0E11] border-t-2 border-[#D4A381]/30">
                    <td className={`px-2 py-2 text-[8px] font-black uppercase tracking-widest text-[#D4A381] sticky left-0 z-10 border-r border-[#2A353D] text-right shadow-md`}>
                      Proj. Cost
                    </td>
                    {monthDays.map(d => (
                      <td key={`cost-${d}`} className={`p-1 border-r border-[#2A353D] text-center align-middle font-black text-[9px] sm:text-[10px] ${projectedDailyLabor[d] > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                        ${projectedDailyLabor[d].toFixed(0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className={`${T.card} overflow-hidden mt-6`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className={`font-black text-sm flex items-center gap-2 ${T.copper}`}><Clock className={T.copper} size={16}/> Scheduled Hours Tracker</h3>
              <span className={`text-[9px] font-bold ${T.muted} uppercase tracking-widest`}>OT Threshold: {appUser?.systemSettings?.overtime || 40}h</span>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-[#1A2126] border-b border-[#2A353D] text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <th className="p-3 border-r border-[#2A353D] sticky left-0 bg-[#1A2126] z-10 w-24">Employee</th>
                    {weeksInMonth.map((w, i) => <th key={i} className="p-3 text-center border-r border-[#2A353D]">Wk {i+1}<div className="text-[7px] text-slate-600 mt-0.5">{parseInt(w[0].split('-')[2])}-{parseInt(w[w.length-1].split('-')[2])}</div></th>)}
                    <th className="p-3 text-center text-[#D4A381]">Month Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A353D]">
                  {scheduledHours.length === 0 && <tr><td colSpan={weeksInMonth.length + 2} className="p-6 text-center text-slate-500 font-bold">No hours scheduled yet.</td></tr>}
                  {scheduledHours.map(u => (
                    <tr key={u.id} className="hover:bg-[#12161A]/50 transition-colors">
                      <td className="p-3 font-bold text-white border-r border-[#2A353D] sticky left-0 bg-[#1A2126] z-10 truncate">{u.name.split(' ')[0]}</td>
                      {u.weekly.map((hrs, i) => (
                        <td key={i} className={`p-3 text-center font-black border-r border-[#2A353D] ${hrs > parseFloat(appUser?.systemSettings?.overtime || 40) ? 'text-red-500 bg-red-900/10' : hrs > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {hrs > 0 ? hrs.toFixed(1) : '-'}
                        </td>
                      ))}
                      <td className="p-3 text-center font-black text-[#D4A381] bg-[#12161A]/30">{u.total.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

{/* --- THE NEW EVENTS LEDGER SUB-TAB --- */}
      {subTab === 'events' && (
        <div className="animate-[slideIn_0.2s_ease-out] space-y-6">
          
          {/* INTERACTIVE CALENDAR */}
          <div className={`${T.card} overflow-hidden shadow-2xl`}>
            <div className={`bg-[#12161A] p-3 border-b ${T.border} flex justify-between items-center`}>
              <button onClick={() => changeEventsMonth(-1)} className={T.btnAlt}><ChevronLeft size={16}/></button>
              <h3 className="font-black text-base text-white tracking-tight">{formatDisplayMonth(eventsCalMonth)}</h3>
              <button onClick={() => changeEventsMonth(1)} className={T.btnAlt}><ChevronRight size={16}/></button>
            </div>
            <div className={`grid grid-cols-7 border-t ${T.border}`}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`py-1.5 text-center text-[9px] font-black ${T.copper} uppercase border-b border-[#2A353D] bg-[#12161A]`}>{d}</div>)}
              {Array.from({length: eventsFirstDayOffset}).map((_,i) => <div key={`empty-${i}`} className={`p-1 border-b border-r ${T.border} bg-[#1A2126] min-h-[45px]`} />)}
              {eventsMonthDays.map(d => {
                const holiday = getHoliday(d);
                const dayEvents = eventsCalEvents.filter(e => e.date === d);

                return (
                  <div key={d} onClick={() => {
                    setEventDate(d); setEventTime(''); setEventTitle(''); setEventNotes(''); setEditingEventId(null); setEventImageFile(null); setIsEventModalOpen(true);
                  }} className={`p-1 border-b border-r ${T.border} min-h-[70px] flex flex-col items-center justify-start pt-1 transition-colors hover:bg-[#12161A]/50 cursor-pointer group`}>
                    <span className={`text-xs font-black ${d === getToday() ? T.copper : 'text-slate-300'}`}>{parseInt(d.split('-')[2])}</span>
                    
                    {holiday && <span className="text-[6px] sm:text-[7px] text-amber-500 font-bold uppercase text-center leading-tight mt-0.5 px-0.5">{holiday}</span>}
                    {dayEvents.map(ev => (
                      <span key={ev.id} className="text-[6px] sm:text-[7px] text-blue-400 font-bold uppercase text-center leading-tight mt-1 px-1 py-0.5 w-full truncate bg-blue-900/20 border border-blue-900/50 rounded" title={ev.title}>
                        {ev.time ? `${formatShortTime(ev.time)} ` : ''}{ev.title}
                      </span>
                    ))}
                    <div className="mt-auto pt-1 opacity-0 group-hover:opacity-100 text-[8px] text-slate-500 font-bold uppercase transition-opacity pb-1">
                      + Add
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex justify-between items-end">
             <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}><Star className={T.copper}/> Events Ledger</h3>
             <button onClick={openNewEventModal} className={`${T.btn} flex items-center justify-center gap-2 py-2 px-4 text-xs`}><Plus size={14}/> Add Event</button>
          </div>

          <div className={`${T.card} overflow-hidden`}>
            <div className={`divide-y ${T.border}`}>
              {eventsCalEvents.length === 0 && <div className={`p-6 text-center text-sm font-bold ${T.muted}`}>No special events scheduled this month.</div>}
              {eventsCalEvents.sort((a,b) => (a.date || '').localeCompare(b.date || '')).map(ev => (
                <div key={ev.id} className={`${T.row} flex flex-col sm:flex-row justify-between sm:items-center gap-4`}>
                  <div className="flex items-start sm:items-center gap-4">
                    <div className={`bg-[#12161A] border ${T.border} ${T.copper} font-black text-center rounded-xl p-2 w-14 shadow-sm flex-shrink-0`}>
                      <div className="text-[10px] uppercase">{new Date(ev.date+'T12:00').toLocaleDateString('en-US',{month:'short'})}</div><div className="text-lg leading-tight">{parseInt(ev.date.split('-')[2])}</div>
                    </div>
                  <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white">{ev.title} {ev.time && <span className="text-[#D4A381] ml-2">@ {formatShortTime(ev.time)}</span>}</h4>
                      {ev.notes && <p className="text-xs text-slate-300 mt-1 font-medium bg-[#12161A] p-2 rounded-lg border border-[#2A353D] whitespace-pre-wrap">{ev.notes}</p>}
                      {ev.imageUrl && (
                        <div className="mt-2 overflow-hidden rounded-xl border border-[#2A353D] shadow-inner bg-[#0B0E11] max-w-sm">
                          <img src={ev.imageUrl} alt="Attached" className="w-full max-h-48 object-contain" />
                        </div>
                      )}
                      <span className={`text-[10px] font-bold ${T.muted} block mt-1`}>Added by {ev.addedBy}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:self-end self-start">
                    <button onClick={() => openEditEventModal(ev)} className="p-2 text-slate-400 hover:text-[#D4A381] transition-colors bg-[#12161A] rounded-lg border border-[#2A353D]"><Edit size={14}/></button>
                    <button onClick={() => { if(window.confirm("Delete event?")) deleteDoc(doc(db,"events",ev.id)); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-[#12161A] rounded-lg border border-[#2A353D]"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

{/* THE TIMESHEET SUB-TAB (Secured & Safed) */}
      {subTab === 'timesheets' && appUser?.isAdmin && (
        <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
          
          <div className={`bg-[#12161A] p-4 border-b ${T.border} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
            <div className="flex items-center gap-4 flex-wrap">
              <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}>Payroll</h3>
              <div className="flex items-center gap-2 bg-[#1A2126] border border-[#2A353D] p-1.5 rounded-lg shadow-inner">
                 <input type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} className="bg-transparent text-[#D4A381] text-xs font-bold outline-none cursor-pointer" />
                 <span className="text-slate-500 font-black text-[10px] uppercase">to</span>
                 <input type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} className="bg-transparent text-[#D4A381] text-xs font-bold outline-none cursor-pointer" />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={openAddPunchModal} className="bg-[#1A2126] border border-[#2A353D] text-slate-300 font-bold px-3 py-1.5 rounded-lg text-xs hover:text-[#D4A381] transition-colors flex items-center gap-2"><Plus size={14}/> Add Punch</button>
              <button onClick={handleExportTimesheets} className="bg-[#1A2126] border border-[#2A353D] text-slate-300 font-bold px-3 py-1.5 rounded-lg text-xs hover:text-emerald-400 transition-colors flex items-center gap-2">📋 Export CSV</button>
              <div className="bg-[#1A2126] border border-[#2A353D] px-3 py-1.5 rounded-lg flex flex-col items-end shadow-sm">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Period Labor</span>
                <span className="text-emerald-400 font-black text-sm">${actualPeriodLabor.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
            </div>
          </div>

{/* TARGETS DASHBOARD */}
          {appUser?.systemSettings?.enableTargets && (
            <div className="bg-[#0B0E11] p-4 border-b border-[#2A353D] flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="flex items-center gap-6">
                 <div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Period Sales</div>
                   <div className="text-lg font-black text-white">${parseFloat(appUser.systemSettings.targetSales || 0).toLocaleString()}</div>
                 </div>
                 <div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Labor %</div>
                   <div className="text-lg font-black text-white">{parseFloat(appUser.systemSettings.targetLaborPct || 0).toFixed(1)}%</div>
                 </div>
                 <div className="border-l border-[#2A353D] pl-6">
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Actual Period Labor %</div>
                   <div className={`text-lg font-black ${((actualPeriodLabor / parseFloat(appUser.systemSettings.targetSales || 1)) * 100) > parseFloat(appUser.systemSettings.targetLaborPct || 100) ? 'text-red-400' : 'text-emerald-400'}`}>
                     {appUser.systemSettings.targetSales > 0 ? ((actualPeriodLabor / parseFloat(appUser.systemSettings.targetSales)) * 100).toFixed(1) : '0.0'}%
                   </div>
                 </div>
              </div>
              <button onClick={() => setIsTargetSettingsOpen(!isTargetSettingsOpen)} className="text-xs font-bold text-slate-400 hover:text-[#D4A381] border border-[#2A353D] bg-[#1A2126] px-3 py-1.5 rounded-lg transition-colors">Configure Targets</button>
            </div>
          )}

          {!appUser?.systemSettings?.enableTargets && (
            <div className="bg-[#0B0E11] p-3 border-b border-[#2A353D] text-right">
              <button onClick={() => setIsTargetSettingsOpen(!isTargetSettingsOpen)} className="text-xs font-bold text-slate-400 hover:text-[#D4A381] transition-colors">Configure Financial Targets</button>
            </div>
          )}

          {isTargetSettingsOpen && (
            <form onSubmit={handleSaveTargets} className="p-4 bg-[#1A2126] border-b border-[#2A353D] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={T.label}>Period Sales Target ($)</label>
                  <input type="number" step="0.01" value={targetSales} onChange={e=>setTargetSales(e.target.value)} className={T.input} placeholder="e.g. 50000" />
                </div>
                <div>
                  <label className={T.label}>Target Labor Cost (%)</label>
                  <input type="number" step="0.1" value={targetLaborPct} onChange={e=>setTargetLaborPct(e.target.value)} className={T.input} placeholder="e.g. 25.5" />
                </div>
              </div>
              <div className="flex gap-2">
                 <button type="submit" className={`flex-1 ${T.btn} py-2 text-xs`}>Save Targets</button>
                 <button type="button" onClick={async () => { await updateDoc(doc(db, "restaurants", appUser.restaurantId), { 'systemSettings.enableTargets': false }); setIsTargetSettingsOpen(false); }} className={`px-4 bg-red-900/20 text-red-500 font-bold text-xs rounded-xl border border-red-900/50 hover:bg-red-900/40 transition-colors`}>Disable</button>
              </div>
            </form>
          )}

{summaryList.length > 0 && (
            <div className="p-4 border-b border-[#2A353D] bg-[#0B0E11]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3">Period Payroll Summary</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {summaryList.map(s => (
                  <div key={s.name} className="bg-[#1A2126] p-3 rounded-xl border border-[#2A353D] flex justify-between items-center shadow-sm hover:border-[#D4A381]/50 transition-colors">
                    <div>
                      <div className="font-bold text-white text-sm">{s.name}</div>
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-0.5">
                        REG: {s.regHours.toFixed(2)}h | OT: {s.otHours.toFixed(2)}h
                      </div>
                      <div className="text-[9px] font-black uppercase text-emerald-500 tracking-widest mt-0.5">
                        TIPS: ${(s.cashTips + s.creditTips).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-[#D4A381] font-black text-lg">${s.pay.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TIME PUNCH FILTERS */}
          <div className={`bg-[#12161A] p-3 border-b ${T.border} flex flex-col sm:flex-row gap-3 justify-between sm:items-center`}>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Filter Punches</h4>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <input type="date" value={punchFilterDate} onChange={e => setPunchFilterDate(e.target.value)} className={`${T.input} py-1.5 px-2 text-xs w-auto flex-1 sm:flex-none`} />
              <select value={punchFilterEmp} onChange={e => setPunchFilterEmp(e.target.value)} className={`${T.input} py-1.5 px-2 text-xs w-auto flex-1 sm:flex-none`}>
                <option value="">All Staff</option>
                {users.filter(u => u.isActive !== false).sort((a,b) => a.name.localeCompare(b.name)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {(punchFilterDate || punchFilterEmp) && <button onClick={() => { setPunchFilterDate(''); setPunchFilterEmp(''); }} className="p-1.5 text-slate-400 hover:text-red-400 border border-[#2A353D] bg-[#1A2126] rounded-lg transition-colors"><X size={14}/></button>}
            </div>
          </div>

          <div className={`divide-y ${T.border}`}>
            {periodPunches.filter(p => (punchFilterDate ? p.date === punchFilterDate : true) && (punchFilterEmp ? p.employeeId === punchFilterEmp : true)).length === 0 && <div className={`p-6 text-center text-sm font-bold ${T.muted}`}>No clock-ins found for this selection.</div>}
            
            {periodPunches.filter(p => (punchFilterDate ? p.date === punchFilterDate : true) && (punchFilterEmp ? p.employeeId === punchFilterEmp : true)).sort((a,b) => new Date(b.clockInTime || 0) - new Date(a.clockInTime || 0)).map(p => {
               const emp = users.find(u => u.id === p.employeeId);
               const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
               const cost = hours * (emp?.wage || 0);
               const isClockedIn = p.status === 'clocked_in' || p.status === 'on_break';
               
               const safeIn = p.clockInTime ? formatClockTime(p.clockInTime) : 'ERR';
               const safeOut = isClockedIn ? '---' : (p.clockOutTime ? formatClockTime(p.clockOutTime) : 'ERR');
               
               return (
                 <div key={p.id} className={`${T.row} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
                   <div>
<div className="font-bold text-white text-base">
  {p.employeeName || 'Unknown'}
  {p.isUnscheduled && !p.isApproved && <span className="ml-2 text-[8px] bg-amber-500 text-slate-900 px-1.5 py-0.5 rounded-sm uppercase tracking-widest font-black align-middle">Unscheduled</span>}
</div>                     <div className={`text-[10px] font-black uppercase tracking-widest ${T.muted} mt-0.5`}>
                       {p.date ? formatDisplayDate(p.date) : 'Unknown Date'}
                     </div>
                   </div>
                   <div className="flex items-center gap-6">
                     <div className="text-right">
                       <div className="text-xs font-mono text-slate-300">
                         <span className="text-emerald-400">IN:</span> {safeIn}
                       </div>
                       <div className="text-xs font-mono text-slate-300">
                         <span className="text-red-400">OUT:</span> {safeOut}
                       </div>
                     </div>
                     <div className="text-right border-l border-[#2A353D] pl-6 w-24">
                       <div className={`text-sm font-black ${isClockedIn ? 'text-amber-400 animate-pulse' : 'text-white'}`}>{isClockedIn ? 'ON CLOCK' : `${hours.toFixed(2)} hrs`}</div>
                       <div className="text-[10px] font-black text-[#D4A381] uppercase tracking-widest">${cost.toFixed(2)}</div>
                     </div>
                     <div className="flex gap-2 border-l border-[#2A353D] pl-4">
                       {isClockedIn && <button onClick={() => handleForceClockOut(p)} className="px-3 py-1 bg-red-900/20 text-red-500 text-[10px] font-black uppercase rounded-lg border border-red-900/50 hover:bg-red-900/40 transition-colors">Force Out</button>}
    {p.isUnscheduled && !p.isApproved && <button onClick={() => updateDoc(doc(db, "timePunches", p.id), { isApproved: true })} className="px-3 py-1 bg-amber-900/20 text-amber-400 text-[10px] font-black uppercase rounded-lg border border-amber-900/50 hover:bg-amber-900/40 transition-colors animate-pulse">Approve</button>}
                       <button onClick={() => openEditPunchModal(p)} className="p-2 text-slate-400 hover:text-[#D4A381] bg-[#12161A] rounded-lg border border-[#2A353D] transition-colors"><Edit size={14}/></button>
                       <button onClick={() => handleDeletePunch(p.id)} className="p-2 text-slate-400 hover:text-red-500 bg-[#12161A] rounded-lg border border-[#2A353D] transition-colors"><Trash2 size={14}/></button>
                     </div>
                   </div>
                 </div>
               )
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const TabMonth = ({ currentDate, users, shifts, appUser }) => {
  const [roleFilter, setRoleFilter] = useState('All');
  const uniqueRoles = ['All', ...new Set(users.map(u => u.role).filter(Boolean))].sort();

  const monthStr = getMonthStr(currentDate); 
  const firstDay = new Date(monthStr+'-01T12:00:00').getDay(); 
  const days = getDaysInMonth(monthStr);
  
  // Calculate how many weeks this month spans to perfectly stretch the grid rows on paper
  const totalCells = firstDay + days;
  const weeks = Math.ceil(totalCells / 7);

  return (
    <div className={`${T.card} overflow-hidden print-container`}>
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.25in; }
          body * { visibility: hidden; }
          
          /* Hijack the entire printed page */
          .print-container, .print-container * { visibility: visible; }
          .print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            display: flex !important;
            flex-direction: column !important;
            background: white !important;
            z-index: 999999 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: hidden !important; 
            page-break-inside: avoid !important;
          }
          
          .no-print { display: none !important; }
          
          /* The Header */
          .print-header { 
            display: block !important; 
            text-align: center !important; 
            font-size: 22px !important; 
            font-weight: 900 !important; 
            color: black !important; 
            margin-top: 0 !important;
            margin-bottom: 8px !important; 
            text-transform: uppercase !important; 
            height: 30px !important;
          }
          
          /* The Grid - Stretches to fill exact remaining space on the paper */
          .print-grid {
            flex-grow: 1 !important;
            display: grid !important;
            grid-template-rows: 25px repeat(${weeks}, 1fr) !important;
            border-top: 2px solid black !important;
            border-left: 2px solid black !important;
            height: calc(100vh - 45px) !important; /* Math: 100% minus the header
 height to prevent page 2 bleed */
            max-height: calc(100vh - 45px) !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
          }
          
          /* The Cells */
          .cell {
            border-right: 2px solid black !important;
            border-bottom: 2px solid black !important;
            background: white !important;
            color: black !important;
            min-height: 0 !important;
            padding: 3px !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
          }
          
          .cell-header-text { color: black !important; font-size: 11px !important; font-weight: 900 !important; }
          .cell-date { font-size: 13px !important; font-weight: 900 !important; color: black !important; margin-bottom: 2px !important; }
          
          /* The Shifts */
          .print-shift {
            background: #f8fafc !important;
            color: black !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 4px !important;
            padding: 1px 4px !important;
            font-size: 9px !important;
            font-weight: 900 !important;
            margin-bottom: 2px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
          }
        }
      `}</style>
      
<div className="flex justify-between items-center p-2 no-print border-b border-[#2A353D] bg-[#12161A]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:inline">Filter Role:</span>
    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-[#1A2126] border border-[#2A353D] text-[#D4A381] text-xs font-bold rounded-lg px-2 py-1.5 outline-none cursor-pointer shadow-inner">
            <option value="All">Whole Schedule</option>
            <option value="ME">My Shifts Only</option>
            {uniqueRoles.filter(r => r !== 'All').map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button onClick={()=>window.print()} className={T.btnAlt}>🖨️ Print Calendar</button>
      </div>
      
      <div className="hidden print:block print-header">
        86chaos Schedule {roleFilter !== 'All' ? `- ${roleFilter}` : ''}   {formatDisplayMonth(monthStr)}
      </div>

      <div className={`grid grid-cols-7 border-t border-l ${T.border} print-grid`}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`p-1 bg-[#12161A] text-center font-black text-[10px] ${T.copper} border-b border-r ${T.border} uppercase cell`}><span className="print-text-dark cell-header-text">{d}</span></div>)}
        
        {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`} className={`bg-[#12161A]/50 border-b border-r ${T.border} min-h-[50px] cell`}/>)}
        
{Array.from({length:days}).map((_,i)=>{
          const date = `${monthStr}-${String(i+1).padStart(2,'0')}`; 
          const dayShifts = shifts
            .filter(s => s.date === date && s.isPublished && (roleFilter === 'All' || (roleFilter === 'ME' ? s.employeeId === appUser?.id : s.role === roleFilter)))
            .sort((a, b) => {
              if (a.role !== b.role) return (a.role || '').localeCompare(b.role || '');
              return (a.startTime || '').localeCompare(b.startTime || '');
            });
          return (
            <div key={date} className={`p-0.5 border-b border-r ${T.border} min-h-[50px] flex flex-col cell`}>
              <span className={`text-right text-[9px] font-black ${T.muted} mb-0.5 cell-date`}>{i+1}</span>
              <div className="space-y-0.5 overflow-y-auto no-scrollbar flex-1">
                {dayShifts.map(s=>(
                  <div key={s.id} className={`text-[8px] font-bold px-0.5 rounded leading-tight truncate bg-[#12161A] border ${T.border} ${s.role==='Bartender'?'text-blue-400':'text-orange-400'} print-shift`}>
                    {users.find(u=>u.id===s.employeeId)?.name.split(' ')[0]} {formatShortTime(s.startTime)}-{formatShortTime(s.endTime)}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

const TabTimeOff = ({ timeOffRequests, appUser, users, addToast, events = [] }) => {
  const [calMonth, setCalMonth] = useState(getToday().substring(0, 7)); 
  const [selectedDates, setSelectedDates] = useState([]); 
  const [isPartial, setIsPartial] = useState(false); 
  const [startTime, setStartTime] = useState('09:00'); 
  const [endTime, setEndTime] = useState('17:00');

  const myRequests = timeOffRequests.filter(r => r.userId === appUser.id).sort((a,b) => new Date(a.date) - new Date(b.date)); 
  const myFutureRequests = myRequests.filter(r => r.date >= getToday());
  const allFutureRequests = timeOffRequests.filter(r => r.date >= getToday()).sort((a,b) => new Date(a.date) - new Date(b.date));
  
  const monthDays = Array.from({length: getDaysInMonth(calMonth)}).map((_, i) => `${calMonth}-${String(i+1).padStart(2, '0')}`); 
  const firstDayOffset = new Date(calMonth+'-01T12:00:00').getDay();

const monthEvents = events.filter(e => e.type === 'special_event' && e.date?.startsWith(calMonth));
  const changeMonth = (offset) => { 
    const d = new Date(calMonth + '-01T12:00:00'); d.setMonth(d.getMonth() + offset); setCalMonth(d.toISOString().substring(0, 7)); 
  };

  const handleToggleDate = (d) => { 
    if (d < getToday()) return addToast('Locked', 'Cannot request past dates.'); 
    
    const existingReq = myRequests.find(r => r.date === d); 
    if (existingReq) { 
      if (window.confirm(`Cancel your time-off request for ${formatDisplayDate(d)}?`)) {
        deleteDoc(doc(db, "timeOffRequests", existingReq.id));
        addToast('Canceled', 'Time off request removed.');
      }
      return; 
    } 
    
    setSelectedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); 
  };
  
  const handleSubmit = async (e) => { 
    e.preventDefault(); 
    if (selectedDates.length === 0) return addToast('Error', 'Select days on the calendar first.'); 
    if (isPartial && (!startTime || !endTime)) return addToast('Error', 'Please set partial times.'); 
    
    const currentMonth = getToday().substring(0, 7);

    for (const d of selectedDates) { 
      const reqMonth = d.substring(0, 7);
      const needsApproval = reqMonth <= currentMonth;

      await addDoc(collection(db, "timeOffRequests"), { 
        userId: appUser.id, userName: appUser.name, date: d, isPartial, startTime: isPartial ? startTime : null, endTime: isPartial ? endTime : null, submittedAt: new Date().toISOString(), restaurantId: appUser.restaurantId,
        status: needsApproval ? 'pending' : 'approved'
      }); 
    } 
    addToast('Recorded', `Logged ${selectedDates.length} days off.`); 
    setSelectedDates([]); 
    setIsPartial(false); 
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {appUser?.isAdmin && (
        <div className={`${T.card} overflow-hidden mb-6`}>
          <div className={`bg-[#12161A] p-3 border-b ${T.border} flex justify-between items-center`}>
            <h3 className="font-black text-sm text-white flex items-center gap-2"><Shield size={14} className="text-red-500"/> Master Override Log</h3>
            <span className={`text-[10px] font-bold ${T.muted}`}>Approve or delete requests.</span>
          </div>
          <div className={`max-h-48 overflow-y-auto custom-scrollbar divide-y ${T.border}`}>
            {allFutureRequests.length === 0 && <div className={`p-4 text-center text-xs font-bold ${T.muted}`}>No upcoming time off for any staff.</div>}
            {allFutureRequests.map(r => (
              <div key={r.id} className={T.row}>
                <div className="flex-1">
                  <div className="font-black text-sm text-white leading-tight">{r.userName}</div>
          <div className={`text-[10px] font-bold ${T.muted} mt-0.5 flex flex-wrap items-center gap-2`}>
                    {formatDisplayDate(r.date)} {r.isPartial && <span className={`text-[#D4A381] bg-[#12161A] border ${T.border} px-1 rounded`}>({formatShortTime(r.startTime)} - {formatShortTime(r.endTime)})</span>}
                    {r.status === 'pending' && <span className="bg-orange-900/40 text-orange-400 border border-orange-900/50 px-1.5 py-0.5 rounded uppercase tracking-widest text-[8px]">Pending</span>}
                    {r.submittedAt && <span className="text-slate-500 border-l border-[#2A353D] pl-2 ml-1">Req: {formatClockDateTime(r.submittedAt)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === 'pending' && (
                    <button onClick={() => updateDoc(doc(db, "timeOffRequests", r.id), { status: 'approved' })} className="text-slate-400 hover:text-emerald-500 p-1.5 bg-[#12161A] border border-[#2A353D] rounded"><Check size={14}/></button>
                  )}
                  <button onClick={() => { if(window.confirm("Force delete this request?")) deleteDoc(doc(db,"timeOffRequests",r.id)); }} className="text-slate-400 hover:text-red-500 p-1.5 bg-[#12161A] border border-[#2A353D] rounded"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`md:col-span-2 ${T.card} overflow-hidden`}>
          <div className={`bg-[#12161A] p-3 border-b ${T.border} flex justify-between items-center`}>
            <button onClick={() => changeMonth(-1)} className={T.btnAlt}><ChevronLeft size={16}/></button>
            <h3 className="font-black text-base text-white tracking-tight">{formatDisplayMonth(calMonth)}</h3>
            <button onClick={() => changeMonth(1)} className={T.btnAlt}><ChevronRight size={16}/></button>
          </div>
          <div className={`grid grid-cols-7 border-t ${T.border}`}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`py-1.5 text-center text-[9px] font-black ${T.copper} uppercase border-b border-[#2A353D] bg-[#12161A]`}>{d}</div>)}
            {Array.from({length: firstDayOffset}).map((_,i) => <div key={`empty-${i}`} className={`p-1 border-b border-r ${T.border} bg-[#1A2126] min-h-[45px]`} />)}
            {monthDays.map(d => {
              const isSelected = selectedDates.includes(d); 
              const existingReq = myRequests.find(r => r.date === d); 
              const isPast = d < getToday();
              const holiday = getHoliday(d);
              const dayEvents = monthEvents.filter(e => e.date === d);

              return (
                <div key={d} onClick={() => !isPast && handleToggleDate(d)} className={`p-1 border-b border-r ${T.border} min-h-[50px] flex flex-col items-center justify-start pt-1 transition-colors ${isPast ? 'bg-[#12161A]/50 opacity-50 cursor-not-allowed' : existingReq ? 'bg-red-900/10 cursor-pointer hover:bg-red-900/20 border border-red-900/30 shadow-inner' : isSelected ? 'bg-[#8F6040]/20 border border-[#C59373] cursor-pointer shadow-inner' : 'hover:bg-[#12161A] cursor-pointer'}`}>
                  <span className={`text-xs font-black ${isSelected ? T.copper : existingReq ? 'text-red-400' : 'text-slate-300'}`}>{parseInt(d.split('-')[2])}</span>
                  
                  {holiday && <span className="text-[6px] sm:text-[7px] text-amber-500 font-bold uppercase text-center leading-tight mt-0.5 px-0.5">{holiday}</span>}
                  {dayEvents.map(ev => (
                    <span key={ev.id} className="text-[6px] sm:text-[7px] text-blue-400 font-bold uppercase text-center leading-tight mt-0.5 px-0.5 w-full truncate" title={ev.title}>
                      {ev.title}
                    </span>
                  ))}

                  {existingReq && <span className={`text-[7px] font-black uppercase mt-auto mb-1 ${existingReq.status === 'pending' ? 'text-orange-400' : 'text-red-500'}`}>{existingReq.status === 'pending' ? 'Pend' : 'Off'}</span>}
                  {isSelected && <Check size={10} className={`mt-auto mb-1 ${T.copper}`}/>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="md:col-span-1">
          <div className={`${T.card} p-4 sm:p-5 sticky top-20`}>
            <h3 className="font-black text-base mb-1 text-white">Log Availability</h3>
            <p className={`text-[10px] font-bold ${T.muted} mb-4 leading-tight`}>Tap days on the calendar to mark yourself unavailable.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className={`flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer p-2.5 bg-[#12161A] rounded-xl border ${T.border}`}>
                <input type="checkbox" checked={isPartial} onChange={e=>setIsPartial(e.target.checked)} className="w-4 h-4 rounded bg-[#1A2126] border-[#2A353D] accent-[#8F6040]" />
                Partial Day Only?
              </label>
              {isPartial && (
              <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={T.label}>Start Time</label>
                        <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className={T.input} required />
                    </div>
                    <div>
                        <label className={T.label}>End Time</label>
                        <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className={T.input} required />
                    </div>
                </div>
              )}
              <button type="submit" disabled={selectedDates.length === 0} className={`w-full ${T.btn} disabled:opacity-50 disabled:cursor-not-allowed`}>Submit {selectedDates.length > 0 ? `(${selectedDates.length})` : ''}</button>
            </form>

            <div className="mt-6 pt-6 border-t border-[#2A353D]">
              <h3 className="font-black text-sm text-white mb-3">My Pending Requests</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {myFutureRequests.length === 0 && <div className="text-xs font-bold text-slate-500 text-center py-2 border border-dashed border-[#2A353D] rounded-xl">No upcoming requests.</div>}
                {myFutureRequests.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-[#12161A] p-2.5 rounded-xl border border-[#2A353D] hover:border-[#D4A381]/50 transition-colors">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        {formatDisplayDate(r.date)}
                        {r.status === 'pending' && <span className="bg-orange-900/40 text-orange-400 border border-orange-900/50 px-1 rounded uppercase tracking-widest text-[8px]">Pending</span>}
                      </div>
             {r.isPartial ? (
                        <div className="text-[9px] text-[#D4A381] font-black uppercase tracking-wider mt-0.5">{formatShortTime(r.startTime)} - {formatShortTime(r.endTime)}</div>
                      ) : (
                        <div className="text-[9px] text-red-400 font-black uppercase tracking-wider mt-0.5">Full Day Off</div>
                      )}
                      {r.submittedAt && <div className="text-[9px] font-bold text-slate-500 mt-1">Submitted: {formatClockDateTime(r.submittedAt)}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => { if(window.confirm(`Cancel your request for ${formatDisplayDate(r.date)}?`)) deleteDoc(doc(db,"timeOffRequests",r.id)); }}
                      className="text-slate-400 hover:text-red-500 p-2 transition-colors bg-[#1A2126] rounded-lg border border-[#2A353D]"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

const TabScheduleWorkbench = ({ currentDate, users, shifts, events, timeOffRequests, timePunches, addToast, appUser }) => (
  <div className="space-y-5">
    <ScheduleCopilot currentDate={currentDate} users={users} shifts={shifts} timeOffRequests={timeOffRequests} addToast={addToast} appUser={appUser} />
    <TabSchedule currentDate={currentDate} users={users} shifts={shifts} events={events} timeOffRequests={timeOffRequests} timePunches={timePunches} addToast={addToast} appUser={appUser} />
  </div>
);

const ScheduleCopilot = ({ currentDate, users = [], shifts = [], timeOffRequests = [], addToast, appUser }) => {
  const templates = useLiveCollection('scheduleTemplates', appUser?.restaurantId, { limitCount: 120 });
  const coverageTargets = useLiveCollection('scheduleCoverageTargets', appUser?.restaurantId, { limitCount: 200 });
  const weekDates = getWeekDates(currentDate);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const weekShifts = shifts.filter(s => weekDates.includes(s.date));
  const activeUsers = users.filter(u => u.isActive !== false);
  const [open, setOpen] = useState(true);
  const [activeTool, setActiveTool] = useState('targets');
  const [templateId, setTemplateId] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateName, setTemplateName] = useState('Normal Week');
  const [templateDesc, setTemplateDesc] = useState('Reusable staffing pattern for this restaurant.');
  const [templateRows, setTemplateRows] = useState([{ dayIndex: 5, role: 'Cook', startTime: '16:00', endTime: '21:00', count: 2 }]);
  const restaurantRoles = Array.from(new Set((activeUsers || []).map(u => u.role).filter(Boolean))).sort();
  const [targetForm, setTargetForm] = useState({ dayIndex: 5, role: restaurantRoles[0] || 'Cook', startTime: '16:00', endTime: '21:00', count: 2 });
  useEffect(() => { if (restaurantRoles.length && !restaurantRoles.includes(targetForm.role)) setTargetForm(prev => ({ ...prev, role: restaurantRoles[0] })); }, [restaurantRoles.join('|')]);
  const [draggedShiftId, setDraggedShiftId] = useState(null);

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const templateOptions = templates.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  const activeTemplate = templates.find(t => t.id === templateId) || null;
  const draftCount = weekShifts.filter(s => !s.isPublished).length;
  const conflictList = getScheduleWarnings(weekShifts, users, timeOffRequests, weekDates);
  const missingTargets = coverageTargets.flatMap(t => {
    const date = weekDates[parseInt(t.dayIndex || 0, 10)];
    const existing = weekShifts.filter(s => s.date === date && roleMatches(s.role, t.role) && (!t.startTime || s.startTime === t.startTime)).length;
    const needed = Math.max(0, (parseInt(t.count || 0,10) || 0) - existing);
    return needed > 0 ? [{ ...t, date, needed, existing }] : [];
  });

  function getScheduleWarnings(schedule, allUsers, requests, dates) {
    const warnings = [];
    schedule.forEach(s => {
      const emp = allUsers.find(u => u.id === s.employeeId);
      const off = requests.find(r => (r.userId === s.employeeId || r.employeeId === s.employeeId) && r.date === s.date && ['approved','Accepted','approved_by_manager'].includes(String(r.status || '').toLowerCase()));
      if (off) warnings.push(`${emp?.name || 'Someone'} is scheduled on requested-off date ${formatDisplayDate(s.date)}.`);
    });
    allUsers.forEach(u => {
      const count = schedule.filter(s => s.employeeId === u.id).length;
      if (count >= 6) warnings.push(`${u.name} has ${count} scheduled days this week.`);
    });
    dates.forEach(d => {
      const cooks = schedule.filter(s => s.date === d && roleMatches(s.role, 'Cook')).length;
      if (cooks === 0) warnings.push(`No cook coverage on ${formatDisplayDate(d)}.`);
    });
    return [...new Set(warnings)].slice(0, 12);
  }

  const addTemplateRow = () => setTemplateRows([...templateRows, { dayIndex: 5, role: 'Cook', startTime: '16:00', endTime: '21:00', count: 1 }]);
  const updateTemplateRow = (idx, patch) => setTemplateRows(templateRows.map((r,i) => i === idx ? { ...r, ...patch } : r));
  const removeTemplateRow = (idx) => setTemplateRows(templateRows.filter((_,i) => i !== idx));

  const saveTemplate = async (e) => {
    e.preventDefault();
    const payload = { restaurantId: appUser.restaurantId, name: templateName.trim(), description: templateDesc.trim(), rows: templateRows.map(r => ({ ...r, dayIndex: parseInt(r.dayIndex,10), count: parseInt(r.count,10) || 1 })), updatedAt: new Date().toISOString(), updatedBy: appUser.name || appUser.email };
    try {
      if (editingTemplateId) { await updateDoc(doc(db, 'scheduleTemplates', editingTemplateId), payload); addToast('Template Updated', 'Schedule template saved.'); }
      else { await addDoc(collection(db, 'scheduleTemplates'), { ...payload, createdAt: new Date().toISOString(), createdBy: appUser.id || 'manager' }); addToast('Template Created', 'Reusable schedule template added.'); }
      setEditingTemplateId(null); setTemplateName('Normal Week'); setTemplateDesc('Reusable staffing pattern for this restaurant.'); setTemplateRows([{ dayIndex: 5, role: 'Cook', startTime: '16:00', endTime: '21:00', count: 2 }]); setActiveTool('templates');
    } catch (err) { addToast('Error', err.message); }
  };

  const editTemplate = (t) => { setEditingTemplateId(t.id); setTemplateName(t.name || 'Template'); setTemplateDesc(t.description || ''); setTemplateRows((t.rows && t.rows.length ? t.rows : [{ dayIndex: 5, role: 'Cook', startTime: '16:00', endTime: '21:00', count: 1 }])); setActiveTool('template-editor'); };
  const deleteTemplate = async (t) => { if (!window.confirm(`Delete template "${t.name}"?`)) return; try { await deleteDoc(doc(db, 'scheduleTemplates', t.id)); addToast('Deleted', 'Template removed.'); } catch(err) { addToast('Error', err.message); } };

  const saveCurrentWeekAsTemplate = async () => {
    const grouped = {};
    weekShifts.forEach(s => { const key = `${new Date(s.date+'T12:00:00').getDay()}|${s.role || 'Staff'}|${s.startTime || '09:00'}|${s.endTime || '17:00'}`; grouped[key] = (grouped[key] || 0) + 1; });
    const rows = Object.entries(grouped).map(([key,count]) => { const [dayIndex, role, startTime, endTime] = key.split('|'); return { dayIndex: parseInt(dayIndex,10), role, startTime, endTime, count }; });
    if (!rows.length) return addToast('No Shifts', 'Build a week first, then save it as a template.');
    try { await addDoc(collection(db, 'scheduleTemplates'), { restaurantId: appUser.restaurantId, name: `Week of ${formatDisplayDate(weekStart)}`, description: 'Saved from actual schedule.', rows, createdAt: new Date().toISOString(), createdBy: appUser.id || 'manager' }); addToast('Saved', 'Current week saved as a reusable template.'); }
    catch(err) { addToast('Error', err.message); }
  };

  const pickUserForShift = (role, date, usedIds = []) => {
    const candidates = activeUsers.filter(u => !usedIds.includes(u.id)).filter(u => roleMatches(u.role, role));
    const pool = candidates.length ? candidates : activeUsers.filter(u => !usedIds.includes(u.id));
    return pool.find(u => !timeOffRequests.some(r => (r.userId === u.id || r.employeeId === u.id) && r.date === date && String(r.status || '').toLowerCase().includes('approved'))) || pool[0];
  };

  const createShiftDraft = async (row, date, usedIds = []) => {
    const employee = pickUserForShift(row.role, date, usedIds);
    await addDoc(collection(db, 'shifts'), { restaurantId: appUser.restaurantId, employeeId: employee?.id || '', employeeName: employee?.name || 'Unassigned', role: row.role || employee?.role || 'Staff', date, startTime: row.startTime || '09:00', endTime: row.endTime || '17:00', isPublished: false, createdAt: new Date().toISOString(), createdBy: appUser.id || 'schedule-copilot', source: 'schedule_copilot' });
    return employee?.id;
  };

  const applyTemplate = async () => {
    if (!activeTemplate) return addToast('Choose Template', 'Select a template first.');
    if (!window.confirm(`Apply "${activeTemplate.name}" to week of ${formatDisplayDate(weekStart)}? New shifts are added as drafts.`)) return;
    try {
      let made = 0;
      for (const row of (activeTemplate.rows || [])) {
        const date = weekDates[parseInt(row.dayIndex || 0, 10)];
        const used = weekShifts.filter(s => s.date === date).map(s => s.employeeId);
        for (let i=0; i < (parseInt(row.count || 1,10) || 1); i++) { const id = await createShiftDraft(row, date, used); if (id) used.push(id); made++; }
      }
      addToast('Template Applied', `${made} draft shifts created. Review and publish when ready.`);
    } catch (err) { addToast('Error', err.message); }
  };

  const copyPreviousWeek = async () => {
    const prevDates = weekDates.map(d => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() - 7); return formatDate(x); });
    const prevShifts = shifts.filter(s => prevDates.includes(s.date));
    if (!prevShifts.length) return addToast('No Previous Week', 'No shifts found in the previous week.');
    if (!window.confirm(`Copy ${prevShifts.length} shifts from previous week as drafts?`)) return;
    try {
      let made = 0;
      for (const s of prevShifts) {
        const oldIndex = prevDates.indexOf(s.date);
        const date = weekDates[oldIndex];
        if (weekShifts.some(x => x.date === date && x.employeeId === s.employeeId && x.startTime === s.startTime)) continue;
        await addDoc(collection(db, 'shifts'), { restaurantId: appUser.restaurantId, employeeId: s.employeeId, employeeName: s.employeeName || users.find(u => u.id === s.employeeId)?.name || 'Unknown', role: s.role, date, startTime: s.startTime, endTime: s.endTime, isPublished: false, copiedFrom: s.id, createdAt: new Date().toISOString(), createdBy: appUser.id || 'copy-week' });
        made++;
      }
      addToast('Copied', `${made} draft shifts copied from previous week.`);
    } catch(err) { addToast('Error', err.message); }
  };

  const addCoverageTarget = async (e) => {
    e.preventDefault();
    try { await addDoc(collection(db, 'scheduleCoverageTargets'), { restaurantId: appUser.restaurantId, ...targetForm, dayIndex: parseInt(targetForm.dayIndex,10), count: parseInt(targetForm.count,10) || 1, createdAt: new Date().toISOString(), createdBy: appUser.id || 'manager' }); addToast('Target Added', 'Coverage target saved for this restaurant.'); }
    catch(err) { addToast('Error', err.message); }
  };

  const smartFill = async () => {
    if (!missingTargets.length) return addToast('Covered', 'No missing coverage targets for this week.');
    if (!window.confirm(`Smart Fill will create ${missingTargets.reduce((s,m)=>s+m.needed,0)} draft shifts. Continue?`)) return;
    try {
      let made = 0;
      for (const m of missingTargets) {
        const used = weekShifts.filter(s => s.date === m.date).map(s => s.employeeId);
        for (let i=0; i<m.needed; i++) { const id = await createShiftDraft(m, m.date, used); if (id) used.push(id); made++; }
      }
      addToast('Smart Fill Complete', `${made} draft shifts created from coverage targets.`);
    } catch(err) { addToast('Error', err.message); }
  };

  const publishWeek = async () => {
    const drafts = weekShifts.filter(s => !s.isPublished);
    if (!drafts.length) return addToast('Nothing To Publish', 'No draft shifts found this week.');
    const warningText = [...missingTargets.map(m => `${dayNames[m.dayIndex]} ${m.role}: short ${m.needed}`), ...conflictList].slice(0,8).join('\n');
    if (!window.confirm(`Publish ${drafts.length} draft shifts?${warningText ? '\n\nWarnings:\n' + warningText : ''}`)) return;
    try { await Promise.all(drafts.map(s => updateDoc(doc(db, 'shifts', s.id), { isPublished: true, publishedAt: new Date().toISOString(), publishedBy: appUser.id || 'manager' }))); addToast('Published', `${drafts.length} shifts published.`); }
    catch(err) { addToast('Error', err.message); }
  };

  const moveShiftToDay = async (targetDate) => {
    if (!draggedShiftId || !targetDate) return;
    const shift = weekShifts.find(s => s.id === draggedShiftId);
    setDraggedShiftId(null);
    if (!shift) return;
    try {
      await updateDoc(doc(db, 'shifts', shift.id), { date: targetDate, updatedAt: new Date().toISOString(), updatedBy: appUser.id || 'schedule-drag-board' });
      addToast('Shift Moved', `${shift.employeeName || 'Shift'} moved to ${formatDisplayDate(targetDate)}.`);
    } catch (err) { addToast('Error', err.message); }
  };

  const quickUpdateShift = async (shift, patch) => {
    try {
      const next = { ...patch, updatedAt: new Date().toISOString(), updatedBy: appUser.id || 'schedule-quick-edit' };
      if (patch.employeeId) {
        const emp = users.find(u => u.id === patch.employeeId);
        next.employeeName = emp?.name || shift.employeeName || 'Unknown';
        next.role = emp?.role || shift.role || 'Staff';
      }
      await updateDoc(doc(db, 'shifts', shift.id), next);
      addToast('Shift Updated', 'Schedule quick edit saved.');
    } catch (err) { addToast('Error', err.message); }
  };

  if (!open) return <button onClick={() => setOpen(true)} className={`${T.btnAlt} w-full flex items-center justify-center gap-2`}><ChefHat size={15}/> Open Schedule Copilot</button>;

  return (
    <div className={`${T.card} p-4 space-y-4 border-[#D4A381]/30`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div><div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381]">Schedule Copilot</div><h3 className="text-xl font-black text-white">Templates, Coverage, Smart Fill & Publish Preview</h3><p className="text-xs text-slate-400 font-bold">Week of {formatDisplayDate(weekStart)} through {formatDisplayDate(weekEnd)}. Templates and coverage targets are saved per restaurant.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={copyPreviousWeek} className={T.btnAlt}>Copy Previous Week</button><button onClick={smartFill} className={T.btnAlt}>Smart Fill</button><button onClick={publishWeek} className={`${T.btn} py-2`}>Publish Preview</button><button onClick={() => setOpen(false)} className={T.btnAlt}>Hide</button></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><StatusTile label="Drafts" value={draftCount}/><StatusTile label="Missing Targets" value={missingTargets.length}/><StatusTile label="Warnings" value={conflictList.length}/><StatusTile label="Templates" value={templates.length}/></div>
      <div className="flex flex-wrap gap-2 border-b border-[#2A353D] pb-2">{[['targets','Coverage Targets'],['templates','Templates'],['template-editor', editingTemplateId ? 'Edit Template' : 'Create Template'],['drag','Drag Board'],['warnings','Warnings']].map(([id,label]) => <button key={id} onClick={() => setActiveTool(id)} className={`px-3 py-2 rounded-xl text-[10px] uppercase tracking-widest font-black ${activeTool===id ? `${T.grad} text-slate-900` : 'bg-[#12161A] text-slate-400 hover:text-white'}`}>{label}</button>)}</div>
      {activeTool === 'targets' && <div className="grid lg:grid-cols-2 gap-4"><form onSubmit={addCoverageTarget} className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 space-y-2"><h4 className="font-black text-white">Add Coverage Target</h4><div className="grid grid-cols-2 gap-2"><select value={targetForm.dayIndex} onChange={e=>setTargetForm({...targetForm, dayIndex:e.target.value})} className={T.input}>{dayNames.map((d,i)=><option key={d} value={i}>{d}</option>)}</select><select value={targetForm.role} onChange={e=>setTargetForm({...targetForm, role:e.target.value})} className={T.input}>{restaurantRoles.length === 0 && <option value="Cook">Cook</option>}{restaurantRoles.map(r => <option key={r} value={r}>{r}</option>)}</select><input type="time" value={targetForm.startTime} onChange={e=>setTargetForm({...targetForm, startTime:e.target.value})} className={T.input}/><input type="time" value={targetForm.endTime} onChange={e=>setTargetForm({...targetForm, endTime:e.target.value})} className={T.input}/><input type="number" min="1" value={targetForm.count} onChange={e=>setTargetForm({...targetForm, count:e.target.value})} className={T.input}/><button className={`${T.btn} py-2`}>Save Target</button></div></form><div className="space-y-2">{coverageTargets.length === 0 ? <FriendlyEmpty title="No coverage targets yet" text="Add targets like Friday dinner: 2 cooks, 3 servers, 1 bartender. Smart Fill uses these."/> : coverageTargets.map(t => <div key={t.id} className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 flex justify-between items-center"><div><div className="font-black text-white">{dayNames[t.dayIndex]} • {t.role} x{t.count}</div><div className="text-xs text-slate-400 font-bold">{formatShortTime(t.startTime)} - {formatShortTime(t.endTime)}</div></div><button onClick={() => deleteDoc(doc(db,'scheduleCoverageTargets',t.id))} className="p-2 text-slate-400 hover:text-red-400"><Trash2 size={14}/></button></div>)}</div></div>}
      {activeTool === 'templates' && <div className="space-y-3"><div className="flex flex-col md:flex-row gap-2"><select value={templateId} onChange={e => setTemplateId(e.target.value)} className={`${T.input} flex-1`}><option value="">Select template to apply</option>{templateOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><button onClick={applyTemplate} className={`${T.btn} py-2`}>Apply to Current Week</button><button onClick={saveCurrentWeekAsTemplate} className={T.btnAlt}>Save Current Week</button></div>{templateOptions.length === 0 ? <FriendlyEmpty title="No templates yet" text="Create a Normal Week, Packers Sunday, Fish Fry Friday, or Live Music template. Each restaurant gets its own library."/> : templateOptions.map(t => <div key={t.id} className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 flex justify-between items-center"><div><div className="font-black text-white">{t.name}</div><div className="text-xs text-slate-400 font-bold">{t.description || 'No description'} • {(t.rows || []).length} rules</div></div><div className="flex gap-2"><button onClick={() => editTemplate(t)} className={T.btnAlt}>Edit</button><button onClick={() => deleteTemplate(t)} className="px-3 py-2 rounded-xl bg-red-900/20 text-red-300 border border-red-900/50 text-xs font-black">Delete</button></div></div>)}</div>}
      {activeTool === 'template-editor' && <form onSubmit={saveTemplate} className="space-y-3"><div className="grid md:grid-cols-2 gap-2"><input value={templateName} onChange={e=>setTemplateName(e.target.value)} className={T.input} placeholder="Template name" required/><input value={templateDesc} onChange={e=>setTemplateDesc(e.target.value)} className={T.input} placeholder="Description"/></div><div className="space-y-2">{templateRows.map((r,idx)=><div key={idx} className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-[#12161A] border border-[#2A353D] rounded-xl p-2"><select value={r.dayIndex} onChange={e=>updateTemplateRow(idx,{dayIndex:e.target.value})} className={T.input}>{dayNames.map((d,i)=><option key={d} value={i}>{d}</option>)}</select><select value={r.role} onChange={e=>updateTemplateRow(idx,{role:e.target.value})} className={T.input}>{restaurantRoles.length === 0 && <option value={r.role || 'Cook'}>{r.role || 'Cook'}</option>}{restaurantRoles.map(roleName => <option key={roleName} value={roleName}>{roleName}</option>)}</select><input type="time" value={r.startTime} onChange={e=>updateTemplateRow(idx,{startTime:e.target.value})} className={T.input}/><input type="time" value={r.endTime} onChange={e=>updateTemplateRow(idx,{endTime:e.target.value})} className={T.input}/><input type="number" min="1" value={r.count} onChange={e=>updateTemplateRow(idx,{count:e.target.value})} className={T.input}/><button type="button" onClick={()=>removeTemplateRow(idx)} className="bg-red-900/20 border border-red-900/50 text-red-300 rounded-xl font-black text-xs">Remove</button></div>)}</div><div className="flex gap-2"><button type="button" onClick={addTemplateRow} className={T.btnAlt}>Add Row</button><button type="submit" className={`${T.btn} py-2`}>{editingTemplateId ? 'Update Template' : 'Create Template'}</button></div></form>}
      {activeTool === 'drag' && <div className="space-y-3"><p className="text-xs text-slate-400 font-bold">Drag shifts between days on desktop, or use the Move to day dropdown on mobile. Quick edit controls can change employee/time without opening the big schedule grid.</p><div className="grid md:grid-cols-7 gap-2">{weekDates.map((date, dayIdx) => <div key={date} onDragOver={e => e.preventDefault()} onDrop={() => moveShiftToDay(date)} className="min-h-[160px] bg-[#12161A] border border-[#2A353D] rounded-xl p-2"><div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mb-2">{dayNames[dayIdx]}<br/><span className="text-slate-500">{date.substring(5)}</span></div>{weekShifts.filter(s => s.date === date).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||'')).map(shift => <div key={shift.id} draggable onDragStart={() => setDraggedShiftId(shift.id)} onDragEnd={() => setDraggedShiftId(null)} className={`mb-2 rounded-lg border p-2 cursor-move ${draggedShiftId === shift.id ? 'border-[#D4A381] bg-[#D4A381]/10' : 'border-[#2A353D] bg-[#1A2126]'}`}><div className="font-black text-white text-xs truncate">{shift.employeeName || users.find(u=>u.id===shift.employeeId)?.name || 'Unassigned'}</div><div className="text-[9px] text-slate-400 font-bold uppercase">{shift.role} • {formatShortTime(shift.startTime)}-{formatShortTime(shift.endTime)}</div><div className="grid grid-cols-1 gap-1 mt-2"><select value="" onChange={e=>e.target.value && quickUpdateShift(shift,{date:e.target.value})} className="bg-[#12161A] border border-[#2A353D] rounded-md px-1.5 py-1 text-[10px] text-[#D4A381] outline-none md:hidden"><option value="">Move to day...</option>{weekDates.map((d,i)=><option key={d} value={d}>{dayNames[i]} {d.substring(5)}</option>)}</select><select value={shift.employeeId || ''} onChange={e=>quickUpdateShift(shift,{employeeId:e.target.value})} className="bg-[#12161A] border border-[#2A353D] rounded-md px-1.5 py-1 text-[10px] text-white outline-none"><option value="">Unassigned</option>{activeUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select><div className="flex gap-1"><input type="time" defaultValue={shift.startTime || '09:00'} onBlur={e=>e.target.value && quickUpdateShift(shift,{startTime:e.target.value})} className="w-full bg-[#12161A] border border-[#2A353D] rounded-md px-1 py-1 text-[10px] text-white"/><input type="time" defaultValue={shift.endTime || '17:00'} onBlur={e=>e.target.value && quickUpdateShift(shift,{endTime:e.target.value})} className="w-full bg-[#12161A] border border-[#2A353D] rounded-md px-1 py-1 text-[10px] text-white"/></div></div></div>)}{weekShifts.filter(s => s.date === date).length === 0 && <div className="border border-dashed border-[#2A353D] rounded-lg p-3 text-center text-[10px] font-bold text-slate-500">Drop shifts here</div>}</div>)}</div></div>}
      {activeTool === 'warnings' && <div className="grid md:grid-cols-2 gap-3"><div>{missingTargets.length === 0 ? <FriendlyEmpty title="Coverage targets met" text="No target gaps found for the current week."/> : missingTargets.map(m => <div key={`${m.id}-${m.date}`} className="bg-amber-900/10 border border-amber-900/40 rounded-xl p-3 mb-2"><div className="font-black text-amber-300">{formatDisplayDate(m.date)} needs {m.needed} more {m.role}</div><div className="text-xs text-slate-400">Existing: {m.existing} • Target: {m.count}</div></div>)}</div><div>{conflictList.length === 0 ? <FriendlyEmpty title="No conflicts found" text="No schedule warning dragons spotted this week."/> : conflictList.map((w,i)=><div key={i} className="bg-red-900/10 border border-red-900/40 rounded-xl p-3 mb-2 text-sm font-bold text-red-200">{w}</div>)}</div></div>}
    </div>
  );
};

export { TabMasterSchedule, TabSchedule, TabMonth, TabTimeOff, TabScheduleWorkbench, ScheduleCopilot };
