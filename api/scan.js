import projectAdmin from './_firebase-project-admin.js';

const { verifyRequestToken } = projectAdmin;

export const config = {
  regions: ['iad1'],
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Verify against the Firebase project named by the signed token. Recipe scanning
  // does not read or write Firestore, so it can use Google's public signing keys
  // when a matching server service account is not required.
  try {
    await verifyRequestToken(req, { requireProjectCredentials: false });
  } catch (error) {
    console.error('Recipe scan authentication error:', error);
    return res.status(403).json({ error: `Authorization failed: ${error.message}` });
  }

  // ... (Keep your existing try/catch Gemini fetch logic below here exactly as it is) ...
  try {
    const { imageBase64 } = req.body;
    
    // Clean the API key
    const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/['"]/g, '');

    if (!apiKey) throw new Error("API Key is missing from Vercel.");

    // Strip the data URL prefix if it exists
    const base64Data = imageBase64.split(',')[1] || imageBase64;

    // Strict culinary prompt to pull the exact fields the 86chaos frontend expects
    const prompt = `You are an expert culinary assistant. Extract the recipe from this image and return it strictly as a raw JSON object. Do not include markdown formatting or backticks.\n\nRequired keys:\n- "title" (string)\n- "prepTime" (string, e.g. "15 mins". If not found, return "--")\n- "yieldAmt" (string, e.g. "4 Quarts" or "24 Patties". If not found, return "--")\n- "ingredients" (string, list one per line, use \\n for line breaks)\n- "instructions" (string, list one step per line, use \\n for line breaks).`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (data.error) throw new Error(data.error.message);

    const rawText = data.candidates[0].content.parts[0].text;
    
    // Safety net for JSON parsing
    const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const recipeData = JSON.parse(cleanText);
    return res.status(200).json(recipeData);

  } catch (error) {
    console.error("AI Recipe Scan Error:", error);
    return res.status(500).json({ error: error.message || "Failed to process recipe." });
  }
}
