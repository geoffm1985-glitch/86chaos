const { initAdmin, readBody, writeAudit, norm, masterEmails, readWorkspaceMember, userHasWorkspace, profileForWorkspace } = require('./_chaos-admin');

function cleanJsonText(text = '') {
  return String(text || '').replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}

function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findInventoryMatch(ingredientName = '', inventoryItems = []) {
  const key = normalize(ingredientName);
  if (!key) return null;
  const scored = (inventoryItems || []).map(item => {
    const itemKey = normalize(item.name);
    let score = 0;
    if (itemKey === key) score = 100;
    else if (itemKey.includes(key) || key.includes(itemKey)) score = 84;
    else {
      const tokens = key.split(' ').filter(t => t.length > 2);
      const hits = tokens.filter(t => itemKey.includes(t)).length;
      score = hits ? Math.round((hits / Math.max(tokens.length, 1)) * 70) : 0;
    }
    return { item, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 60 ? scored[0].item : null;
}

function normalizeMenuPayload(parsed = {}, inventoryItems = []) {
  const rows = Array.isArray(parsed.menuItems) ? parsed.menuItems : [];
  return rows.map((row, index) => {
    const ingredients = Array.isArray(row.ingredients) ? row.ingredients : [];
    return {
      rowIndex: index + 1,
      name: row.name || row.menuItemName || `Menu item ${index + 1}`,
      category: row.category || row.menuCategory || '',
      description: row.description || '',
      confidence: row.confidence || parsed.confidence || 'review',
      ingredients: ingredients.map((ingredient) => {
        const ingredientName = typeof ingredient === 'string' ? ingredient : (ingredient.name || ingredient.ingredientName || ingredient.itemName || '');
        const match = findInventoryMatch(ingredientName, inventoryItems);
        return {
          name: ingredientName,
          confidence: ingredient.confidence || row.confidence || 'review',
          matchedInventoryItemId: match?.id || '',
          matchedInventoryItemName: match?.name || ''
        };
      }).filter(i => i.name)
    };
  }).filter(item => item.name);
}

async function loadCaller(app, decoded, restaurantId) {
  const db = app.firestore();
  let userSnap = await db.collection('users').doc(decoded.uid).get();
  let userDocId = decoded.uid;
  let user = userSnap.exists ? userSnap.data() : null;
  const email = norm(decoded.email);
  if (!user && email) {
    const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!byEmail.empty) {
      userSnap = byEmail.docs[0];
      userDocId = userSnap.id;
      user = userSnap.data();
    }
  }
  const member = await readWorkspaceMember(db, decoded.uid, email, restaurantId);
  return { userDocId, accountUser: { ...(user || {}), id: userDocId }, member };
}

async function canScanMenu(app, ctx, restaurantId) {
  const db = app.firestore();
  const email = norm(ctx.decoded.email || ctx.accountUser.email);
  const restSnap = await db.collection('restaurants').doc(restaurantId).get();
  const rest = restSnap.exists ? restSnap.data() : {};
  const workspaceUser = profileForWorkspace(ctx.accountUser, ctx.member, restaurantId);
  const permissions = workspaceUser.permissions || {};
  return Boolean(
    ctx.decoded.superAdmin === true ||
    ctx.accountUser.isSuperAdmin === true ||
    masterEmails().includes(email) ||
    rest.ownerUserId === ctx.userDocId ||
    rest.ownerUid === ctx.userDocId ||
    norm(rest.ownerEmail) === email ||
    workspaceUser.isOwner === true ||
    workspaceUser.accountOwner === true ||
    workspaceUser.workspaceOwner === true ||
    permissions.menuIntelligence === true ||
    userHasWorkspace(ctx.accountUser, restaurantId) && permissions.menuIntelligence === true
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  try {
    const app = initAdmin();
    const db = app.firestore();
    const body = await readBody(req);
    const restaurantId = String(body.restaurantId || '').trim();
    if (!restaurantId) return res.status(400).json({ ok: false, error: 'restaurantId is required.' });

    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase authorization token.' });
    const decoded = await app.auth().verifyIdToken(token);
    const caller = await loadCaller(app, decoded, restaurantId);
    const ctx = { ...caller, decoded, uid: decoded.uid, email: decoded.email || '', user: caller.accountUser, restaurantId };
    if (!(await canScanMenu(app, ctx, restaurantId))) return res.status(403).json({ ok: false, error: 'Menu Intelligence access is required.' });

    const storagePath = String(body.storagePath || '').trim();
    if (!storagePath) return res.status(400).json({ ok: false, error: 'storagePath is required.' });
    if (!storagePath.startsWith(`${restaurantId}/menuUploads/`)) return res.status(403).json({ ok: false, error: 'Menu upload path is not restaurant-scoped.' });

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: 'Missing GEMINI_API_KEY in Vercel environment variables.' });

    const [buffer] = await app.storage().bucket().file(storagePath).download();
    const contentType = body.contentType || 'application/octet-stream';
    const inventoryItems = Array.isArray(body.inventoryItems) ? body.inventoryItems : [];
    const prompt = [
      'You are helping a restaurant build menu-to-inventory dependency records.',
      'Read the uploaded menu image or PDF and return JSON only.',
      'Schema: {"menuItems":[{"name":"","category":"","description":"","confidence":"high|medium|low","ingredients":[{"name":"","confidence":"high|medium|low"}]}],"confidence":"high|medium|low","notes":[]}.',
      'Only include menu items and likely ingredients. Do not include prices as ingredients.',
      `Known inventory names for matching context: ${inventoryItems.map(i => i.name).filter(Boolean).slice(0, 350).join(', ')}`
    ].join('\n');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: contentType, data: buffer.toString('base64') } }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'Gemini menu scan failed.');
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
    const parsed = JSON.parse(cleanJsonText(text || '{}'));
    const menuItems = normalizeMenuPayload(parsed, inventoryItems);

    await writeAudit(db, ctx, 'MENU_SCAN_REVIEW_CREATED', body.fileName || storagePath, `${menuItems.length} menu items returned for review.`, restaurantId);
    return res.status(200).json({
      ok: true,
      menuItems,
      confidence: parsed.confidence || 'review',
      notes: parsed.notes || [],
      fileName: body.fileName || '',
      storagePath
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Menu scan failed.' });
  }
};
