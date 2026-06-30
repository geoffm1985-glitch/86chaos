import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

    // The System Instruction that fixes the PFG formatting and the math
    const systemInstruction = `
    You are an expert restaurant inventory accounting engine extracting data from supplier invoices.
    
    CRITICAL RULES FOR PRODUCT CODES (SKUs):
    1. You MUST extract a product code for EVERY item and return it in the "productCode" field.
    2. For PFG / Performance Foodservice documents, the code is usually a 5-to-6 character string (e.g., VF480, EK598, GW640, 13206) found on the line IMMEDIATELY BELOW the main item description, just before the brand name. 
    3. Isolate this code completely. Do not merge it into the item name. If no code exists at all, return an empty string.
    
    CRITICAL RULES FOR MATH & TOTALS:
    1. Calculate the line item total yourself: quantity * unitPrice = totalPrice.
    2. Calculate the exact "invoiceTotal" by summing up all the line item totalPrices you extracted. Documents often contain multiple separate orders appended together. Your invoiceTotal MUST equal the exact sum of your extracted line items.
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
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

    const resultData = JSON.parse(response.response.text());
    return res.status(200).json(resultData);

  } catch (error) {
    console.error("Parse Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
