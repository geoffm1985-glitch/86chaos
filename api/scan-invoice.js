import admin from 'firebase-admin';

// 1. Bulletproof Firebase Init (Matches your Push Notifications perfectly)
if (!admin.apps.length) {
  if (process.env.FIREBASE_PRIVATE_KEY) {
    const cleanKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: cleanKey,
      }),
    });
  } else {
    // Fallback
    admin.initializeApp({ projectId: 'cheers-34b8d' });
  }
}

export const config = {
  regions: ['iad1'],
  maxDuration: 60, // Tells Vercel to allow up to 60 seconds for the AI to read the invoice
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // --- THE BOUNCER: VERIFY FIREBASE AUTH TOKEN ---
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token.' });
  }

  const authToken = authHeader.split('Bearer ')[1];

  try {
    await admin.auth().verifyIdToken(authToken);
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Fake or expired token.' });
  }
  // --- END OF BOUNCER ---

  try {
    const { fileBase64, mimeType } = req.body;
    
    const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/['"]/g, '');
    if (!apiKey) throw new Error("API Key is missing from Vercel.");

    const base64Data = fileBase64.split(',')[1] || fileBase64;

    const prompt = `You are an expert restaurant accountant. Extract the data from this invoice and return it strictly as a raw JSON object. Do not include markdown formatting or backticks.\n\nCRITICAL: You MUST extract the product code (SKU, Item #, Product ID) for EVERY item. Supplier formats vary wildly. Look for alphanumeric strings/numbers under headers like "Item", "SKU", "Code", or floating near the item description/brand name (e.g., 13206, VF480, SYS-998). Isolate this code completely; do not merge it into the item name. If no code exists, return an empty string.\n\nRequired keys:\n- "vendorName" (string)\n- "invoiceDate" (string)\n- "invoiceTotal" (number)\n- "lineItems" (an array of objects containing "itemName" (string), "productCode" (string), "quantity" (number), "packSize" (string), "unitPrice" (number), and "totalPrice" (number)).`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType || "application/pdf", data: base64Data } }
          ]
        }]
      })
    });

    const data = await response.json();

    if (data.error) throw new Error(data.error.message);

    const rawText = data.candidates[0].content.parts[0].text;
    const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const invoiceData = JSON.parse(cleanText);

    return res.status(200).json(invoiceData);

  } catch (error) {
    console.error("AI Invoice Scan Error:", error);
    return res.status(500).json({ error: error.message || "Failed to process invoice." });
  }
}
