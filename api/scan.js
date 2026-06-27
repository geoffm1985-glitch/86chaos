// Force Vercel to run strictly in the US (Washington D.C.) to avoid geo-blocks
export const config = {
  regions: ['iad1'],
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { imageBase64 } = req.body;
    
    // Clean the API key of any accidental spaces or quotes
    const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/['"]/g, '');

    if (!apiKey) throw new Error("API Key is missing from Vercel.");

    const base64Data = imageBase64.split(',')[1] || imageBase64;

    const prompt = `You are an expert culinary AI. Read this recipe card. Extract the data and return it strictly as a raw JSON object. Do not include markdown formatting or backticks.\nRequired keys:\n- "title" (string)\n- "prepTime" (string, use "--" if missing)\n- "yieldAmt" (string, use "--" if missing)\n- "ingredients" (string, each ingredient on a new line)\n- "instructions" (string, each step on a new line)`;

    // STRICTLY using the stable v1 endpoint that successfully connected earlier
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              // STRICTLY using snake_case so Google doesn't drop the payload
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
    
    // Our built-in safety net catches the JSON perfectly
    const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const recipeData = JSON.parse(cleanText);
    return res.status(200).json(recipeData);

  } catch (error) {
    console.error("AI Scan Error:", error);
    return res.status(500).json({ error: error.message || "Failed to process image." });
  }
}
