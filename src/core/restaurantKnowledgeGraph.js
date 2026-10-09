import {graphMenuIdentity} from './operationalEvidence.js';
import menuApprovalHelpers from './menuApproval.js';
const {isApprovedDependency}=menuApprovalHelpers;
const rows = value => Array.isArray(value) ? value : [];
const text = value => String(value == null ? '' : value).trim();
const lower = value => text(value).toLowerCase();
const slug = value => lower(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
const stableId = (type, source = {}) => `${type}:${text(source.id || source[`${type}Id`] || source.sku || source.code || source.name || source.title || slug(JSON.stringify(source).slice(0, 80)))}`;
const belongs = (row, workspaceId) => !row?.restaurantId || !workspaceId || text(row.restaurantId) === workspaceId;
const unique = values => Array.from(new Set(rows(values).flatMap(value => typeof value === 'string' ? value.split(/[,;\n]/) : [value]).map(text).filter(Boolean)));

function buildRestaurantKnowledgeGraph(input = {}) {
  const workspaceId = text(input.workspaceId || input.restaurantId);
  const nodes = new Map(), edges = new Map(), missingLinks = [];
  const addNode = (type, source, extra = {}) => {
    if (!belongs(source, workspaceId)) return null;
    const id = stableId(type, source);
    nodes.set(id, { id, type, workspaceId, label:text(source.name || source.title || source.itemName || source.description || source.sku || id), sourceId:text(source.id || ''), ownerId:text(source.ownerId || source.approvedBy || source.costingApprovedBy),updatedAt:text(source.updatedAt || source.approvedAt || source.costingApprovedAt),safetyVerified:Boolean(source.safetyVerified || source.allergensReviewedAt && source.allergensReviewedBy),evidence:extra.evidence || { sourceType:type, sourceId:text(source.id || ''),sourceIds:rows(source.sourceIds) }, ...extra });
    return id;
  };
  const addEdge = (from, to, type, source = {}, extra = {}) => {
    if (!from || !to) return null;
    const id = `${from}|${type}|${to}`;
    edges.set(id, { id, from, to, type, workspaceId, evidence:{ sourceType:text(source.sourceType || 'configured-link'), sourceId:text(source.id || source.sourceId || '') }, confidence:Number.isFinite(Number(extra.confidence)) ? Number(extra.confidence) : 1, ...extra });
    return id;
  };
  const indexById = list => {
    const index=new Map(),ambiguous=new Set();
    for(const row of list)for(const key of [text(row.id),text(row.sku || row.code),slug(row.name || row.title || row.itemName)])if(key){if(index.has(key) && index.get(key)!==row)ambiguous.add(key);else index.set(key,row);}
    for(const key of ambiguous)index.delete(key);
    return index;
  };

  const inventory = rows(input.inventoryItems).filter(row => belongs(row, workspaceId));
  const recipes = rows(input.recipes).filter(row => belongs(row, workspaceId));
  const menu = rows(input.menuItems).filter(row => belongs(row, workspaceId));
  const vendors = rows(input.vendors).filter(row => belongs(row, workspaceId));
  const products = rows(input.vendorProducts).filter(row => belongs(row, workspaceId));
  const invoices = rows(input.invoices).filter(row => belongs(row, workspaceId));
  const inventoryIndex = indexById(inventory), recipeIndex = indexById(recipes), vendorIndex = indexById(vendors), productIndex = indexById(products);

  inventory.forEach(item => addNode('ingredient', item, { unit:text(item.unit || item.uom), casePack:text(item.casePack || item.packSize), splitCase:Boolean(item.splitCaseAllowed || item.splitCase), yield:Number(item.yield || item.yieldQty || 0) || null, allergens:unique(item.allergens), substitutions:unique(item.substitutions) }));
  recipes.forEach(recipe => addNode('recipe', recipe, { yield:Number(recipe.batchYieldQuantity || recipe.yield || recipe.yieldQty || 0) || null, yieldUnit:text(recipe.batchYieldUnit),usableYieldPercent:Number(recipe.batchYieldPercent ?? 100), allergens:unique(recipe.allergens) }));
  menu.forEach(item => addNode('menu', item, { priceCents:item.priceConflict || item.price == null && item.priceCents == null ? null : Number(item.priceCents ?? Math.round(Number(item.price)*100)), allergens:unique(item.allergens) }));
  vendors.forEach(vendor => addNode('vendor', vendor, { aliases:unique(vendor.aliases) }));
  products.forEach(product => addNode('product', product, { sku:text(product.sku || product.productCode), unit:text(product.unit || product.uom), casePack:text(product.casePack || product.packSize), aliases:unique(product.aliases || product.vendorAliases) }));
  invoices.forEach(invoice => addNode('invoice', invoice, { invoiceNumber:text(invoice.invoiceNumber), businessDate:text(invoice.businessDate || invoice.invoiceDate) }));

  for (const recipe of recipes) {
    const recipeNode = stableId('recipe', recipe);
    const ingredients = rows(recipe.ingredients).length ? rows(recipe.ingredients) : unique(recipe.ingredients).map(name => ({ name }));
    for (const ingredient of ingredients) {
      const reference = text(ingredient.inventoryItemId || ingredient.ingredientId || ingredient.id || slug(ingredient.name || ingredient.itemName));
      const match = inventoryIndex.get(reference) || inventoryIndex.get(slug(ingredient.name || ingredient.itemName));
      if (!match) {
        missingLinks.push({ type:'recipe-ingredient', workspaceId, sourceId:text(recipe.id), sourceLabel:text(recipe.name || recipe.title), missingReference:text(ingredient.name || ingredient.itemName || reference), reason:'Recipe ingredient has no deterministic inventory relationship.' });
        continue;
      }
      addEdge(recipeNode, stableId('ingredient', match), 'uses', ingredient, { quantity:Number(ingredient.quantity || ingredient.qty || 0) || null, unit:text(ingredient.unit || ingredient.uom), yield:Number(ingredient.yield || 0) || null });
    }
  }

  for (const item of menu) {
    const menuNode = stableId('menu', item);
    const references = unique(item.recipeIds || item.recipeId || item.recipes);
    if (!references.length) missingLinks.push({ type:'menu-recipe', workspaceId, sourceId:text(item.id), sourceLabel:text(item.name || item.title), missingReference:'recipe', reason:'Menu item is not linked to a recipe.' });
    for (const reference of references) {
      const recipe = recipeIndex.get(text(reference)) || recipeIndex.get(slug(reference));
      if (recipe) addEdge(menuNode, stableId('recipe', recipe), 'prepared-from', item);
      else missingLinks.push({ type:'menu-recipe', workspaceId, sourceId:text(item.id), sourceLabel:text(item.name || item.title), missingReference:reference, reason:'Configured recipe reference cannot be resolved.' });
    }
  }

  for (const link of rows(input.menuDependencies).filter(row => belongs(row, workspaceId) && isApprovedDependency(row))) {
    const batchRecipe=recipeIndex.get(text(link.recipeId || link.batchRecipeId));
    const ingredient=inventoryIndex.get(text(link.inventoryItemId));
    if(batchRecipe && ingredient)addEdge(stableId('recipe',batchRecipe),stableId('ingredient',ingredient),'uses',link,{quantity:Number(link.batchQuantity || link.quantity) || null,unit:text(link.batchUnit || link.unit),reviewed:link.source==='approved_batch_recipe'});
    if(!graphMenuIdentity(link))continue;
    const menuItem = menu.find(row => text(row.id) === graphMenuIdentity(link)) || { id:graphMenuIdentity(link), name:link.menuItemName };
    const inventoryItem = inventoryIndex.get(text(link.inventoryItemId)) || inventoryIndex.get(slug(link.inventoryItemName));
    const menuNode = nodes.has(stableId('menu', menuItem)) ? stableId('menu', menuItem) : addNode('menu', menuItem, { inferred:true });
    if (inventoryItem) addEdge(menuNode, stableId('ingredient', inventoryItem), 'direct-inventory-impact', link, { confidence:Number(link.confidence || 1) });
    else if (!batchRecipe || link.inventoryItemId || link.inventoryItemName) missingLinks.push({ type:'menu-inventory', workspaceId, sourceId:text(link.id || link.menuItemId), sourceLabel:text(link.menuItemName), missingReference:text(link.inventoryItemName || link.inventoryItemId), reason:'Menu dependency references missing inventory.' });
  }

  for (const product of products) {
    const productNode = stableId('product', product);
    const vendor = vendorIndex.get(text(product.vendorId)) || vendorIndex.get(slug(product.vendorName));
    if (vendor) addEdge(stableId('vendor', vendor), productNode, 'supplies', product);
    else missingLinks.push({ type:'vendor-product', workspaceId, sourceId:text(product.id), sourceLabel:text(product.name), missingReference:text(product.vendorName || product.vendorId), reason:'Vendor product has no resolvable vendor.' });
    const inventoryItem = inventoryIndex.get(text(product.inventoryItemId)) || inventoryIndex.get(slug(product.inventoryItemName || product.name));
    if (inventoryItem) addEdge(productNode, stableId('ingredient', inventoryItem), 'maps-to', product, { aliases:unique(product.aliases || product.vendorAliases) });
    else missingLinks.push({ type:'product-inventory', workspaceId, sourceId:text(product.id), sourceLabel:text(product.name), missingReference:text(product.inventoryItemName || product.name), reason:'Vendor product is not linked to inventory.' });
  }

  for (const invoice of invoices) {
    const invoiceNode = stableId('invoice', invoice);
    for (const line of rows(invoice.lineItems || invoice.lines || invoice.items)) {
      const product = productIndex.get(text(line.vendorProductId || line.productId || `${invoice.vendorId}:${line.productCode || line.sku}`)) || productIndex.get(text(line.productCode || line.sku)) || productIndex.get(slug(line.itemName || line.description));
      if (product) addEdge(invoiceNode, stableId('product', product), 'prices', line, { unitPriceCents:Number(line.unitPriceCents || Math.round(Number(line.unitPrice || 0) * 100)) || 0, quantity:Number(line.quantity || line.qty || 0) || 0 });
      else missingLinks.push({ type:'invoice-product', workspaceId, sourceId:text(invoice.id), sourceLabel:text(invoice.invoiceNumber), missingReference:text(line.itemName || line.sku), reason:'Invoice line has no deterministic vendor-product match.' });
    }
  }

  const nodeRows = [...nodes.values()].sort((a,b) => a.id.localeCompare(b.id));
  const edgeRows = [...edges.values()].sort((a,b) => a.id.localeCompare(b.id));
  const allergenRelationships = nodeRows.flatMap(node => rows(node.allergens).map(allergen => ({ nodeId:node.id, allergen:text(allergen), verified:node.safetyVerified===true,evidence:node.evidence })));
  const substitutionRelationships = nodeRows.flatMap(node => rows(node.substitutions).map(substitution => ({ nodeId:node.id, substitution:text(substitution), reviewRequired:true })));
  const impacts=nodeRows.filter(node=>node.type==='menu').map(menuNode=>{
    const visited=new Set(),pending=[menuNode.id],paths=[];
    while(pending.length){const id=pending.shift();if(visited.has(id))continue;visited.add(id);for(const edge of edgeRows.filter(row=>row.from===id && ['prepared-from','uses','direct-inventory-impact'].includes(row.type))){paths.push(edge.id);pending.push(edge.to);}}
    const ingredients=inventory.filter(item=>visited.has(stableId('ingredient',item)));
    const low=ingredients.filter(item=>Number(item.currentStock)<=Number(item.parLevel || 0));
    const safety=nodeRows.filter(node=>visited.has(node.id)).flatMap(node=>rows(node.allergens).map(allergen=>({allergen,sourceId:node.sourceId,verified:node.safetyVerified===true})));
    return {menuId:menuNode.sourceId,menuName:menuNode.label,ingredientIds:ingredients.map(row=>row.id),lowStockIds:low.map(row=>row.id),stock86Impact:!ingredients.length || ingredients.some(row=>row.currentStock==null || !Number.isFinite(Number(row.currentStock)))?'unknown':low.some(row=>Number(row.currentStock)<=0)?'high':low.length?'watch':'normal',priceCents:menuNode.priceCents,allergens:safety,substitutions:ingredients.flatMap(row=>unique(row.substitutions).map(substitution=>({inventoryItemId:row.id,substitution,reviewRequired:true}))),evidencePathIds:paths,reviewRequired:true};
  });
  return {
    schemaVersion:1,
    workspaceId,
    nodes:nodeRows,
    edges:edgeRows,
    missingLinks:missingLinks.sort((a,b) => `${a.type}:${a.sourceId}`.localeCompare(`${b.type}:${b.sourceId}`)),
    allergenRelationships,
    impacts,
    substitutionRelationships,
    coverage:{ nodes:nodeRows.length, edges:edgeRows.length, missing:missingLinks.length, complete:missingLinks.length === 0 && nodeRows.length > 0 },
    readModel:'indexed-firebase-relationships',
    explainable:true,
    reviewOnly:true
  };
}

export { buildRestaurantKnowledgeGraph };

export default { buildRestaurantKnowledgeGraph };
