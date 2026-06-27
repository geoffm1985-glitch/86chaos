export default async function handler(req, res) {
  // 1. Reject any request that isn't a POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // 2. Grab the image data sent from your App.js and the hidden API key
    const { imageBase64 } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("API Key is missing from Vercel Environment Variables.");
    }

    // 3. Strip the prefix off the base64 image string so the AI can read it
    const base64Data = imageBase64.split(',')[1];

    // 4. Give the AI its strict operating instructions
    const prompt = `You are an expert culinary AI. Read this recipe card. Extract the data and return it strictly as a raw JSON object. Do not include markdown formatting or backticks.
    Required keys:
    - "title" (string)
    - "prepTime" (string, use "--" if missing)
    - "yieldAmt" (string, use "--" if missing)
    - "ingredients" (string, each ingredient on a new line)
    - "instructions" (string, each step on a new line)`;

    // 5. Send the payload to Google's Gemini 1.5 Flash Vision Model
const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: base64Data } }
          ]
        }],
        generationConfig: { 
            response_mime_type: "application/json" 
        }
      })
    });

    const data = await response.json();

    // 6. Catch API errors
    if (data.error) {
      throw new Error(data.error.message);
    }

    // 7. Extract the clean JSON and send it back to your app
    const rawText = data.candidates[0].content.parts[0].text;
    const recipeData = JSON.parse(rawText);

    return res.status(200).json(recipeData);

  } catch (error) {
    console.error("AI Scan Error:", error);
    return res.status(500).json({ error: error.message || "Failed to process image." });
  }
}
