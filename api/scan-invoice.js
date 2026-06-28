// Force Vercel to run strictly in the US (Washington D.C.)
export const config = {
  regions: ['iad1'],
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { fileBase64, mimeType } = req.body;
    
    // Clean the API key
    const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/['"]/g, '');

    if (!apiKey) throw new Error("API Key is missing from Vercel.");

    // Strip the data URL prefix (e.g., "data:application/pdf;base64,")
    const base64Data = fileBase64.split(',')[1] || fileBase64;

    // Strict accounting prompt
    const prompt = `You are an expert restaurant accountant. Extract the data from this invoice and return it strictly as a raw JSON object. Do not include markdown formatting or backticks.\nRequired keys:\n- "vendorName" (string)\n- "invoiceDate" (string)\n- "invoiceTotal" (number)\n- "lineItems" (an array of objects containing "itemName" (string), "quantity" (number), "packSize" (string), "unitPrice" (number), and "totalPrice" (number)).`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || "application/pdf",
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
    
    const invoiceData = JSON.parse(cleanText);
    return res.status(200).json(invoiceData);

  } catch (error) {
    console.error("AI Invoice Scan Error:", error);
    return res.status(500).json({ error: error.message || "Failed to process invoice." });
  }
}
