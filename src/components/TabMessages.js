import React, { useState } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MessageSquare, AlertCircle, Send, Trash2, Camera, X, Loader2 } from 'lucide-react';

const TabMessages = ({ events = [], appUser, users, addToast, db, storage, T }) => {
  const [msgText, setMsgText] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [replyTexts, setReplyTexts] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Filter events to only show notes/messages, sorted newest first
  const messages = events
    .filter(e => e.type === 'note')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const handlePostMessage = async (e) => {
    e.preventDefault();
    if (!msgText.trim() && !imageFile) return;
    setIsUploading(true);

    let photoUrl = null;
    if (imageFile) {
      try {
        const fileRef = ref(storage, `messages/${appUser.restaurantId}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(fileRef, imageFile);
        photoUrl = await getDownloadURL(fileRef);
      } catch (error) {
        addToast('Error', 'Image upload failed. Check connection.');
        setIsUploading(false);
        return;
      }
    }
    
    try {
      await addDoc(collection(db, "events"), {
        date: new Date().toISOString(),
        title: msgText.trim(),
        type: 'note',
        author: appUser.name,
        authorId: appUser.id,
        isImportant: isImportant,
        restaurantId: appUser.restaurantId,
        replies: [],
        imageUrl: photoUrl
      });
      setMsgText('');
      setIsImportant(false);
      setImageFile(null);
      addToast('Message Posted', 'Your message is live on the board.');
    } catch (err) {
      addToast('Error', 'Failed to post message.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReplyChange = (id, text) => {
    setReplyTexts(prev => ({ ...prev, [id]: text }));
  };

  const handleSendReply = async (e, eventId) => {
    e.preventDefault();
    const text = replyTexts[eventId];
    if (!text || !text.trim()) return;

    const targetEvent = events.find(ev => ev.id === eventId);
    const currentReplies = targetEvent.replies || [];
    const newReply = {
        id: Date.now().toString(),
        author: appUser.name,
        text: text.trim(),
        timestamp: new Date().toISOString()
    };

    try {
        await updateDoc(doc(db, "events", eventId), {
            replies: [...currentReplies, newReply]
        });
        setReplyTexts(prev => ({ ...prev, [eventId]: '' }));
    } catch (err) {
        addToast('Error', 'Could not post reply.');
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
          placeholder="What does the team need to know? (Photo Optional)" 
          className={T.input} 
        />
        
        {imageFile && (
          <div className="text-xs text-emerald-400 font-bold bg-emerald-900/20 p-2 rounded-lg border border-emerald-900/50 flex justify-between items-center">
            <span className="truncate pr-2">📷 {imageFile.name} attached</span>
            <button type="button" onClick={()=>setImageFile(null)} className="text-red-400 hover:text-red-300 p-1"><X size={14}/></button>
          </div>
        )}

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
          
          <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full sm:w-auto">
            <div className={`flex flex-1 sm:flex-none bg-[#12161A] border border-[#2A353D] rounded-xl overflow-hidden shadow-sm h-12 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
               <label className="flex-1 sm:w-16 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors border-r border-[#2A353D] text-[#D4A381]" title="Take Photo">
                  <Camera size={20} />
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => setImageFile(e.target.files[0])} className="hidden" disabled={isUploading} />
               </label>
               <label className="flex-1 sm:w-20 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors text-[#D4A381]" title="Upload Photo">
                  <span className="text-[10px] font-black uppercase tracking-wider">Upload</span>
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="hidden" disabled={isUploading} />
               </label>
            </div>
            <button type="submit" disabled={isUploading || (!msgText.trim() && !imageFile)} className={`flex-1 sm:flex-none ${T.btn} h-12 disabled:opacity-50 flex items-center justify-center gap-2 px-8`}>
              {isUploading ? <Loader2 className="animate-spin" size={16} /> : <><Send size={16} /> Post Message</>}
            </button>
          </div>
        </div>
      </form>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className={`${T.card} p-8 text-center text-sm font-bold ${T.muted}`}>
            No messages on the board. It's quiet... too quiet.
          </div>
        ) : (
          messages.map(msg => {
            const authorUser = users.find(u => u.name === msg.author);
            return (
              <div key={msg.id} className={`${T.card} p-4 ${msg.isImportant ? 'border-red-900/50 bg-gradient-to-br from-red-900/10 to-[#1A2126]' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    {msg.author !== 'System Alert' && (
                      <div className="w-10 h-10 rounded-full border border-[#2A353D] bg-[#12161A] flex items-center justify-center text-xs font-black text-white uppercase flex-shrink-0">
                        {msg.author ? msg.author.charAt(0) : '?'}
                      </div>
                    )}
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
                  </div>
                  {(appUser?.isAdmin || appUser?.id === msg.authorId) && (
                    <button onClick={() => handleDeleteMessage(msg.id)} className="text-slate-500 hover:text-red-500 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                
                {msg.title && (
                  <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed font-medium mt-2">
                    {msg.title}
                  </p>
                )}

                {/* RENDER THE IMAGE IF IT HAS ONE */}
                {msg.imageUrl && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-[#2A353D] shadow-inner bg-[#0B0E11]">
                    <img src={msg.imageUrl} alt="Attached" className="w-full max-h-96 object-contain" />
                  </div>
                )}
                
                {/* Replies Section */}
                {(msg.replies && msg.replies.length > 0) && (
                  <div className="space-y-2 mt-3 mb-3 pl-3 border-l-2 border-[#2A353D]">
                    {msg.replies.map(r => (
                      <div key={r.id} className="text-sm break-words">
                        <span className={`font-black text-[9px] uppercase tracking-widest mr-2 ${T.copper}`}>{r.author}</span>
                        <span className="text-slate-300 font-medium text-xs">{r.text}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Reply Input */}
                {msg.author !== 'System Alert' && (
                  <form onSubmit={(e) => handleSendReply(e, msg.id)} className="flex gap-2 mt-3">
                    <input 
                      type="text" 
                      placeholder="Reply..." 
                      value={replyTexts[msg.id] || ''} 
                      onChange={(e) => handleReplyChange(msg.id, e.target.value)} 
                      className="flex-1 bg-[#0B0E11] border border-[#2A353D] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-[#D4A381] transition-colors"
                    />
                    <button type="submit" disabled={!replyTexts[msg.id]?.trim()} className="bg-[#1A2126] text-[#D4A381] px-3 py-2 rounded-lg flex items-center justify-center border border-[#2A353D] disabled:opacity-50 hover:bg-[#2A353D] transition-colors"><Send size={14}/></button>
                  </form>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default TabMessages;
