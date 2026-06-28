import React, { useState } from 'react';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { MessageSquare, AlertCircle, Send, Trash2 } from 'lucide-react';

const TabMessages = ({ events = [], appUser, addToast, db, T }) => {
  const [msgText, setMsgText] = useState('');
  const [isImportant, setIsImportant] = useState(false);

  // Filter events to only show notes/messages, sorted newest first
  const messages = events
    .filter(e => e.type === 'note')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const handlePostMessage = async (e) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    
    try {
      await addDoc(collection(db, "events"), {
        date: new Date().toISOString(),
        title: msgText.trim(),
        type: 'note',
        author: appUser.name,
        authorId: appUser.id,
        isImportant: isImportant,
        restaurantId: appUser.restaurantId,
        replies: [] // Preserved for future reply threading
      });
      setMsgText('');
      setIsImportant(false);
      addToast('Message Posted', 'Your message is live on the board.');
    } catch (err) {
      addToast('Error', 'Failed to post message.');
    }
  };

  const handleDeleteMessage = async (id) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      await deleteDoc(doc(db, "events", id));
      addToast('Deleted', 'Message removed from the board.');
    } catch (err) {
      addToast('Error', 'Failed to delete message.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 animate-[slideIn_0.2s_ease-out]">
      
      <div className={`flex items-center gap-3 border-b ${T.border} pb-3`}>
        <MessageSquare size={24} className={T.copper}/>
        <h2 className="text-2xl font-black text-white">Message Board</h2>
      </div>

      <form onSubmit={handlePostMessage} className={`${T.card} p-4 space-y-3`}>
        <h3 className="text-sm font-black uppercase text-[#D4A381] tracking-widest">Post an Announcement</h3>
        <textarea 
          value={msgText} 
          onChange={e => setMsgText(e.target.value)} 
          rows="3" 
          placeholder="What does the team need to know?" 
          className={T.input} 
          required 
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isImportant} 
              onChange={e => setIsImportant(e.target.checked)} 
              className="w-4 h-4 accent-red-500 bg-[#1A2126] border-[#2A353D]" 
            />
            <span className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1">
              <AlertCircle size={14} /> Mark as High Priority
            </span>
          </label>
          <button type="submit" className={`${T.btn} px-8 flex items-center justify-center gap-2`}>
            <Send size={16} /> Post Message
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className={`${T.card} p-8 text-center text-sm font-bold ${T.muted}`}>
            No messages on the board. It's quiet... too quiet.
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`${T.card} p-4 ${msg.isImportant ? 'border-red-900/50 bg-gradient-to-br from-red-900/10 to-[#1A2126]' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-black text-white text-sm flex items-center gap-2">
                    {msg.author}
                    {msg.isImportant && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded uppercase tracking-widest">Important</span>}
                    {msg.author === 'System Alert' && <span className="bg-fuchsia-900 text-fuchsia-300 border border-fuchsia-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase tracking-widest">Global Broadcast</span>}
                  </div>
                  <div className={`text-[9px] font-bold ${T.muted} uppercase tracking-widest mt-0.5`}>
                    {new Date(msg.date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {(appUser?.isAdmin || appUser?.id === msg.authorId) && (
                  <button onClick={() => handleDeleteMessage(msg.id)} className="text-slate-500 hover:text-red-500 transition-colors p-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed font-medium">
                {msg.title}
              </p>
            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default TabMessages;
