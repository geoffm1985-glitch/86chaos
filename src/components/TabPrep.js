import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ClipboardList, Plus, Check, Repeat, Trash2, X } from 'lucide-react';

const TabPrep = ({ currentDate, prepItems, tasks = [], appUser, setLabelsToPrint, db, T, dbPrepCats = [], formatDate, getToday, addToast }) => {
  const [subTab, setSubTab] = useState('prep');
  const [prepDate, setPrepDate] = useState(currentDate);

  useEffect(() => { setPrepDate(currentDate); }, [currentDate]);

  const [selectedPreps, setSelectedPreps] = useState([]);
  const [text, setText] = useState(''); 
  const [station, setStation] = useState('Grill'); 
  const displayStations = dbPrepCats.length > 0 ? dbPrepCats.map(c => c.name).sort() : ['Grill', 'Fry', 'Salad/Cold', 'Expo', 'Prep Table'];
  const [isMaster, setIsMaster] = useState(true);
  
  const [taskText, setTaskText] = useState(''); 
  const [taskCat, setTaskCat] = useState('Cleaning'); 
  const [taskFreq, setTaskFreq] = useState('daily');
  const [taskTargetDay, setTaskTargetDay] = useState('Monday'); 
  const [taskTargetDate, setTaskTargetDate] = useState('1');
  const [editingTaskId, setEditingTaskId] = useState(null);

  const activePrep = prepItems.filter(p => p.date === prepDate || p.isMaster);
  
  const handleAddPrep = async (e) => { 
    e.preventDefault(); 
    if(text.trim()) { 
      await addDoc(collection(db, "prepItems"), { 
        date: isMaster ? 'MASTER' : prepDate, 
        text: text.trim(), 
        station, 
        isCompleted: false, 
        completedDates: {}, 
        isMaster, 
        qty: 1,
        restaurantId: appUser.restaurantId
      }); 
      setText(''); 
    } 
  };
  
  const toggleSelection = (id) => {
    setSelectedPreps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const togglePrepStatus = async (item) => { 
    if (item.isMaster) { 
      const dts = {...(item.completedDates||{})}; 
      if (dts[prepDate]) {
        delete dts[prepDate]; 
      } else {
        dts[prepDate] = appUser.name;
      }
      await updateDoc(doc(db, "prepItems", item.id), { completedDates: dts }); 
    } else { 
      await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted, completedBy: !item.isCompleted ? appUser.name : null }); 
    } 
  };
  
  const groupedPrep = activePrep.reduce((acc, i) => { const s = i.station || 'General'; if(!acc[s]) acc[s]=[]; acc[s].push(i); return acc; }, {});

  const handleAddTask = async (e) => { 
    e.preventDefault(); 
    if(taskText.trim()) { 
      if (editingTaskId) {
        await updateDoc(doc(db, "tasks", editingTaskId), { title: taskText.trim(), category: taskCat, frequency: taskFreq, targetDay: taskFreq === 'weekly' ? taskTargetDay : null, targetDate: taskFreq === 'monthly' ? taskTargetDate : null });
        setEditingTaskId(null);
      } else {
        await addDoc(collection(db, "tasks"), { title: taskText.trim(), category: taskCat, frequency: taskFreq, targetDay: taskFreq === 'weekly' ? taskTargetDay : null, targetDate: taskFreq === 'monthly' ? taskTargetDate : null, completions: {}, restaurantId: appUser.restaurantId }); 
      }
      setTaskText(''); 
    } 
  };

  const editTask = (t) => {
    setTaskText(t.title);
    setTaskCat(t.category || 'Cleaning');
    setTaskFreq(t.frequency || 'daily');
    if (t.frequency === 'weekly') setTaskTargetDay(t.targetDay || 'Monday');
    if (t.frequency === 'monthly') setTaskTargetDate(t.targetDate || '1');
    setEditingTaskId(t.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelTaskEdit = () => {
    setTaskText('');
    setEditingTaskId(null);
  };
  
  const getTaskPeriodKey = (freq) => {
    if (freq === 'daily') return prepDate;
    if (freq === 'weekly') { 
      const d = new Date(prepDate+'T12:00:00'); 
      const day = d.getDay(); 
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); 
      return formatDate(d); 
    }
    if (freq === 'monthly') return prepDate.substring(0, 7);
  };

  const toggleTaskStatus = async (task) => {
    const periodKey = getTaskPeriodKey(task.frequency);
    const updatedCompletions = { ...(task.completions || {}) };
    if (updatedCompletions[periodKey]) { 
      delete updatedCompletions[periodKey]; 
    } else { 
      updatedCompletions[periodKey] = { by: appUser.name, at: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }; 
    }
    await updateDoc(doc(db, "tasks", task.id), { completions: updatedCompletions });
  };

  const canManageRecurringTasks = () => {
    const role = String(appUser?.role || '').toLowerCase();
    return Boolean(
      appUser?.isAdmin ||
      appUser?.isSuperAdmin ||
      appUser?.isOwner ||
      appUser?.accountOwner ||
      appUser?.owner ||
      appUser?.workspaceOwner ||
      appUser?.permissions?.team ||
      ['general manager', 'manager', 'kitchen manager', 'bar manager', 'schedule manager', 'operations manager', 'store manager', 'owner', 'shift lead', 'lead', 'supervisor'].includes(role) ||
      /\b(manager|owner|supervisor|lead|gm)\b/.test(role)
    );
  };

  const renderTasks = (freqFilter) => {
    const filteredTasks = tasks.filter(t => t.frequency === freqFilter);
    const grouped = filteredTasks.reduce((acc, t) => { if(!acc[t.category]) acc[t.category]=[]; acc[t.category].push(t); return acc; }, { 'Cleaning': [], 'General': [] });
    const periodKey = getTaskPeriodKey(freqFilter);
    
    const canManageTasks = canManageRecurringTasks();
    return (
      <div className="space-y-4 mt-4">
        {canManageTasks && (
          <form onSubmit={handleAddTask} className={`${T.card} p-3 flex flex-col md:flex-row gap-2 items-center bg-[#1A2126]`}>
            {editingTaskId && <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-2 whitespace-nowrap">Editing Task</div>}
            <input type="text" value={taskText} onChange={e=>setTaskText(e.target.value)} className="flex-1 w-full p-2 bg-[#12161A] border border-[#2A353D] rounded-xl outline-none text-sm font-medium text-white" placeholder={`New ${freqFilter} task...`} required/>
            <div className="flex w-full md:w-auto gap-2">
              <select value={taskCat} onChange={e=>setTaskCat(e.target.value)} className="w-1/2 md:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl text-white"><option>Cleaning</option><option>General</option></select>
              {freqFilter === 'weekly' && <select value={taskTargetDay} onChange={e=>setTaskTargetDay(e.target.value)} className="w-1/2 md:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl text-white">{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=><option key={d}>{d}</option>)}</select>}
              {freqFilter === 'monthly' && <select value={taskTargetDate} onChange={e=>setTaskTargetDate(e.target.value)} className="w-1/2 md:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl text-white">{Array.from({length:31}).map((_,i)=><option key={i+1}>{i+1}</option>)}</select>}
              <button type="submit" className={`${T.btn} px-4 py-2 flex items-center justify-center`}>{editingTaskId ? <Check size={18}/> : <Plus size={18}/>}</button>
              {editingTaskId && <button type="button" onClick={cancelTaskEdit} className={`${T.btnAlt} px-4 py-2 flex items-center justify-center border-red-900/50 text-red-400 hover:text-red-300`}><X size={18}/></button>}
            </div>
          </form>
        )}

        {['Cleaning', 'General'].map(cat => {
          if (grouped[cat].length === 0) return null;
          return (
            <div key={cat} className={`${T.card} overflow-hidden`}>
              <div className={T.th}><span>{cat} Tasks</span></div>
              <div className={`divide-y ${T.border}`}>
                {grouped[cat].map(t => {
                  const completion = t.completions?.[periodKey];
                  const isDone = !!completion;
                  return (
                    <div key={t.id} className={`${T.row} flex items-center justify-between gap-3`}>
                      <div>
                        <div className={`text-sm font-bold ${isDone ? 'line-through text-slate-500' : 'text-white'}`}>{t.title}</div>
                        <div className={`text-[9px] font-black uppercase mt-1 flex gap-2`}>
                          {freqFilter === 'weekly' && <span className="text-[#D4A381]">Due: {t.targetDay}s</span>}
                          {freqFilter === 'monthly' && <span className="text-[#D4A381]">Due: {t.targetDate}{t.targetDate.endsWith('1') && t.targetDate !== '11' ? 'st' : t.targetDate.endsWith('2') && t.targetDate !== '12' ? 'nd' : t.targetDate.endsWith('3') && t.targetDate !== '13' ? 'rd' : 'th'}</span>}
                          {isDone && <span className="text-emerald-500 tracking-wider">✓ {completion.by} @ {completion.at}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>toggleTaskStatus(t)} className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-all ${isDone ? 'bg-[#12161A] text-emerald-500 border border-emerald-900/50' : `${T.grad} text-slate-900`}`}>{isDone ? <Check size={20}/> : <div className="w-4 h-4 border-2 border-slate-900 rounded-sm"></div>}</button>
                        {canManageTasks && <button onClick={()=>editTask(t)} className="text-slate-500 hover:text-[#D4A381] p-2"><Edit size={16}/></button>}
                        {canManageTasks && <button onClick={()=>deleteDoc(doc(db,"tasks",t.id))} className="text-slate-500 hover:text-red-500 p-2"><Trash2 size={16}/></button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-40">
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 border-b border-[#2A353D] mb-4 pb-2">
        {['prep', 'daily', 'weekly', 'monthly'].map((tab) => (
          <button key={tab} onClick={() => { setSubTab(tab); setTaskFreq(tab); }} className={`px-2 sm:px-5 py-2.5 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>{tab === 'prep' ? 'Food Prep' : `${tab} Tasks`}</button>
        ))}
      </div>

      {subTab === 'prep' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-3 flex justify-between items-center bg-[#1A2126]`}>
            <h3 className={`font-black flex items-center gap-2 text-sm text-white uppercase tracking-wider`}><ClipboardList size={18} className={T.copper}/> Target Date:</h3>
            <input type="date" value={prepDate} onChange={e=>setPrepDate(e.target.value)} className="p-1.5 bg-[#12161A] border border-[#2A353D] rounded-lg outline-none text-sm font-bold text-[#D4A381] shadow-inner"/>
          </div>
          <form onSubmit={handleAddPrep} className={`${T.card} p-3 flex flex-col sm:flex-row gap-3 items-center bg-[#1A2126]`}>
            <input type="text" value={text} onChange={e=>setText(e.target.value)} className="flex-1 w-full p-2 bg-[#12161A] border border-[#2A353D] rounded-xl text-sm outline-none font-medium text-white placeholder-slate-500" placeholder="Add prep item..." required/>
            <div className="flex w-full sm:w-auto gap-3 items-center">
              <select value={station} onChange={e=>setStation(e.target.value)} className="w-full sm:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl outline-none text-white">{displayStations.map(s => <option key={s} value={s}>{s}</option>)}</select>
              <label className={`flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold ${T.muted} cursor-pointer`}><input type="checkbox" checked={isMaster} onChange={e=>setIsMaster(e.target.checked)} className="w-4 h-4 accent-[#8F6040] bg-[#12161A] border-[#2A353D] rounded"/> Master</label>
              <button className={`${T.btn} py-2 px-4`}><Plus size={18}/></button>
            </div>
          </form>
          
          <div className={`${T.card} overflow-hidden`}>
            {Object.entries(groupedPrep).map(([stationName, items]) => (
              <div key={stationName}>
                <div className={T.th}><span>{stationName} Station</span><span className="float-right text-slate-500">{items.filter(i => (i.isMaster ? !!i.completedDates?.[prepDate] : i.isCompleted)).length}/{items.length} Done</span></div>
                <div className={`divide-y ${T.border}`}>
                  {items.map(i=>{
                    const isDone = i.isMaster ? !!i.completedDates?.[prepDate] : i.isCompleted; 
                    const doneBy = i.isMaster ? i.completedDates?.[prepDate] : i.completedBy; 
                    const qty = i.qty ?? 1;
                    const isSelected = selectedPreps.includes(i.id);
                    
                    return (
                    <div key={i.id} className={`${T.row} ${isSelected ? 'bg-[#12161A]' : ''} flex items-center gap-2`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(i.id)} className="w-5 h-5 rounded accent-[#8F6040] bg-[#12161A] border-[#2A353D] flex-shrink-0 cursor-pointer" />
                      <div className="flex-1 min-w-0"><span className={`text-sm font-bold ${isDone?'line-through text-slate-500':'text-white'}`}>{i.text}</span> {doneBy && <span className={`text-[9px] font-black text-emerald-500 bg-emerald-900/20 border border-emerald-900/50 px-1.5 py-0.5 rounded ml-2`}>✓ {doneBy}</span>} {i.isMaster&&<span className="block text-[9px] font-black text-slate-500 uppercase mt-0.5">Master Task</span>}</div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className={`flex items-center bg-[#12161A] rounded-lg border ${T.border} h-8`}><button onClick={async ()=> await updateDoc(doc(db, "prepItems", i.id), { qty: Math.max(0, qty - 1) })} className="w-6 h-full font-bold text-white hover:bg-[#1A2126]">-</button><span className="w-5 text-center text-xs font-bold text-[#D4A381]">{qty}</span><button onClick={async ()=> await updateDoc(doc(db, "prepItems", i.id), { qty: qty + 1 })} className="w-6 h-full font-bold text-white hover:bg-[#1A2126]">+</button></div>
                        <button onClick={()=>togglePrepStatus(i)} className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shadow-sm ${isDone?'bg-[#12161A] text-slate-500 border border-[#2A353D]':`${T.grad} text-slate-900`}`}>{isDone ? <Repeat size={14}/> : <Check size={16}/>}</button>
                        <button onClick={()=>{ deleteDoc(doc(db,"prepItems",i.id)); }} className="text-slate-500 hover:text-red-500 p-1.5"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            ))}
          </div>
          <div className={`fixed bottom-0 left-0 right-0 p-4 bg-[#161D22] border-t ${T.border} z-50 backdrop-blur-md bg-opacity-95`}>
            <div className="max-w-2xl mx-auto flex gap-3">
              <button onClick={() => { 
                  const sel = activePrep.filter(i=>selectedPreps.includes(i.id)); 
                  if(sel.length===0)return; 
                  const toP=[]; 
                  sel.forEach(i=>{for(let j=0;j<(i.qty ?? 1);j++)toP.push({...i, printId:`${i.id}-${j}`});}); 
                  setLabelsToPrint({items:toP, prepDate}); 
              }} disabled={selectedPreps.length===0} className={`flex-1 ${T.btn} disabled:opacity-50 flex items-center justify-center gap-2`}><ClipboardList size={18}/> Print Selected</button>
              
              <button onClick={async () => { 
                  const sel = activePrep.filter(i=>selectedPreps.includes(i.id)); 
                  for(const item of sel){ 
                      if(item.isMaster){ 
                          const dts={...(item.completedDates||{})}; 
                          dts[prepDate]=appUser.name; 
                          await updateDoc(doc(db,"prepItems",item.id),{completedDates:dts}); 
                      } else {
                          await updateDoc(doc(db,"prepItems",item.id),{isCompleted:true, completedBy:appUser.name}); 
                      }
                  } 
                  setSelectedPreps([]);
              }} disabled={selectedPreps.length===0} className={`flex-1 ${T.btn} disabled:opacity-50 flex items-center justify-center gap-2`}><Check size={18}/> Mark Done</button>
            </div>
          </div>
  
      </div>
      )}

      {subTab !== 'prep' && <div className="animate-[slideIn_0.2s_ease-out]">{renderTasks(subTab)}</div>}
    </div>
  );
};

export default TabPrep;
