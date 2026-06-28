import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { BookOpen, Search, Plus, Edit, Trash2 } from 'lucide-react';

const TabRecipes = ({ recipes = [], appUser, addToast, db, Modal, T }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewRecipe, setViewRecipe] = useState(null);
  const [editRecipe, setEditRecipe] = useState(null);

  // Form States
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Prep');
  const [prepTime, setPrepTime] = useState('');
  const [yieldAmt, setYieldAmt] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');

  const canManage = appUser?.isAdmin || appUser?.permissions?.prep || appUser?.permissions?.recipes;

  const resetForm = () => {
    setTitle(''); setCategory('Prep'); setPrepTime(''); setYieldAmt(''); setIngredients(''); setInstructions(''); setEditRecipe(null);
  };

  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    if (!title.trim() || !ingredients.trim() || !instructions.trim()) return addToast('Error', 'Title, Ingredients, and Instructions are required.');

    const payload = {
      title: title.trim(),
      category,
      prepTime: prepTime.trim() || '--',
      yieldAmt: yieldAmt.trim() || '--',
      ingredients: ingredients.trim(),
      instructions: instructions.trim(),
      authorName: editRecipe ? editRecipe.authorName : appUser.name,
      lastUpdated: new Date().toISOString(),
      restaurantId: appUser.restaurantId
    };

    try {
      if (editRecipe?.id) {
        await updateDoc(doc(db, "recipes", editRecipe.id), payload);
        addToast('Updated', 'Spec sheet saved.');
      } else {
        await addDoc(collection(db, "recipes"), payload);
        addToast('Added', 'New spec sheet added to the book.');
      }
      resetForm();
    } catch (err) {
      addToast('Error', 'Failed to save recipe.');
    }
  };

  const handleDeleteRecipe = async (id) => {
    if (!window.confirm("Permanently delete this spec sheet?")) return;
    try {
      await deleteDoc(doc(db, "recipes", id));
      addToast('Deleted', 'Spec sheet removed.');
      setViewRecipe(null);
    } catch (err) {
      addToast('Error', 'Failed to delete recipe.');
    }
  };

  const filteredRecipes = recipes.filter(r => 
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.ingredients.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-24 animate-[slideIn_0.2s_ease-out]">
      
      <Modal isOpen={!!viewRecipe} onClose={() => setViewRecipe(null)} title={viewRecipe?.title}>
        {viewRecipe && (
          <div className="space-y-4">
            <div className="flex justify-between items-start bg-[#12161A] p-3 rounded-xl border border-[#2A353D]">
              <div>
                <div className="text-[10px] font-black text-[#D4A381] uppercase tracking-widest mb-0.5">{viewRecipe.category}</div>
                <div className="text-xs text-slate-400 font-medium">Last updated by {viewRecipe.authorName}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-white"><span className="text-slate-500">Yield:</span> {viewRecipe.yieldAmt}</div>
                <div className="text-xs font-bold text-white"><span className="text-slate-500">Prep:</span> {viewRecipe.prepTime}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-[#2A353D] pb-1">Ingredients</h4>
              <p className="text-sm text-slate-300 whitespace-pre-wrap font-medium">{viewRecipe.ingredients}</p>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-[#2A353D] pb-1 mt-4">Instructions</h4>
              <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{viewRecipe.instructions}</p>
            </div>

            {canManage && (
              <div className="flex gap-2 pt-4 border-t border-[#2A353D]">
                <button onClick={() => { setEditRecipe(viewRecipe); setTitle(viewRecipe.title); setCategory(viewRecipe.category); setPrepTime(viewRecipe.prepTime); setYieldAmt(viewRecipe.yieldAmt); setIngredients(viewRecipe.ingredients); setInstructions(viewRecipe.instructions); setViewRecipe(null); }} className={`flex-1 ${T.btnAlt} py-2 flex items-center justify-center gap-2`}><Edit size={14}/> Edit Spec</button>
                <button onClick={() => handleDeleteRecipe(viewRecipe.id)} className="px-4 bg-[#12161A] text-slate-400 border border-[#2A353D] hover:text-red-500 rounded-lg transition-colors flex items-center justify-center"><Trash2 size={14}/></button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${T.border} pb-3`}>
        <div className="flex items-center gap-3">
          <BookOpen size={24} className={T.copper}/>
          <h2 className="text-2xl font-black text-white">Spec Book</h2>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
          <input type="text" placeholder="Search recipes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${T.input} pl-9 py-1.5 text-sm`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* RECIPE LIST (LEFT COLUMN) */}
        <div className="md:col-span-1 space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Directory ({filteredRecipes.length})</h3>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
            {filteredRecipes.length === 0 ? (
              <div className={`text-sm font-bold ${T.muted} text-center p-4 border border-[#2A353D] rounded-xl border-dashed`}>No specs found.</div>
            ) : (
              filteredRecipes.sort((a,b) => a.title.localeCompare(b.title)).map(recipe => (
                <button key={recipe.id} onClick={() => setViewRecipe(recipe)} className={`w-full text-left p-3 ${T.card} hover:border-[#D4A381]/50 transition-colors group`}>
                  <div className="font-bold text-white text-sm group-hover:text-[#D4A381] transition-colors">{recipe.title}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1 flex justify-between">
                    <span>{recipe.category}</span>
                    <span>{recipe.authorName === '86 System' ? '★ Master' : ''}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* RECIPE EDITOR (RIGHT COLUMN) */}
        {canManage && (
          <div className="md:col-span-2">
            <form onSubmit={handleSaveRecipe} className={`${T.card} p-5 space-y-4`}>
              <div className="flex justify-between items-center border-b border-[#2A353D] pb-3 mb-2">
                <h3 className="text-sm font-black uppercase text-[#D4A381] tracking-widest flex items-center gap-2">
                  {editRecipe ? <><Edit size={16}/> Edit Spec Sheet</> : <><Plus size={16}/> Add New Spec</>}
                </h3>
                {editRecipe && <button type="button" onClick={resetForm} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white">Cancel Edit ✖</button>}
              </div>

              <div><label className={T.label}>Recipe Title</label><input type="text" value={title} onChange={e=>setTitle(e.target.value)} className={T.input} placeholder="e.g. House Vinaigrette" required /></div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={T.label}>Category</label>
                  <select value={category} onChange={e=>setCategory(e.target.value)} className={T.input}>
                    <option>Prep</option><option>Line Line</option><option>Bar</option><option>Dough/Bake</option>
                  </select>
                </div>
                <div><label className={T.label}>Yield</label><input type="text" value={yieldAmt} onChange={e=>setYieldAmt(e.target.value)} className={T.input} placeholder="e.g. 4 Quarts" /></div>
                <div><label className={T.label}>Prep Time</label><input type="text" value={prepTime} onChange={e=>setPrepTime(e.target.value)} className={T.input} placeholder="e.g. 15 Mins" /></div>
              </div>

              <div><label className={T.label}>Ingredients</label><textarea value={ingredients} onChange={e=>setIngredients(e.target.value)} rows="4" className={T.input} placeholder="1 Cup Olive Oil&#10;2 Tbsp Dijon..." required /></div>
              
              <div><label className={T.label}>Instructions</label><textarea value={instructions} onChange={e=>setInstructions(e.target.value)} rows="5" className={T.input} placeholder="1. Whisk mustard and vinegar...&#10;2. Slowly stream in oil..." required /></div>

              <button type="submit" className={`w-full ${T.btn} py-3`}>{editRecipe ? 'Save Changes to Book' : 'Add to Recipe Book'}</button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default TabRecipes;
