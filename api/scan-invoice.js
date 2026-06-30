import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Override Vercel's default 1MB upload limit so PDFs don't crash the server
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "Missing file data." });
    }

    // Isolate base64 data string
    const base64Data = fileBase64.split(",")[1] || fileBase64;

    // Strict JSON Schema forces the AI to output these exact fields
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        vendorName: { type: SchemaType.STRING },
        invoiceDate: { type: SchemaType.STRING },
        invoiceTotal: { type: SchemaType.NUMBER },
        lineItems: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              itemName: { type: SchemaType.STRING },
              productCode: { type: SchemaType.STRING, description: "The isolated SKU or Product Code." },
              quantity: { type: SchemaType.NUMBER },
              packSize: { type: SchemaType.STRING },
              unitPrice: { type: SchemaType.NUMBER },
              totalPrice: { type: SchemaType.NUMBER }
            },
            required: ["itemName", "productCode", "quantity", "unitPrice", "totalPrice"]
          }
        }
      },
      required: ["vendorName", "invoiceTotal", "lineItems"]
    };

    // The Generalized System Instruction for ALL suppliers
    const systemInstruction = `
    You are an expert restaurant inventory accounting engine extracting data from supplier invoices.
    
    CRITICAL RULES FOR PRODUCT CODES (SKUs):
    1. You MUST extract a product code (SKU, Item #, Product ID) for EVERY item and return it in the "productCode" field.
    2. Supplier formats vary wildly. To find the product code, look for:
       - Alphanumeric strings or numbers under headers like "Item", "Item #", "SKU", "Product ID", or "Code".
       - Identifiers floating immediately before, above, or below the main item description or brand name.
       - Formats typically look like identifiers (e.g., 13206, VF480, 100456-2, 00412, SYS-998).
    3. Isolate this code completely. Do not merge it into the item name. If absolutely no code exists anywhere near the item, return an empty string.
    
    CRITICAL RULES FOR MATH & TOTALS:
    1. Calculate the line item total yourself: quantity * unitPrice = totalPrice.
    2. Calculate the exact "invoiceTotal" by summing up all the line item totalPrices you extracted. Documents often contain multiple separate orders appended together. Your invoiceTotal MUST equal the exact sum of your extracted line items.
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // <-- THE FATAL ERROR IS FIXED HERE
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1, // Near zero forces strict robotic accuracy
      },
      systemInstruction: systemInstruction
    });

    const response = await model.generateContent([
      { inlineData: { data: base64Data, mimeType: mimeType } },
      "Extract the vendor data and line items strictly according to the system instructions."
    ]);

    // Safety net: Strip out formatting tags if the AI accidentally includes them
    let rawText = response.response.text();
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const resultData = JSON.parse(rawText);
    return res.status(200).json(resultData);

  } catch (error) {
    console.error("Parse Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
