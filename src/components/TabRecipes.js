import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { BookOpen, Search, Plus, Edit, Trash2, Camera, Loader2, Package, ChefHat, Clock, Scale } from 'lucide-react';

const TabRecipes = ({ recipes, appUser, addToast, db, Modal, T, MASTER_ADMIN_EMAIL }) => {
  const [searchTerm, setSearchTerm] = useState(''); 
  const [filterCat, setFilterCat] = useState('All'); 
  const [isFormOpen, setIsFormOpen] = useState(false); 
  const [activeRecipe, setActiveRecipe] = useState(null); 
  const [yieldMult, setYieldMult] = useState(1);
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScanRecipe = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    addToast('Scanning', 'Optimizing and reading recipe...');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200; 
        let scaleSize = 1;
        if (img.width > MAX_WIDTH) {
           scaleSize = MAX_WIDTH / img.width;
        }
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const base64Compressed = canvas.toDataURL('image/jpeg', 0.8);

        try {
          const response = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64Compressed })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to scan. Check API key or Vercel logs.');
          }

          const data = await response.json();
          
          setTitle(data.title || '');
          setPrepTime(data.prepTime || '--');
          setYieldAmt(data.yieldAmt || '--');
          setIngredients(data.ingredients || '');
          setInstructions(data.instructions || '');
          
          setIsFormOpen(true);
          addToast('Success', 'Recipe extracted! Please review.');
        } catch (err) {
          addToast('Error', err.message);
        } finally {
          setIsScanning(false);
        }
      };
    };
    e.target.value = ''; 
  };

  const parseAndMultiply = (text, mult) => { if (mult === 1) return text; const match = text.trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s+(.*)/); if (!match) return text; let numStr = match[1], rest = match[2], val = 0; if (numStr.includes('/')) { const parts = numStr.split(' '); if (parts.length === 2) { const [n, d] = parts[1].split('/'); val = parseFloat(parts[0]) + (parseFloat(n) / parseFloat(d)); } else { const [n, d] = numStr.split('/'); val = parseFloat(n) / parseFloat(d); } } else { val = parseFloat(numStr); } let finalVal = val * mult; let cleanVal = Number.isInteger(finalVal) ? finalVal.toString() : finalVal.toFixed(2); if (cleanVal.endsWith('.50')) cleanVal = cleanVal.replace('.50', ' 1/2').trim(); else if (cleanVal.endsWith('.25')) cleanVal = cleanVal.replace('.25', ' 1/4').trim(); else if (cleanVal.endsWith('.75')) cleanVal = cleanVal.replace('.75', ' 3/4').trim(); else if (cleanVal.endsWith('.33')) cleanVal = cleanVal.replace('.33', ' 1/3').trim(); else if (cleanVal.endsWith('.67')) cleanVal = cleanVal.replace('.67', ' 2/3').trim(); if (cleanVal.startsWith('0 ')) cleanVal = cleanVal.substring(2); return `${cleanVal} ${rest}`; };
  
  const [title, setTitle] = useState(''); 
  const [category, setCategory] = useState('Sauce/Dressing'); 
  const [prepTime, setPrepTime] = useState(''); 
  const [yieldAmt, setYieldAmt] = useState(''); 
  const [ingredients, setIngredients] = useState('');
 
  const [instructions, setInstructions] = useState('');
  const categories = ['All', 'Sauce/Dressing', 'Meat Prep', 'Appetizer', 'Entree', 'Side', 'Dessert', 'Cocktail'];

  const resetForm = () => {
    setTitle(''); setCategory('Sauce/Dressing'); setPrepTime(''); setYieldAmt(''); setIngredients(''); setInstructions(''); setEditingRecipeId(null);
  };

  const handleEdit = () => {
    setTitle(activeRecipe.title);
    setCategory(activeRecipe.category || 'Sauce/Dressing');
    setPrepTime(activeRecipe.prepTime === '--' ? '' : activeRecipe.prepTime);
    setYieldAmt(activeRecipe.yieldAmt === '--' ? '' : activeRecipe.yieldAmt);
    setIngredients(activeRecipe.ingredients);
    setInstructions(activeRecipe.instructions);
    setEditingRecipeId(activeRecipe.id);
    setActiveRecipe(null);
    setIsFormOpen(true);
  };

  const handleSave = async (e) => { 
    e.preventDefault(); 
    if (!title.trim() || !ingredients.trim() || !instructions.trim()) return addToast('Error', 'Missing fields.'); 
    try { 
      if (editingRecipeId) {
        await updateDoc(doc(db, "recipes", editingRecipeId), { 
          title: title.trim(), category, prepTime: prepTime.trim() || '--', yieldAmt: yieldAmt.trim() || '--', ingredients: ingredients.trim(), instructions: instructions.trim(), lastUpdated: new Date().toISOString() 
        }); 
        addToast('Recipe Updated', `${title} updated successfully.`); 
      } else {
        await addDoc(collection(db, "recipes"), { 
          title: title.trim(), category, prepTime: prepTime.trim() || '--', yieldAmt: yieldAmt.trim() || '--', ingredients: ingredients.trim(), instructions: instructions.trim(), authorName: appUser.name, authorId: appUser.id, lastUpdated: new Date().toISOString(), restaurantId: appUser.restaurantId 
        }); 
        addToast('Recipe Saved', `${title} added to the book.`); 
      }
      setIsFormOpen(false); 
      resetForm();
    } catch (err) { addToast('Error', 'Could not save.'); } 
  };
  
  const handleDelete = async (id) => { if (!window.confirm("Delete recipe?")) return; await deleteDoc(doc(db, "recipes", id)); setActiveRecipe(null); addToast('Deleted', 'Recipe removed.'); };
  
  const handleInjectLegacyRecipes = async () => {
    const legacyData = [
      { title: "French Onion Dip", category: "Sauce/Dressing", prepTime: "10 mins", yieldAmt: "--", ingredients: "2 Packs French Onion Dip\n3 Cups Cottage Cheese\n3 Cups Sour Cream", instructions: "Combine all ingredients.\nUse Vita Mix, leave a little chunky." },
      { title: "Chili", category: "Entree", prepTime: "1 hour", yieldAmt: "--", ingredients: "2 (5lb) Beef logs\nPeppers/Onion\n3 cans Tomato Soup (Basement)\n4 cans Tomato Juice (Basement)\n1 can Chili Bean (Basement)\n1 can Diced Tomato (Basement)\n2 (4oz) cups Chili powder\n1 (4oz) cup Kosher salt\n1 (2oz) cup pepper\n1 (2oz) cup garlic granulated\n1 (2oz) cup oregano\n1 (2oz) cup Italian\n1/2 (2oz) cup red pep flakes", instructions: "Brown the beef logs and drain grease.\nSaut peppers and onions.\nCombine beef, saut ed veggies, tomato soup, tomato juice, chili beans, and diced tomatoes in a large pot.\nStir in all seasonings (chili powder, salt, pepper, garlic, oregano, italian, red pepper flakes).\nSimmer until flavors are thoroughly combined." },
      { title: "Beer Dip", category: "Appetizer", prepTime: "15 mins", yieldAmt: "--", ingredients: "2 Bottles Miller Light\n1 package Ranch Seasoning\n1 package Softened Cream Cheese\n3 Cups Shredded Cheese", instructions: "Whisk together the Miller Light and Ranch Seasoning.\nHand mix the beer/ranch mixture with the softened cream cheese until whippy.\nFold in the shredded cheese to the mixture. Make sure it is properly mixed to the bottom." },
      { title: "Beer Cheese", category: "Sauce/Dressing", prepTime: "30 mins", yieldAmt: "--", ingredients: "1 lb Butter\n1 lb Flour\n1/2 Tablespoon Dry mustard powder\n1/2 Tablespoon Onion powder\n1/2 Tablespoon Garlic granulated\n1/2 Tablespoon Pepper\n1 Tablespoon Salt\n1 Pint Spotted Cow\n1 gallon milk\n80 slices american (Two Blocks)\n8 cups shredded cheddar", instructions: "Start with a gallon of milk over a double boiler.\nIn a separate pot, melt the butter. Once melted, add the flour and all seasonings (mustard, onion, garlic, pepper, salt). Whisk together to make a roux.\nOnce combined, add the pint of Spotted Cow to the roux and mix well.\nOnce the milk is steaming, add your roux and mix thoroughly.\nImmediately after, add the American and cheddar cheeses and mix thoroughly.\nTake off heat and cool down." },
      { title: "Cheesy Potato Bacon Soup", category: "Side", prepTime: "45 mins", yieldAmt: "2 White Buckets", ingredients: "1 White Bucket Peeled Potatoes\n1 1/2 Budlight Pitchers Water\n1 Bag Cheese Mix\n1 Gallon Milk\n1 Bag Bacon Bits\n1 Block American Cheese\n1 Tablespoon granulated garlic\n1 Tablespoon granulated onion\n1 Tablespoon Kosher Salt\n1/2 Tablespoon Black pepper", instructions: "Put peeled potatoes through potato slicer and dice small. Boil, then drain.\nUse metal pot for double boiler. Use second metal pot on top.\nBring 1 1/2 Budlight pitchers of water to a steam.\nWhisk 1 bag of cheese mix into the steaming water.\nAdd 1 gallon milk, 1 bag bacon bits, and all seasonings (garlic, onion, salt, pepper).\nGradually add American cheese block by slice. Heat until cheese is thoroughly combined.\nSplit the boiled potatoes and the cheese sauce evenly between two white buckets." }
    ];

    let count = 0;
    for (const recipe of legacyData) {
      if (!recipes.find(r => r.title === recipe.title)) {
        await addDoc(collection(db, "recipes"), { ...recipe, authorName: "System", authorId: "system", lastUpdated: new Date().toISOString(), restaurantId: appUser.restaurantId });
        count++;
      }
    }
    addToast('Import Complete', `Injected ${count} legacy recipes.`);
  };

  const filteredRecipes = recipes.filter(r => { const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.ingredients.toLowerCase().includes(searchTerm.toLowerCase()); const matchesCat = filterCat === 'All' || r.category === filterCat; return matchesSearch && matchesCat; }).sort((a,b) => a.title.localeCompare(b.title));

  const canManageRecipes = appUser?.isAdmin || appUser?.permissions?.team || appUser?.permissions?.prep || appUser?.isSuperAdmin || ['geoffrm1985@gmail.com', 'geoffm1985@gmail.com'].includes((appUser?.email || '').toLowerCase().trim());
  const canModifyRecipe = activeRecipe && (canManageRecipes || appUser?.id === activeRecipe.authorId);
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className={`${T.card} p-4 sm:p-5 flex flex-col gap-4`}>
        
        {/* Top Row: Search and Category Filter */}
        <div className="flex flex-col md:flex-row gap-3 w-full">
          <div className="flex-1 w-full relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D4A381]" size={20}/>
            <input type="text" placeholder="Search recipes or ingredients..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className={`${T.input} pl-12`}/>
          </div>
          <select value={filterCat} onChange={(e)=>setFilterCat(e.target.value)} className={`${T.input} md:w-48`}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Bottom Row: Action Buttons */}
        <div className="flex flex-wrap gap-2 justify-end w-full">
          
          {/* ONLY GEOFF CAN SEE THIS BUTTON */}
          {['geoffrm1985@gmail.com', 'geoffm1985@gmail.com'].includes((appUser?.email || '').toLowerCase().trim()) && (
            <button onClick={handleInjectLegacyRecipes} className={`bg-[#12161A] text-slate-300 border border-[#2A353D] font-bold rounded-xl hover:text-emerald-400 transition-all px-4 py-2 text-xs flex items-center justify-center gap-2`} title="Inject Card Recipes"><Package size={16} /> Import</button>
          )}

          {canManageRecipes && (
            <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
              
              <div className={`flex flex-1 sm:flex-none bg-[#12161A] border border-[#2A353D] rounded-xl overflow-hidden shadow-sm ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 cursor-pointer hover:bg-[#1A2126] transition-colors border-r border-[#2A353D] text-slate-300 hover:text-[#D4A381]" title="Take Photo">
                    {isScanning ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
                    <input type="file" accept="image/*" capture="environment" onChange={handleScanRecipe} className="hidden" disabled={isScanning} />
                 </label>
                 <label className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 cursor-pointer hover:bg-[#1A2126] transition-colors text-slate-300 hover:text-[#D4A381]" title="Upload Photo">
                    <span className="text-[10px] font-black uppercase tracking-wider">Upload</span>
                    <input type="file" accept="image/*" onChange={handleScanRecipe} className="hidden" disabled={isScanning} />
                 </label>
              </div>

              <button onClick={() => { resetForm(); setIsFormOpen(true); }} className={`${T.btn} flex-1 sm:flex-none flex items-center justify-center gap-2 whitespace-nowrap py-2 px-4 text-xs`}>
                <Plus size={16}/> New Spec
              </button>
            </div>
          )}
        </div>
      </div>
      {filteredRecipes.length === 0 ? (
        <div className={`text-center py-20 px-4 border-2 border-dashed ${T.border} rounded-3xl`}><ChefHat className={`mx-auto ${T.copper} mb-4`} size={48}/><h3 className={`text-lg font-black ${T.muted}`}>No recipes found.</h3></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map(r => (
            <div key={r.id} onClick={() => { setActiveRecipe(r); setYieldMult(1); }} className={`${T.card} p-5 hover:border-[#D4A381] transition-all cursor-pointer group flex flex-col h-full`}>
              <div className="flex justify-between items-start mb-3"><span className={`text-[10px] font-black uppercase tracking-wider bg-[#12161A] border ${T.border} ${T.copper} px-2 py-1 rounded-md`}>{r.category}</span><span className={`text-[10px] font-bold ${T.muted} group-hover:text-[#D4A381]`}>View Spec →</span></div>
              <h3 className="text-xl font-black text-white mb-auto leading-tight">{r.title}</h3>
              <div className={`flex items-center gap-4 mt-5 pt-4 border-t ${T.border}`}><div className={`flex items-center gap-1.5 text-xs font-bold ${T.muted}`}><Clock size={14}/> {r.prepTime}</div><div className={`flex items-center gap-1.5 text-xs font-bold ${T.muted}`}><Scale size={14}/> Yield: {r.yieldAmt}</div></div>
            </div>
          ))}
        </div>
      )}
      
      <Modal isOpen={!!activeRecipe} onClose={() => setActiveRecipe(null)} title="Spec Sheet">
        {activeRecipe && (
          <div className="space-y-6">
            <div className={`border-b ${T.border} pb-4`}><h2 className="text-2xl font-black text-white leading-tight mb-2">{activeRecipe.title}</h2><div className={`flex flex-wrap gap-2 text-xs font-bold ${T.muted}`}><span className={`bg-[#12161A] border ${T.border} px-2 py-1 rounded-md`}>{activeRecipe.category}</span><span className={`bg-[#12161A]
border ${T.border} px-2 py-1 rounded-md flex items-center gap-1`}><Clock size={12}/> {activeRecipe.prepTime}</span><span className={`bg-[#12161A] border ${T.border} px-2 py-1 rounded-md flex items-center gap-1 ${yieldMult !== 1 ? T.copper : ''}`}><Scale size={12}/> Yield: {parseAndMultiply(activeRecipe.yieldAmt, yieldMult)}</span></div></div>
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#12161A] p-3 rounded-xl border ${T.border} mb-6`}><span className={`text-[10px] font-black uppercase ${T.muted} tracking-widest`}>Yield Multiplier</span><div className={`flex bg-[#1A2126] rounded-lg p-1 border ${T.border}`}>{[0.5, 1, 2, 4].map(m => (<button key={m} onClick={() => setYieldMult(m)} className={`px-4 py-1.5 text-xs font-black rounded-md transition-all ${yieldMult === m ? `${T.grad} text-slate-900` : `text-slate-500 hover:text-white`}`}>{m}x</button>))}</div></div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="md:col-span-2 space-y-3"><h4 className={`text-[10px] font-black ${T.muted} uppercase tracking-widest border-b ${T.border} pb-1`}>Ingredients <span className={`lowercase ml-1 ${yieldMult !== 1 ? T.copper : ''}`}>({yieldMult}x)</span></h4><ul className="space-y-2 text-sm font-bold text-slate-300">{activeRecipe.ingredients.split('\n').map((ing, i) => ing.trim() && <li key={i} className="flex items-start gap-2"><div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${yieldMult !== 1 ? 'bg-[#D4A381]' : 'bg-slate-500'}`}/><span>{parseAndMultiply(ing, yieldMult)}</span></li>)}</ul></div>
              <div className="md:col-span-3 space-y-3"><h4 className={`text-[10px] font-black ${T.muted} uppercase tracking-widest border-b ${T.border} pb-1`}>Method</h4><div className="space-y-3 text-sm font-medium text-slate-300">{activeRecipe.instructions.split('\n').map((step, i) => step.trim() && <p key={i} className="leading-relaxed"><strong className="text-white mr-1">{i+1}.</strong>{step}</p>)}</div></div>
            </div>
            
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6 border-t ${T.border} mt-6`}>
              <div className={`text-[10px] font-bold ${T.muted}`}>
                Added by {activeRecipe.authorName} <br/> 
                {activeRecipe.lastUpdated && <span className="opacity-70">Updated: {new Date(activeRecipe.lastUpdated).toLocaleDateString()}</span>}
              </div>
              
              {canModifyRecipe && (
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={handleEdit} className="flex-1 sm:flex-none flex justify-center items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 bg-[#12161A] border border-[#2A353D] px-4 py-2 rounded-lg transition-colors"><Edit size={14}/> Edit</button>
                  <button onClick={() => handleDelete(activeRecipe.id)} className="flex-1 sm:flex-none flex justify-center items-center gap-1 text-xs font-bold text-red-500 hover:text-red-400 bg-[#12161A] border border-[#2A353D] px-4 py-2 rounded-lg transition-colors"><Trash2 size={14}/> Delete</button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingRecipeId ? "Edit Spec" : "Add New Spec"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className={T.label}>Recipe Title</label><input type="text" value={title} onChange={(e)=>setTitle(e.target.value)} className={T.input} required placeholder="e.g. House Ranch"/></div>
          <div className="grid grid-cols-3 gap-3"><div><label className={T.label}>Category</label><select value={category} onChange={(e)=>setCategory(e.target.value)} className={T.input}>{categories.slice(1).map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className={T.label}>Prep Time</label><input type="text" value={prepTime} onChange={(e)=>setPrepTime(e.target.value)} className={T.input} placeholder="e.g. 15 mins"/></div><div><label className={T.label}>Yield</label><input type="text" value={yieldAmt} onChange={(e)=>setYieldAmt(e.target.value)} className={T.input} placeholder="e.g. 4 Quarts"/></div></div>
          <div><label className={T.label}>Ingredients (One per line)</label><textarea value={ingredients} onChange={(e)=>setIngredients(e.target.value)} rows="5" className={T.input} required placeholder="1 Cup Mayo&#10;1/2 Cup Buttermilk&#10;1 Tbsp Dill"/></div>
          <div><label className={T.label}>Method / Instructions (One step per line)</label><textarea value={instructions} onChange={(e)=>setInstructions(e.target.value)} rows="5" className={T.input} required placeholder="Combine mayo and buttermilk in cambro.&#10;Whisk in dry seasoning.&#10;Label and date."/></div>
          <button type="submit" className={`w-full ${T.btn}`}>{editingRecipeId ? "Update Recipe" : "Save Recipe"}</button>
        </form>
      </Modal>
    </div>
  );
};

export default TabRecipes;
