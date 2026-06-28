import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ClipboardCheck, Plus, Trash2, Check, RefreshCcw } from 'lucide-react';

const TabPrep = ({ prepTasks = [], appUser, addToast, db, T }) => {
  const [taskName, setTaskName] = useState('');
  const [taskPar, setTaskPar] = useState('');
  const [taskUnit, setTaskUnit] = useState('Qt');

  const handleAddPrep = async (e) => {
    e.preventDefault();
    if (!taskName.trim()) return;

    try {
      await addDoc(collection(db, "prepTasks"), {
        name: taskName.trim(),
        par: taskPar.trim() || '1',
        unit: taskUnit,
        isCompleted: false,
        addedBy: appUser.name,
        restaurantId: appUser.restaurantId,
        timestamp: new Date().toISOString()
      });
      setTaskName('');
      setTaskPar('');
      addToast('Added', 'Task added to the prep list.');
    } catch (err) {
      addToast('Error', 'Failed to add prep task.');
    }
  };

  const handleToggleComplete = async (task) => {
    try {
      await updateDoc(doc(db, "prepTasks", task.id), {
        isCompleted: !task.isCompleted,
        completedBy: !task.isCompleted ? appUser.name : null,
        completedAt: !task.isCompleted ? new Date().toISOString() : null
      });
    } catch (err) {
      addToast('Error', 'Failed to update task.');
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm("Delete this prep task?")) return;
    try {
      await deleteDoc(doc(db, "prepTasks", id));
      addToast('Deleted', 'Task removed from list.');
    } catch (err) {
      addToast('Error', 'Failed to delete task.');
    }
  };

  const handleResetList = async () => {
    if (!window.confirm("This will uncheck all completed items and reset the list for the next shift. Continue?")) return;
    
    try {
      const completedTasks = prepTasks.filter(t => t.isCompleted);
      const resetPromises = completedTasks.map(t => 
        updateDoc(doc(db, "prepTasks", t.id), { isCompleted: false, completedBy: null, completedAt: null })
      );
      await Promise.all(resetPromises);
      addToast('List Reset', 'Prep list is fresh and ready for the next shift.');
    } catch (err) {
      addToast('Error', 'Failed to reset prep list.');
    }
  };

  const pendingTasks = prepTasks.filter(t => !t.isCompleted).sort((a,b) => a.name.localeCompare(b.name));
  const completedTasks = prepTasks.filter(t => t.isCompleted).sort((a,b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-[slideIn_0.2s_ease-out]">
      
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b ${T.border} pb-3`}>
        <div className="flex items-center gap-3">
          <ClipboardCheck size={24} className={T.copper}/>
          <h2 className="text-2xl font-black text-white">Daily Prep List</h2>
        </div>
        <button onClick={handleResetList} className={`${T.btnAlt} py-2 px-4 flex items-center gap-2 text-xs`}>
          <RefreshCcw size={14}/> Reset List for Next Shift
        </button>
      </div>

      <form onSubmit={handleAddPrep} className={`${T.card} p-4 flex flex-col sm:flex-row gap-3 items-end`}>
        <div className="flex-1 w-full">
          <label className={T.label}>Item to Prep</label>
          <input type="text" value={taskName} onChange={e=>setTaskName(e.target.value)} className={T.input} placeholder="e.g. Diced Onions" required />
        </div>
        <div className="w-full sm:w-24">
          <label className={T.label}>Amount</label>
          <input type="text" value={taskPar} onChange={e=>setTaskPar(e.target.value)} className={T.input} placeholder="e.g. 4" />
        </div>
        <div className="w-full sm:w-32">
          <label className={T.label}>Unit</label>
          <select value={taskUnit} onChange={e=>setTaskUnit(e.target.value)} className={T.input}>
            <option>Qt</option><option>Pint</option><option>Gal</option><option>Lbs</option><option>Pans</option><option>Ea</option>
          </select>
        </div>
        <button type="submit" className={`${T.btn} py-3 px-6 w-full sm:w-auto h-[42px] flex items-center justify-center`}><Plus size={18}/></button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* PENDING TASKS */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-400 flex justify-between items-center border-b border-[#2A353D] pb-1">
            <span>To Do</span>
            <span className="bg-orange-900/20 px-2 py-0.5 rounded border border-orange-900/50">{pendingTasks.length}</span>
          </h3>
          <div className="space-y-2">
            {pendingTasks.length === 0 && <div className={`text-sm font-bold ${T.muted} text-center p-4 border border-[#2A353D] rounded-xl border-dashed`}>All caught up!</div>}
            {pendingTasks.map(task => (
              <div key={task.id} className={`${T.card} p-3 flex justify-between items-center group hover:border-[#D4A381]/50 transition-colors`}>
                <button onClick={() => handleToggleComplete(task)} className="flex items-center gap-3 flex-1 text-left">
                  <div className="w-5 h-5 rounded border-2 border-slate-500 group-hover:border-[#D4A381] transition-colors flex-shrink-0"></div>
                  <div>
                    <div className="font-bold text-white text-sm">{task.name}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mt-0.5">Par: {task.par} {task.unit}</div>
                  </div>
                </button>
                {(appUser?.isAdmin || appUser?.permissions?.prep) && (
                  <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* COMPLETED TASKS */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex justify-between items-center border-b border-[#2A353D] pb-1">
            <span>Completed</span>
            <span className="bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-900/50">{completedTasks.length}</span>
          </h3>
          <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
            {completedTasks.length === 0 && <div className={`text-sm font-bold ${T.muted} text-center p-4 border border-[#2A353D] rounded-xl border-dashed`}>Nothing finished yet.</div>}
            {completedTasks.map(task => (
              <div key={task.id} className={`${T.card} p-3 flex justify-between items-center bg-[#12161A]`}>
                <button onClick={() => handleToggleComplete(task)} className="flex items-center gap-3 flex-1 text-left">
                  <div className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center flex-shrink-0"><Check size={14} strokeWidth={4}/></div>
                  <div>
                    <div className="font-bold text-slate-300 text-sm line-through decoration-slate-500">{task.name}</div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-emerald-500 mt-0.5">Done by {task.completedBy}</div>
                  </div>
                </button>
                {(appUser?.isAdmin || appUser?.permissions?.prep) && (
                  <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default TabPrep;
