import React, { useState, useEffect, useMemo } from 'react';

// ==========================================
// SEED DATA & INITIAL STATES (Cheers Brand)
// ==========================================
const INITIAL_TEAM = [
  { id: 'emp-1', name: 'Geoffrey Michaels', role: 'Master Admin', displayRole: 'Admin', phone: '920-555-0141', wage: 32.50, isOwner: true },
  { id: 'emp-2', name: 'Jane S.', role: 'Line Cook', displayRole: 'Line Cook', phone: '920-555-0188', wage: 18.00, isOwner: false },
  { id: 'emp-3', name: 'Marcus V.', role: 'Bartender', displayRole: 'Bartender', phone: '920-555-0199', wage: 12.00, isOwner: false },
];

const INITIAL_SHIFTS = [
  { id: 's-1', employeeId: 'emp-1', date: '2026-06-13', startTime: '16:00', endTime: '00:00', label: 'CLOSE', role: 'Chef' },
  { id: 's-2', employeeId: 'emp-2', date: '2026-06-13', startTime: '16:00', endTime: '23:00', label: 'Line Cook', role: 'Kitchen' },
  { id: 's-3', employeeId: 'emp-3', date: '2026-06-12', startTime: '17:00', endTime: '02:00', label: 'CLOSE', role: 'Bar' }, // Past Date
];

const INITIAL_PREP = [
  { id: 'p-1', name: 'Smoked Brisket Portions', station: 'BBQ / Pit' },
  { id: 'p-2', name: 'House Marinara Base', station: 'Italian / Sauté' },
  { id: 'p-3', name: 'Day-Dot Garlic Butter', station: 'Prep Line' },
];

const INITIAL_RECIPES = [
  { id: 'r-1', name: 'Texas Style Mop Sauce', yieldAmt: '4 Quarts', station: 'BBQ', ingredients: ['Apple Cider Vinegar - 2 Cups', 'Brown Sugar - 1/2 Cup', 'Black Pepper - 2 tbsp'] },
  { id: 'r-2', name: 'Cheers Signature Burger Seasoning', yieldAmt: '1 Gallon', station: 'Prep Line', ingredients: ['Kosher Salt - 4 Cups', 'Smoked Paprika - 2 Cups', 'Garlic Powder - 1 Cup'] },
];

export default function App() {
  // Global Application State
  const [currentTab, setCurrentTab] = useState('schedule'); // UI context from 6187.png bottom navigation
  const [currentSubTab, setCurrentSubTab] = useState('my-schedule'); // Top-level contextual navigation sub-tabs
  const [isDarkMode, setIsDarkMode] = useState(true); // Default high-contrast dark environment
  const [currentUser, setCurrentUser] = useState(INITIAL_TEAM[0]); // Logged in profile context
  
  // Roster, Scheduling, & Data States
  const [team, setTeam] = useState(INITIAL_TEAM);
  const [shifts, setShifts] = useState(INITIAL_SHIFTS);
  const [prepItems, setPrepItems] = useState(INITIAL_PREP);
  const [recipes, setRecipes] = useState(INITIAL_RECIPES);
  
  // Date tracking for Prep state isolation
  const [selectedPrepDate, setSelectedPrepDate] = useState('2026-06-13');
  const [prepCompletions, setPrepCompletions] = useState({}); // Shape: { 'date-itemId': true }
  
  // Time Clock & Attendance Management
  const [timecards, setTimecards] = useState([
    { id: 'tc-1', employeeId: 'emp-3', date: '2026-06-12', clockIn: '16:55', clockOut: '02:15', notes: 'Stayed late to close down bar lines after late rush', flags: [], gpsDistance: 45, approved: true }
  ]);
  const [showClockModal, setShowClockModal] = useState(false);
  const [showGeofenceNoteModal, setShowGeofenceNoteModal] = useState(false);
  const [simulatedOffPremises, setSimulatedOffPremises] = useState(false);
  const [geofenceNote, setGeofenceNote] = useState('');
  
  // Schedule Editing Controls
  const [selectedScheduleDate, setSelectedScheduleDate] = useState('2026-06-13');
  const [showHistoricalWarning, setShowHistoricalWarning] = useState(false);
  
  // Financial Control Navigation State
  const [opsSubTab, setOpsSubTab] = useState('sales');
  const [selectedFinancialWeek, setSelectedFinancialWeek] = useState('Week 24 - June 2026');

  // Recipe Editing State
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);

  // Global Settings Controls Panel (Section 9)
  const [globalSettings, setGlobalSettings] = useState({
    parLevelForecasting: true,
    prepStationSorting: true,
    managerApprovalRequired: true,
    maxOffPerStation: 2,
    geofenceRadiusFeet: 200,
    gpsEnforcementPolicy: 'warning', // 'hard-block' | 'warning' | 'silent'
    earlyPunchBoundaryMinutes: 15,
    missedOutBoundaryHours: 2,
    pushOnGhostShift: true,
    pushOnImportantMessage: true,
  });

  // Message Board Feed States
  const [messages, setMessages] = useState([
    { id: 'm-1', sender: 'Geoffrey Michaels', body: 'Reminder: PFG order forms must be completed before Sunday at 9 AM.', timestamp: '10:15 AM', important: true },
    { id: 'm-2', sender: 'Jane S.', body: 'Anyone able to grab my shift Friday at 8 PM?', timestamp: 'Yesterday', important: false }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [messageIsImportant, setMessageIsImportant] = useState(false);

  // Visual Theme Tokens extracted from 6187.png
  const copperGradient = "bg-gradient-to-r from-[#C59373] to-[#8F6040]";
  const copperText = "text-[#D4A381]";
  const darkCard = "bg-[#1A2126] border border-[#2A353D]";
  const darkBackground = "bg-[#12161A] text-slate-100";
  const lightBackground = "bg-slate-50 text-slate-900";

  // Automatic Weekly Payroll Engine Logic (Section 5 & 6)
  const calculatedPayroll = useMemo(() => {
    return team.map(member => {
      const memberTimecards = timecards.filter(tc => tc.employeeId === member.id && tc.approved);
      let totalMinutes = 0;
      memberTimecards.forEach(tc => {
        const [inH, inM] = tc.clockIn.split(':').map(Number);
        const [outH, outM] = tc.clockOut.split(':').map(Number);
        let diffMin = (outH * 60 + outM) - (inH * 60 + inM);
        if (diffMin < 0) diffMin += 24 * 60; // Handle cross-midnight clockouts
        totalMinutes += diffMin;
      });
      const totalHours = totalMinutes / 60;
      const grossPay = totalHours * member.wage;
      return { ...member, totalHours: totalHours.toFixed(2), grossPay: grossPay.toFixed(2) };
    });
  }, [timecards, team]);

  // Handle Geofence Soft Punching Flow
  const handleClockPunchAttempt = () => {
    if (simulatedOffPremises && globalSettings.gpsEnforcementPolicy === 'warning') {
      setShowGeofenceNoteModal(true);
    } else if (simulatedOffPremises && globalSettings.gpsEnforcementPolicy === 'hard-block') {
      alert("Punch Failed. You must be on restaurant premises to clock in/out.");
    } else {
      executePunch('In Bounds', 12);
    }
  };

  const executePunch = (noteText, distance) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0].substring(0, 5);
    
    const newPunch = {
      id: `tc-${Date.now()}`,
      employeeId: currentUser.id,
      date: todayStr,
      clockIn: timeStr,
      clockOut: '23:30', // Mock automated punch out frame for validation
      notes: noteText || 'Standard Shift Punch',
      flags: distance > globalSettings.geofenceRadiusFeet ? ['OFF_SITE'] : [],
      gpsDistance: distance,
      approved: distance > globalSettings.geofenceRadiusFeet ? false : true // drops to admin queue if offsite
    };
    
    setTimecards([newPunch, ...timecards]);
    setShowClockModal(false);
    setShowGeofenceNoteModal(false);
    setGeofenceNote('');
    alert(`Punch registered successfully at ${timeStr}!`);
  };

  // Safe History Modification Hook (Section 6)
  const handleScheduleDateClick = (dateStr) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr < todayStr) {
      setSelectedScheduleDate(dateStr);
      setShowHistoricalWarning(true);
    } else {
      setSelectedScheduleDate(dateStr);
    }
  };

  // Back-Button History hijack simulation for Label Printing view (Section 4)
  useEffect(() => {
    const handlePrintBackHijack = () => {
      // Logic inside real browser window popstate routing target context:
      // window.history.pushState({ noBackExits: true }, '');
    };
    window.addEventListener('popstate', handlePrintBackHijack);
    return () => window.removeEventListener('popstate', handlePrintBackHijack);
  }, []);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${isDarkMode ? darkBackground : lightBackground}`}>
      
      {/* GLOBAL SHELL APP VIEW CONTAINER */}
      <div className="max-w-md mx-auto min-h-screen flex flex-col justify-between shadow-2xl relative border-x border-[#2A353D]/30 bg-[#12161A]">
        
        {/* HEADER BRAND LAYER CONTAINER */}
        <header className="px-6 pt-6 pb-2 flex justify-between items-center bg-[#12161A]/95 sticky top-0 z-40 backdrop-blur-md">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {currentTab === 'schedule' && "Schedule"}
              {currentTab === 'prep' && "Kitchen Prep"}
              {currentTab === 'messaging' && "Messaging Feed"}
              {currentTab === 'ops' && "Operations Center"}
              {currentTab === 'settings' && "Global Config"}
            </h1>
            <p className="text-xs text-slate-400">Cheers Bar & Grill • Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Quick Multi-Tenant Config Toggle */}
            <button 
              onClick={() => setCurrentTab(currentTab === 'settings' ? 'schedule' : 'settings')}
              className="p-2 rounded-full bg-[#1A2126] text-slate-400 border border-[#2A353D] hover:text-[#D4A381]"
            >
              ⚙️
            </button>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="p-2 rounded-full bg-[#1A2126] text-slate-400 border border-[#2A353D]"
              title="Audit Light/Dark Contrast Profile"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* SECTION 7: CRITICAL MESSAGE BANNER COMPONENT */}
        {messages.some(m => m.important) && (
          <div className="mx-4 my-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#7A4F31]/40 to-[#1A2126] border border-[#B88764]/40 flex items-start gap-3 animate-pulse">
            <span className="text-lg">🔔</span>
            <div className="flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#D4A381]">CRITICAL SYSTEM ANNOUNCEMENT</span>
              <p className="text-sm text-slate-200 font-medium">
                {messages.find(m => m.important)?.body}
              </p>
            </div>
          </div>
        )}

        {/* MAIN APPLICATION CORE CORE CONTAINER INTERFACE PORTAL */}
        <main className="flex-1 px-4 py-2 overflow-y-auto pb-24">
          
          {/* ==========================================
              TAB LAYOUT LAYER 1: SCHEDULE CONTROL CENTER
             ========================================== */}
          {currentTab === 'schedule' && (
            <div>
              {/* SUB NAV PILL HOVER STRINGS */}
              <div className="flex justify-between items-center gap-1 mb-4 overflow-x-auto pb-1">
                {['my-schedule', 'full-schedule', 'month-view', 'time-off'].map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setCurrentSubTab(sub)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all capitalize whitespace-nowrap ${
                      currentSubTab === sub 
                        ? `${copperGradient} text-slate-900 shadow-md font-bold` 
                        : 'bg-[#1A2126] text-slate-400 border border-[#2A353D]'
                    }`}
                  >
                    {sub.replace('-', ' ')}
                  </button>
                ))}
              </div>

              {/* ACTION VIEW CONTENT: INDIVIDUAL ACCOUNT LANDING HERO SCREEN */}
              {currentSubTab === 'my-schedule' && (
                <div className="space-y-4">
                  
                  {/* PERFECT IMAGE MOCK REPLICATION CONTAINER BLOCK ("My Schedule" Copper Hero) */}
                  <div className={`p-6 rounded-2xl bg-gradient-to-br from-[#C59373] to-[#8F6040] text-slate-900 shadow-xl border border-[#D4A381]/30 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-7xl font-bold">86</div>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-900/70">UPCOMING SHIFT ASSIGNMENT</span>
                        <h3 className="text-2xl font-black tracking-tight mt-1">Chef Michaels</h3>
                        <p className="text-sm font-semibold opacity-90 mt-2 flex items-center gap-1">
                          📅 Today • 4:00 PM - 12:00 AM <span className="bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded ml-1">CLOSE</span>
                        </p>
                      </div>
                      <div className="p-3 bg-slate-900/10 rounded-full">📍</div>
                    </div>

                    {/* NATIVE INTEGRATED TIME CLOCK TRIGGER CAPABILITY ACTION BAR */}
                    <div className="mt-6">
                      <button 
                        onClick={() => setShowClockModal(true)}
                        className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all text-sm tracking-wider uppercase"
                      >
                        ⏱️ ACCESS SECURE TIME CLOCK
                      </button>
                    </div>
                  </div>

                  {/* QUICK CONTEXT INTERACTIONS ENGINE BAR */}
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setCurrentSubTab('time-off')} className={`p-4 rounded-xl ${darkCard} text-center hover:bg-[#2A353D] transition-all`}>
                      <span className="block text-xl mb-1">📅</span>
                      <span className="text-xs font-semibold text-slate-300">Request Off</span>
                    </button>
                    <button onClick={() => alert("Trade Matrix Initiated")} className={`p-4 rounded-xl ${darkCard} text-center hover:bg-[#2A353D] transition-all`}>
                      <span className="block text-xl mb-1">🔄</span>
                      <span className="text-xs font-semibold text-slate-300">Offer Up Shift</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ACTION VIEW CONTENT: COMPREHENSIVE TEAM VIEW MATRIX */}
              {currentSubTab === 'full-schedule' && (
                <div className={`${darkCard} rounded-xl p-4 space-y-4`}>
                  <div className="flex justify-between items-center border-b border-[#2A353D] pb-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Roster Deployment Schedule</h3>
                    <input 
                      type="date" 
                      value={selectedScheduleDate} 
                      onChange={(e) => handleScheduleDateClick(e.target.value)}
                      className="bg-[#12161A] border border-[#2A353D] rounded-lg text-xs p-2 text-white" 
                    />
                  </div>
                  
                  <div className="divide-y divide-[#2A353D]/50">
                    {shifts.filter(s => s.date === selectedScheduleDate).map(shift => {
                      const staff = team.find(t => t.id === shift.employeeId);
                      return (
                        <div key={shift.id} className="py-3 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-bold text-white">{staff?.name}</p>
                            <p className="text-xs text-slate-400">{shift.role} • {shift.label}</p>
                          </div>
                          <span className={`text-xs px-3 py-1 font-mono rounded-lg bg-[#12161A] text-slate-300 border border-[#2A353D]`}>
                            {shift.startTime} - {shift.endTime}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ACTION VIEW CONTENT: TIME OFF TRACKING SUB COMPONENT */}
              {currentSubTab === 'time-off' && (
                <div className="space-y-4">
                  <div className={`${darkCard} rounded-xl p-4`}>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Request Time Off Logs</h3>
                    <div className="space-y-2">
                      <div className="p-3 bg-[#12161A] rounded-lg border border-[#2A353D] flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold text-white">July 4th Holiday Block</p>
                          <p className="text-xs text-slate-400">July 04 - July 06</p>
                        </div>
                        <span className="text-[10px] font-bold tracking-widest uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-1 rounded">PENDING</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => alert("Form initialized")} className={`w-full py-3 ${copperGradient} text-slate-900 font-bold rounded-xl text-xs uppercase tracking-wider`}>
                    + Create New Time Off Request
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ==========================================
              TAB LAYOUT LAYER 2: KITCHEN OPERATIONS
             ========================================== */}
          {currentTab === 'prep' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <input 
                  type="date" 
                  value={selectedPrepDate}
                  onChange={(e) => setSelectedPrepDate(e.target.value)}
                  className="bg-[#1A2126] border border-[#2A353D] rounded-xl text-xs p-2 text-white"
                />
                <span className="text-xs text-[#D4A381] font-mono">Date Isolation Matrix Active</span>
              </div>

              {/* PREP LIST INTERACTIVE COMPONENT WITH COMPLETION ISOLATION */}
              <div className={`${darkCard} rounded-xl p-4`}>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Station Sorted Prep Requirements</h3>
                <div className="space-y-2">
                  {prepItems.map(item => {
                    const uniqueKey = `${selectedPrepDate}-${item.id}`;
                    const isDone = !!prepCompletions[uniqueKey];
                    return (
                      <div key={item.id} className="flex justify-between items-center p-3 bg-[#12161A] rounded-lg border border-[#2A353D]">
                        <div>
                          <p className={`text-sm font-semibold ${isDone ? 'line-through text-slate-500' : 'text-white'}`}>{item.name}</p>
                          <p className="text-xs text-[#D4A381] font-mono">{item.station}</p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={isDone}
                          onChange={(e) => setPrepCompletions({...prepCompletions, [uniqueKey]: e.target.checked})}
                          className="w-5 h-5 rounded border-[#2A353D] text-[#8F6040] focus:ring-[#8F6040] bg-[#1A2126]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RECIPE BOX MANAGEMENT ROW SYSTEM */}
              <div className={`${darkCard} rounded-xl p-4`}>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Corporate Yield Multiplier Master</h3>
                <div className="space-y-2">
                  {recipes.map(recipe => (
                    <div key={recipe.id} className="p-3 bg-[#12161A] rounded-lg border border-[#2A353D] flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-white">{recipe.name}</p>
                        <p className="text-xs text-slate-400">Standard Yield: {recipe.yieldAmt} • Station: {recipe.station}</p>
                      </div>
                      <button 
                        onClick={() => { setEditingRecipe(recipe); setShowRecipeModal(true); }}
                        className="text-xs font-bold text-[#D4A381] hover:underline"
                      >
                        Edit Specs
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              TAB LAYOUT LAYER 3: COMMUNICATIONS HUB
             ========================================== */}
          {currentTab === 'messaging' && (
            <div className="space-y-4 flex flex-col justify-between h-[70vh]">
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {messages.map(msg => (
                  <div key={msg.id} className={`p-4 rounded-xl border ${msg.important ? 'bg-gradient-to-r from-[#7A4F31]/30 to-[#1A2126] border-[#B88764]/40' : 'bg-[#1A2126] border-[#2A353D]'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-[#D4A381]">{msg.sender}</span>
                      <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                    </div>
                    <p className="text-sm text-slate-200">{msg.body}</p>
                    {msg.important && <span className="inline-block mt-2 text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">SYSTEM BROADCAST PUSHED</span>}
                  </div>
                ))}
              </div>

              {/* MESSAGING INPUT CONTROLLER PANEL */}
              <div className="bg-[#1A2126] p-3 rounded-xl border border-[#2A353D] space-y-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Broadcast message to team..."
                  className="w-full bg-[#12161A] border border-[#2A353D] rounded-lg text-sm p-3 text-slate-200 focus:outline-none focus:border-[#B88764]"
                  rows={2}
                />
                <div className="flex justify-between items-center">
                  <label className="flex items-center gap-2 text-xs text-slate-300 select-none cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={messageIsImportant}
                      onChange={(e) => setMessageIsImportant(e.target.checked)}
                      className="rounded bg-[#12161A] border-[#2A353D] text-red-600 focus:ring-0"
                    />
                    🔥 Flag as System Critical (Triggers FCM Push Alert)
                  </label>
                  <button 
                    onClick={() => {
                      if(!newMessage.trim()) return;
                      setMessages([...messages, { id: `m-${Date.now()}`, sender: currentUser.name, body: newMessage, timestamp: 'Now', important: messageIsImportant }]);
                      setNewMessage('');
                      setMessageIsImportant(false);
                    }}
                    className={`px-4 py-2 ${copperGradient} text-slate-900 font-bold text-xs rounded-lg uppercase tracking-wider`}
                  >
                    Send Feed
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              TAB LAYOUT LAYER 4: OPERATIONS COMMAND CENTER
             ========================================== */}
          {currentTab === 'ops' && (
            <div className="space-y-4">
              <div className="flex gap-1 overflow-x-auto pb-1 border-b border-[#2A353D]">
                {['sales', 'attendance', 'payroll', 'pnl'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setOpsSubTab(tab)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-t-lg capitalize transition-all ${opsSubTab === tab ? 'border-t-2 border-[#D4A381] bg-[#1A2126] text-white' : 'text-slate-400'}`}
                  >
                    {tab === 'pnl' ? 'P&L Metrics' : tab}
                  </button>
                ))}
              </div>

              {/* SUB TAB: WEEKLY SALES CHART DISPLAY (SECTION 5) */}
              {opsSubTab === 'sales' && (
                <div className={`${darkCard} rounded-xl p-4 space-y-4`}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase text-slate-400">Weekly Target Tracker</span>
                    <select value={selectedFinancialWeek} onChange={(e) => setSelectedFinancialWeek(e.target.value)} className="bg-[#12161A] text-white text-xs border border-[#2A353D] p-1 rounded">
                      <option>Week 24 - June 2026</option>
                      <option>Week 23 - June 2026</option>
                    </select>
                  </div>
                  
                  {/* SLEEK PROFESSIONAL CSS BAR GRAPH SIMULATOR */}
                  <div className="h-32 flex items-end justify-between gap-2 pt-6 px-2 bg-[#12161A] rounded-xl border border-[#2A353D]/60">
                    {[
                      { day: 'M', amt: '4.2k', h: '40%' }, { day: 'T', amt: '3.9k', h: '35%' },
                      { day: 'W', amt: '5.1k', h: '55%' }, { day: 'T', amt: '6.8k', h: '70%' },
                      { day: 'F', amt: '11.4k', h: '95%' }, { day: 'S', amt: '12.1k', h: '100%' },
                      { day: 'S', amt: '5.5k', h: '60%' }
                    ].map((bar, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                        <span className="text-[9px] text-slate-400 absolute -top-5 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 px-1 rounded text-white">{bar.amt}</span>
                        <div style={{ height: bar.h }} className={`w-full rounded-t ${copperGradient} opacity-80 hover:opacity-100 transition-all shadow-md`} />
                        <span className="text-[10px] text-slate-400 mt-2 font-mono">{bar.day}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-3 bg-[#12161A] rounded-lg border border-[#2A353D]"><p className="text-slate-400">Gross Period Sales</p><p className="text-lg font-bold text-white">$49,000</p></div>
                    <div className="p-3 bg-[#12161A] rounded-lg border border-[#2A353D]"><p className="text-slate-400">Projected Target</p><p className="text-lg font-bold text-[#D4A381]">$45,000</p></div>
                  </div>
                </div>
              )}

              {/* SUB TAB: ADMIN ATTENDANCE EXCEPTION QUEUE LAYER (SECTION 6 & 8) */}
              {opsSubTab === 'attendance' && (
                <div className="space-y-2">
                  <div className={`${darkCard} rounded-xl p-4 mb-2`}>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Exception Verification Inbox</h4>
                  </div>
                  {timecards.map(tc => {
                    const emp = team.find(t => t.id === tc.employeeId);
                    return (
                      <div key={tc.id} className={`p-4 rounded-xl ${darkCard} bg-[#1A2126] flex flex-col space-y-3`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-sm font-bold text-white">{emp?.name}</h4>
                            <p className="text-xs text-slate-400">Date Logged: {tc.date} ({tc.clockIn} - {tc.clockOut})</p>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {tc.flags.includes('OFF_SITE') && <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">OFF-SITE AUDIT PING ({tc.gpsDistance}ft)</span>}
                            {tc.approved ? <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">APPROVED PUNCH</span> : <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded">AWAITING VERIFICATION</span>}
                          </div>
                        </div>
                        {tc.notes && <div className="p-2 bg-[#12161A] rounded text-xs text-slate-300 italic border-l-2 border-[#B88764]">Reason: "{tc.notes}"</div>}
                        {!tc.approved && (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => {
                              setTimecards(timecards.map(t => t.id === tc.id ? {...t, approved: true} : t));
                              alert("Timecard entry approved to payroll cycle ledger.");
                            }} className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded">Approve Punch</button>
                            <button onClick={() => alert("Modification matrix activated")} className="px-3 py-1 bg-slate-700 text-slate-200 text-xs font-bold rounded">Adjust Coordinates</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SUB TAB: COMPREHENSIVE PAYROLL CALCULATOR OVERVIEW (SECTION 5) */}
              {opsSubTab === 'payroll' && (
                <div className={`${darkCard} rounded-xl p-4 space-y-4`}>
                  <div className="flex justify-between items-center border-b border-[#2A353D] pb-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Payroll Cycle Output Ledger</h3>
                    <span className="text-[10px] bg-slate-900 border border-[#2A353D] text-[#D4A381] px-2 py-1 rounded font-mono">Cycle Loop: Mon - Sun</span>
                  </div>
                  <div className="divide-y divide-[#2A353D]/40">
                    {calculatedPayroll.map(pay => (
                      <div key={pay.id} className="py-3 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-white">{pay.name} <span className="text-[10px] text-slate-400 font-normal">(${pay.wage}/hr)</span></p>
                          <p className="text-xs text-slate-400">Total Validated Context Hours: {pay.totalHours} hrs</p>
                        </div>
                        <p className="text-sm font-mono font-bold text-white">${pay.grossPay}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==========================================
              TAB LAYOUT LAYER 5: MULTI-TENANT CONFIGURATION
             ========================================== */}
          {currentTab === 'settings' && (
            <div className={`${darkCard} rounded-xl p-4 space-y-4`}>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2A353D] pb-2">SaaS Customization Engine (Section 9)</h3>
              
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-2">GPS Verification Enforcement Rule Profile</label>
                  <select 
                    value={globalSettings.gpsEnforcementPolicy}
                    onChange={(e) => setGlobalSettings({...globalSettings, gpsEnforcementPolicy: e.target.value})}
                    className="w-full bg-[#12161A] border border-[#2A353D] text-slate-200 rounded-lg p-2"
                  >
                    <option value="warning">Soft Warning (Accept + Text Explanation + Offsite Indicator Alert)</option>
                    <option value="hard-block">Hard Fence Limit Restrict (Block Entire Request Execution)</option>
                    <option value="silent">Silent Audit Logging Mode</option>
                  </select>
                </div>

                <div className="flex justify-between items-center p-2 bg-[#12161A] rounded-lg border border-[#2A353D]">
                  <span className="text-slate-300">Station Sorted Prep View Layout</span>
                  <input 
                    type="checkbox" 
                    checked={globalSettings.prepStationSorting}
                    onChange={(e) => setGlobalSettings({...globalSettings, prepStationSorting: e.target.checked})}
                    className="rounded text-[#8F6040] bg-[#1A2126] border-[#2A353D]"
                  />
                </div>

                <div className="flex justify-between items-center p-2 bg-[#12161A] rounded-lg border border-[#2A353D]">
                  <span className="text-slate-300">Automated Par Level Forecasting Matrix</span>
                  <input 
                    type="checkbox" 
                    checked={globalSettings.parLevelForecasting}
                    onChange={(e) => setGlobalSettings({...globalSettings, parLevelForecasting: e.target.checked})}
                    className="rounded text-[#8F6040] bg-[#1A2126] border-[#2A353D]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Time Clock Auto Red Flag Clock-Out Threshold</label>
                  <input 
                    type="number"
                    value={globalSettings.missedOutBoundaryHours}
                    onChange={(e) => setGlobalSettings({...globalSettings, missedOutBoundaryHours: Number(e.target.value)})}
                    className="bg-[#12161A] border border-[#2A353D] text-white p-2 rounded-lg w-full"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Hours passed shift scheduled termination before throwing exception alert flag.</span>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* ==========================================
            PERSISTENT TIME CLOCK SYSTEM SECURE PANEL MODAL
           ========================================== */}
        {showClockModal && (
          <div className="absolute inset-0 bg-[#12161A]/95 z-50 flex flex-col justify-center p-6 backdrop-blur-sm">
            <div className={`${darkCard} rounded-2xl p-6 space-y-4 relative shadow-2xl`}>
              <h3 className="text-base font-bold text-white uppercase tracking-wider text-center border-b border-[#2A353D] pb-2">Secure Attendance Punch Access</h3>
              
              <div className="p-4 bg-[#12161A] rounded-xl border border-[#2A353D] space-y-3">
                <p className="text-xs text-slate-400 text-center">System Identity Verification Status: <span className="text-emerald-400 font-bold">ACTIVE ROUTE SECURED</span></p>
                <div className="flex justify-between items-center border-t border-[#2A353D]/60 pt-2 text-xs">
                  <span>Simulated Device Location Coordinates:</span>
                  <button 
                    onClick={() => setSimulatedOffPremises(!simulatedOffPremises)}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${simulatedOffPremises ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}
                  >
                    {simulatedOffPremises ? '📡 Simulated: 3.2 Miles Away' : '📡 Simulated: On Premise (Cheers)'}
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button 
                  onClick={handleClockPunchAttempt}
                  className={`w-full py-4 ${copperGradient} text-slate-900 font-black rounded-xl uppercase tracking-widest shadow-xl`}
                >
                  Confirm Secure Punch
                </button>
                <button 
                  onClick={() => setShowClockModal(false)}
                  className="w-full py-2 text-xs text-slate-400 uppercase tracking-widest font-semibold text-center hover:text-white"
                >
                  Cancel Connection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SOFT GEOFENCE TEXT EXPLANATION ENTRY MODAL VIEW (SECTION 8) */}
        {showGeofenceNoteModal && (
          <div className="absolute inset-0 bg-[#12161A]/95 z-50 flex flex-col justify-center p-6 backdrop-blur-sm">
            <div className={`${darkCard} rounded-2xl p-6 space-y-4 shadow-2xl`}>
              <div className="text-center">
                <span className="text-2xl">🚨</span>
                <h3 className="text-base font-bold text-white uppercase tracking-wider mt-1">Off-Premises Activity Detected</h3>
                <p className="text-xs text-slate-400 mt-1">Your device coordinate radius flags this attendance verification instance as off-site operation parameter.</p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">State Required Audit Explanatory Note:</label>
                <input 
                  type="text"
                  placeholder="e.g. Stopping at Restaurant Depot for extra ribeye boxes"
                  value={geofenceNote}
                  onChange={(e) => setGeofenceNote(e.target.value)}
                  className="w-full bg-[#12161A] border border-[#2A353D] text-slate-200 text-sm p-3 rounded-xl focus:outline-none"
                />
              </div>
              <button 
                onClick={() => {
                  if(!geofenceNote.trim()) { alert("An audit reason trail text string is mandatory to bypass this soft perimeter validation block."); return; }
                  executePunch(geofenceNote, 16800);
                }}
                className={`w-full py-3 ${copperGradient} text-slate-900 font-bold rounded-xl text-xs uppercase tracking-wider`}
              >
                Log Authorized Exception Punch
              </button>
            </div>
          </div>
        )}

        {/* HISTORICAL DATE WARNING OVERRIDE TRIGGER PROMPT (SECTION 6) */}
        {showHistoricalWarning && (
          <div className="absolute inset-0 bg-[#12161A]/95 z-50 flex flex-col justify-center p-6 backdrop-blur-sm">
            <div className={`${darkCard} rounded-2xl p-6 space-y-4 text-center shadow-2xl`}>
              <span className="text-3xl">⚠️</span>
              <h3 className="text-base font-bold text-white uppercase tracking-wider">Historical System Schedule Log Modification Warning</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                You are intentionally opening a locked retroactive calendar cell date window matrix row ({selectedScheduleDate}). Modifying this written system baseline will force re-evaluations across your automated labor analysis percentages and payroll matrix engines.
              </p>
              <div className="space-y-2 pt-2">
                <button onClick={() => setShowHistoricalWarning(false)} className={`w-full py-3 ${copperGradient} text-slate-900 font-bold rounded-xl text-xs uppercase tracking-wider`}>
                  Authorize Matrix Override Verification
                </button>
                <button onClick={() => { setShowHistoricalWarning(false); setCurrentSubTab('my-schedule'); }} className="w-full text-xs text-slate-400 py-1">
                  Cancel Matrix Alteration Routine
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RECIPE EDIT MODAL WINDOW SYNC VIEW */}
        {showRecipeModal && editingRecipe && (
          <div className="absolute inset-0 bg-[#12161A]/95 z-50 flex flex-col justify-center p-6 backdrop-blur-sm">
            <div className={`${darkCard} rounded-2xl p-6 space-y-4 shadow-2xl`}>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2A353D] pb-2">Edit Corporate Specs: {editingRecipe.name}</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Standard Batch Output Base Amount</label>
                  <input type="text" value={editingRecipe.yieldAmt} onChange={(e) => setEditingRecipe({...editingRecipe, yieldAmt: e.target.value})} className="w-full bg-[#12161A] text-white p-2 rounded border border-[#2A353D]" />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Kitchen Deployment Station Assignment</label>
                  <input type="text" value={editingRecipe.station} onChange={(e) => setEditingRecipe({...editingRecipe, station: e.target.value})} className="w-full bg-[#12161A] text-white p-2 rounded border border-[#2A353D]" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowRecipeModal(false)} className="px-4 py-2 text-xs font-bold text-slate-400 uppercase">Cancel</button>
                <button onClick={() => {
                  setRecipes(recipes.map(r => r.id === editingRecipe.id ? editingRecipe : r));
                  setShowRecipeModal(false);
                  alert("Recipe structural metadata modifications saved into application dictionary context memory storage rows successfully.");
                }} className={`px-4 py-2 text-xs font-bold text-slate-900 rounded-lg ${copperGradient} uppercase tracking-wider`}>Save Alterations</button>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            IMAGE-PERFECT APP SYSTEM FOOTER NAVBAR (6187.png)
           ========================================== */}
        <nav className="absolute bottom-0 inset-x-0 bg-[#161D22] border-t border-[#2A353D] px-2 py-3 flex justify-between items-center z-40">
          
          <button onClick={() => { setCurrentTab('schedule'); setCurrentSubTab('my-schedule'); }} className={`flex-1 flex flex-col items-center justify-center transition-colors ${currentTab === 'schedule' ? copperText : 'text-slate-500'}`}>
            <span className="text-base mb-0.5">📅</span>
            <span className="text-[10px] tracking-tight font-medium">Schedule</span>
          </button>
          
          <button onClick={() => setCurrentTab('prep')} className={`flex-1 flex flex-col items-center justify-center transition-colors ${currentTab === 'prep' ? copperText : 'text-slate-500'}`}>
            <span className="text-base mb-0.5">🍳</span>
            <span className="text-[10px] tracking-tight font-medium">Prep (Stns)</span>
          </button>
          
          <button onClick={() => setCurrentTab('messaging')} className={`flex-1 flex flex-col items-center justify-center transition-colors ${currentTab === 'messaging' ? copperText : 'text-slate-500'}`}>
            <span className="text-base mb-0.5">💬</span>
            <span className="text-[10px] tracking-tight font-medium">Messages</span>
          </button>
          
          <button onClick={() => { setCurrentTab('ops'); setOpsSubTab('sales'); }} className={`flex-1 flex flex-col items-center justify-center transition-colors ${currentTab === 'ops' ? copperText : 'text-slate-500'}`}>
            <span className="text-base mb-0.5">📈</span>
            <span className="text-[10px] tracking-tight font-medium">Financials</span>
          </button>

        </nav>

      </div>
    </div>
  );
}
