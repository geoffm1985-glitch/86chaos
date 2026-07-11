import projectAdmin from './_firebase-project-admin.js';
import aiUsage from './_ai-usage.js';
import rateLimit from './_rate-limit.js';
import chaosAdmin from './_chaos-admin.js';
import aiPolicy from './_ai-policy.js';

const { verifyRequestToken } = projectAdmin;
const { authorizeAiScanWorkspace, getIdempotencyKey } = aiUsage;
const { enforceRateLimit, sendRateLimited } = rateLimit;
const { requireAppCheckIfEnforced } = chaosAdmin;
const {
  getAllowedGeminiModels,
  getHardOutputTokenLimit,
  getHardRateLimit,
  createProviderCallBudget,
  assertInputWithinHardLimit,
  detectMimeTypeFromBuffer,
  assertImageDimensionsWithinHardLimit,
  reserveAiRequest,
  completeAiRequestLock
} = aiPolicy;

const RECIPE_SCANNER_VERSION = '15.0.52';

export const config = {
  regions: ['iad1'],
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let requestLock = null;
  let providerBudget = null;
  let selectedModel = '';
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const restaurantId = String(body.restaurantId || '').trim();
    if (!restaurantId) return res.status(400).json({ error: 'restaurantId is required.' });

    const authContext = await verifyRequestToken(req, { requireProjectCredentials: true });
    const access = await authorizeAiScanWorkspace({
      app: authContext.app,
      decoded: authContext.decoded,
      restaurantId,
      scanType: 'recipe'
    });
    const appCheck = await requireAppCheckIfEnforced(authContext.app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ error: appCheck.error });

    const recipeRate = await enforceRateLimit({
      db: access.db,
      req,
      decoded: authContext.decoded,
      routeName: 'scan-recipe',
      limit: getHardRateLimit('recipe', process.env.SCAN_RECIPE_RATE_LIMIT),
      windowMs: 60 * 1000
    });
    if (!recipeRate.ok) return sendRateLimited(res, recipeRate);

    const imageBase64 = String(body.imageBase64 || '');
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/i, '');
    if (!cleanBase64 || !/^[A-Za-z0-9+/=\r\n]+$/.test(cleanBase64)) {
      return res.status(400).json({ error: 'A valid recipe image is required.' });
    }
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    assertInputWithinHardLimit('recipe', imageBuffer.length);
    const mimeType = detectMimeTypeFromBuffer(imageBuffer, 'image/jpeg');
    if (!/^image\//i.test(mimeType)) return res.status(415).json({ error: 'Recipe scans must be an image.' });
    assertImageDimensionsWithinHardLimit('recipe', imageBuffer, mimeType);

    requestLock = await reserveAiRequest({
      db: access.db,
      feature: 'recipe',
      restaurantId,
      uid: authContext.decoded.uid,
      idempotencyKey: getIdempotencyKey(req, body)
    });
    if (requestLock.duplicate) {
      return res.status(409).json({
        error: 'This recipe scan was already submitted. Wait for the first request to finish.',
        code: 'AI_SCAN_ALREADY_SUBMITTED',
        status: requestLock.status
      });
    }

    const apiKey = String(process.env.GEMINI_API_KEY || '').trim().replace(/['"]/g, '');
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing from Vercel.');
    selectedModel = getAllowedGeminiModels({
      feature: 'recipe',
      configured: process.env.RECIPE_SCAN_GEMINI_MODEL || process.env.GEMINI_RECIPE_MODEL || '',
      defaults: ['gemini-2.5-flash-lite']
    })[0];
    providerBudget = createProviderCallBudget('recipe');

    const prompt = `You are an expert culinary assistant. Extract the recipe from this image and return it strictly as a raw JSON object. Do not include markdown formatting or backticks.\n\nRequired keys:\n- "title" (string)\n- "prepTime" (string, e.g. "15 mins". If not found, return "--")\n- "yieldAmt" (string, e.g. "4 Quarts" or "24 Patties". If not found, return "--")\n- "ingredients" (string, list one per line, use \\n for line breaks)\n- "instructions" (string, list one step per line, use \\n for line breaks).`;

    providerBudget.consume({ model: selectedModel, attempt: 'recipe-extraction' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45 * 1000);
    let response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: cleanBase64 } }
            ]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0,
            maxOutputTokens: getHardOutputTokenLimit('recipe', process.env.RECIPE_SCAN_MAX_OUTPUT_TOKENS)
          }
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();
    let data = {};
    try { data = JSON.parse(raw || '{}'); } catch (_) {}
    if (!response.ok || data.error) throw new Error(data?.error?.message || `Recipe scanner failed with ${response.status}.`);
    const rawText = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || '';
    if (!rawText) throw new Error('Gemini returned no recipe text.');
    const cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const recipeData = JSON.parse(cleanText);

    await completeAiRequestLock(requestLock, 'completed', {
      providerCallCount: providerBudget.used,
      model: selectedModel
    });
    return res.status(200).json({
      ...recipeData,
      scanModel: selectedModel,
      scannerVersion: RECIPE_SCANNER_VERSION
    });
  } catch (error) {
    await completeAiRequestLock(requestLock, 'failed', {
      providerCallCount: providerBudget?.used || 0,
      model: selectedModel,
      errorCode: error?.code || error?.name || 'RECIPE_SCAN_FAILED'
    }).catch(() => null);
    console.error('AI Recipe Scan Error:', error);
    const isTimeout = error?.name === 'AbortError';
    const status = error?.statusCode || (isTimeout ? 504 : (/authorization|token|permission|login/i.test(error?.message || '') ? 401 : 500));
    return res.status(status).json({
      error: isTimeout ? 'Recipe scanning timed out before the hard request deadline. Try a clearer image.' : (error.message || 'Failed to process recipe.'),
      code: error?.code || undefined,
      scannerVersion: RECIPE_SCANNER_VERSION
    });
  }
}
