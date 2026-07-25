const STOCK_ROW_TYPES = /^(item|product|line[_\s-]*item|detail|merchandise|stock|food|ingredient|inventory)$/i;
const NON_STOCK_ROW_TYPES = /^(header|footer|note|memo|terms|customer|contact|metadata|page|route|invoice|statement|subtotal|total|tax|freight|delivery|fee|deposit|discount|credit|payment|balance|signature)$/i;
const PURCHASE_UNITS = 'CS|CASE|CASES|EA|EACH|PK|PACK|BX|BOX|BAG|JUG|CTN|CARTON|DZ|DOZ|LB|LBS|OZ|GAL|QT|PT|PLST|TUB|PAIL|CAN|JAR|BTL|BOTTLE|TRAY|PAN|PC|PCS|KG|GM|ML|LTR|LITER|RL|ROLL|SLEEVE|SACK|DRUM|KEG';
const LEADING_PURCHASE_RE = new RegExp(`^[\\s>*•#-]*(\\d+(?:\\.\\d+)?)\\s*(${PURCHASE_UNITS})\\b`, 'i');
const PACK_RE = new RegExp(`\\b\\d+\\s*\\/\\s*\\d+(?:\\.\\d+)?\\s*(?:${PURCHASE_UNITS}|CT|CNT)?\\b`, 'i');
const UNIT_RE = new RegExp(`\\b(?:${PURCHASE_UNITS})\\b`, 'i');

const NON_FOOD_RULES = [
  {
    category: 'Cleaning chemical',
    reason: 'Cleaning or sanitation product',
    re: /\b(?:bleach|sanitiz(?:er|ing)|disinfect(?:ant|ing)|degreaser|detergent|dish(?:washing)?\s*(?:soap|liquid|chemical)|rinse\s*aid|glass\s*cleaner|floor\s*cleaner|oven\s*cleaner|grill\s*cleaner|drain\s*cleaner|cleaning\s*(?:chemical|solution|compound)|quat(?:ernary)?|delimer|descaler|soap\s*dispens(?:er|ing)|hand\s*soap)\b/i
  },
  {
    category: 'Paper and packaging',
    reason: 'Disposable paper or packaging supply',
    re: /\b(?:paper\s*towels?|toilet\s*(?:paper|tissue)|facial\s*tissue|napkins?|deli\s*paper|wax(?:ed)?\s*paper|parchment\s*paper|butcher\s*paper|receipt\s*paper|register\s*tape|thermal\s*paper|paper\s*bags?|take[-\s]*out\s*bags?|to[-\s]*go\s*bags?|sandwich\s*bags?|zip(?:per)?\s*bags?|trash\s*bags?|garbage\s*bags?|can\s*liners?|pan\s*liners?|basket\s*liners?|aluminum\s*foil|foil\s*sheets?|plastic\s*wrap|cling\s*film|foodservice\s*film|shrink\s*wrap)\b/i
  },
  {
    category: 'Disposable serviceware',
    reason: 'Disposable cup, lid, utensil, or container',
    re: /\b(?:(?:paper|plastic|foam|hot|cold|drink|beverage|disposable)\s*cups?|cup\s*lids?|lids?\s+for\s+cups?|straws?|drink\s*stirrers?|coffee\s*stirrers?|toothpicks?|plastic\s*cutlery|disposable\s*cutlery|forks?|spoons?|plastic\s*knives?|disposable\s*knives?|paper\s*plates?|foam\s*plates?|plastic\s*plates?|disposable\s*plates?|paper\s*bowls?|foam\s*bowls?|disposable\s*bowls?|clamshells?|hinged\s*containers?|take[-\s]*out\s*containers?|to[-\s]*go\s*containers?|portion\s*cups?|souffle\s*cups?|deli\s*containers?|food\s*containers?|disposable\s*trays?)\b/i
  },
  {
    category: 'PPE and uniforms',
    reason: 'Protective or employee-use supply',
    re: /\b(?:gloves?|nitrile\s*gloves?|vinyl\s*gloves?|latex\s*gloves?|aprons?|hair\s*nets?|beard\s*nets?|face\s*masks?|chef\s*hats?|sleeve\s*guards?)\b/i
  },
  {
    category: 'Cleaning tool',
    reason: 'Cleaning tool or janitorial supply',
    re: /\b(?:mops?|mop\s*heads?|brooms?|dustpans?|squeegees?|scrubbers?|scrub\s*pads?|sponges?|steel\s*wool|cleaning\s*cloths?|microfiber\s*cloths?|wet\s*floor\s*signs?|toilet\s*brushes?|bucket\s*wringers?)\b/i
  },
  {
    category: 'Smallware or equipment',
    reason: 'Kitchen equipment or reusable smallware',
    re: /\b(?:thermometers?|cutting\s*boards?|sheet\s*pans?|hotel\s*pans?|fry\s*pans?|sauce\s*pans?|stock\s*pots?|mixing\s*bowls?|tongs?|spatulas?|turners?|ladles?|whisks?|can\s*openers?|knife\s*sharpeners?|storage\s*racks?|shelving|bus\s*tubs?|dish\s*racks?)\b/i
  },
  {
    category: 'Maintenance or office',
    reason: 'Maintenance, office, or facility supply',
    re: /\b(?:light\s*bulbs?|batteries?|printer\s*ink|toner\s*cartridges?|copy\s*paper|office\s*supplies?|labels?|label\s*tape|markers?|pens?|pencils?|staples?|pest\s*control|propane|repair\s*parts?|replacement\s*parts?|air\s*filters?|water\s*filters?)\b/i
  }
];

// These are edible products whose names happen to contain words commonly used by supplies.
const EDIBLE_NON_FOOD_EXCEPTIONS = /\b(?:rice\s*paper|spring\s*roll\s*wrappers?|egg\s*roll\s*wrappers?|wonton\s*wrappers?|tortilla\s*wraps?|peanut\s*butter\s*cups?|fruit\s*cups?|pudding\s*cups?|ice\s*cream\s*cups?|chocolate\s*cups?|cup\s*noodles?|cup\s*soup|foil[-\s]*wrapped)\b/i;

function clean(value = '') {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replace(/[$,]/g, '').replace(/[()]/g, '-').trim();
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : 0;
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function normalizeInvoiceSku(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeInvoiceName(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function invoiceRowText(row = {}) {
  return clean(row.rawText || row.itemName || row.description || row.name || '');
}

function findMixedProductCode(text = '') {
  const candidates = String(text || '').toUpperCase().match(/\b[A-Z0-9][A-Z0-9-]{2,}\b/g) || [];
  return candidates.find(token =>
    /[A-Z]/.test(token) &&
    /\d/.test(token) &&
    !/^(?:CS|EA|PK|BX|CTN|LB|LBS|OZ|GAL|QT|PT|REF)\d*$/i.test(token)
  ) || '';
}

function inferDescriptionFromInvoiceText(text = '', productCode = '') {
  let value = clean(text);
  value = value.replace(LEADING_PURCHASE_RE, '').trim();
  value = value.replace(new RegExp(`^\\s*(?:\\d+\\s*\\/\\s*)?\\d+(?:\\.\\d+)?\\s*(?:${PURCHASE_UNITS}|CT|CNT)\\b`, 'i'), '').trim();

  if (productCode) {
    const codeIndex = value.toUpperCase().indexOf(String(productCode).toUpperCase());
    if (codeIndex >= 0) value = value.slice(codeIndex + String(productCode).length).trim();
  }

  value = value
    .replace(/\s+\bREF\b[\s\S]*$/i, '')
    .replace(/\s+(?:-?\$?\d[\d,]*\.\d{2}\s*){1,3}$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return /[A-Za-z]{3}/.test(value) ? value : '';
}

function inferInvoiceProductFields(row = {}) {
  const original = row && typeof row === 'object' ? row : { rawText: String(row || '') };
  const text = invoiceRowText(original);
  const leading = text.match(LEADING_PURCHASE_RE);
  const productCode = original.productCode || original.sku || original.itemNumber || original.itemCode || original.code || original.pfgCode || findMixedProductCode(text);
  const priceMatches = text.match(/-?\$?\d[\d,]*\.\d{2}\b/g) || [];
  const inferredDescription = inferDescriptionFromInvoiceText(text, productCode);
  const currentName = clean(original.itemName || original.description || original.name || '');
  const currentNameLooksRaw = !currentName || currentName === text || LEADING_PURCHASE_RE.test(currentName) || currentName.length > 105;
  const packMatch = text.match(PACK_RE);

  const inferred = {
    ...original,
    productCode,
    quantity: hasValue(original.quantity ?? original.qty ?? original.shippedQty ?? original.receivedQty ?? original.orderedQty)
      ? (original.quantity ?? original.qty ?? original.shippedQty ?? original.receivedQty ?? original.orderedQty)
      : (leading?.[1] || ''),
    uom: original.uom || original.unitOfMeasure || leading?.[2] || '',
    packSize: original.packSize || original.pack || original.size || packMatch?.[0] || leading?.[2] || '',
    unitPrice: hasValue(original.unitPrice ?? original.priceEach ?? original.casePrice)
      ? (original.unitPrice ?? original.priceEach ?? original.casePrice)
      : (priceMatches.length >= 2 ? priceMatches[priceMatches.length - 2].replace('$', '') : ''),
    totalPrice: hasValue(original.totalPrice ?? original.extendedPrice ?? original.lineTotal)
      ? (original.totalPrice ?? original.extendedPrice ?? original.lineTotal)
      : (priceMatches.length ? priceMatches[priceMatches.length - 1].replace('$', '') : ''),
    rawText: original.rawText || text
  };

  if (currentNameLooksRaw && inferredDescription) {
    inferred.itemName = inferredDescription;
    inferred.description = inferredDescription;
  }

  return inferred;
}

function isDocumentNoiseText(row = {}) {
  const itemName = clean(row.itemName || row.description || row.name || row.rawText || '');
  const raw = invoiceRowText(row);
  const combined = `${itemName} ${raw}`.toLowerCase();

  if (/\b(?:bill\s*to|ship\s*to|sold\s*to|remit\s*to|invoice\s*(?:number|no\.?|date|total)?|account\s*(?:number|no\.?|summary)?|customer\s*(?:number|no\.?|account)?|purchase\s*order|po\s*(?:number|no\.?)|payment\s*terms|order\s*date|delivery\s*date|route\s*(?:number|no\.?|stop)?|salesperson|warehouse|driver|page\s+\d+(?:\s+of\s+\d+)?|subtotal|grand\s*total|invoice\s*total|total\s*due|amount\s*due|balance\s*due|taxable\s*sales|non[-\s]*taxable\s*sales|sales\s*tax|freight\s*(?:charge)?|delivery\s*(?:charge|fee)?|fuel\s*surcharge|service\s*charge|handling\s*fee|minimum\s*order\s*fee|late\s*fee|deposit|discount|allowance|rebate|coupon|credit|payment|change\s*due|signature|terms\s+and\s+conditions|thank\s+you)\b/i.test(combined)) return true;
  if (/(^|\s)(?:from|to|cc|bcc|subject|sent|date):/i.test(itemName)) return true;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(itemName) || /no\s*reply|noreply|do\s*not\s*reply/i.test(combined)) return true;
  if (/https?:\/\/|www\.|\.com\b|\.net\b|\.org\b/i.test(itemName) && !hasValue(row.quantity)) return true;
  if (/\b(?:phone|fax|email|website)\s*[:#]/i.test(itemName) && !hasValue(row.quantity)) return true;
  if (/\b(?:qty|quantity|item|description|pack|size|uom|unit\s*price|extended|amount)\b/i.test(itemName)) {
    const headerWords = itemName.match(/\b(?:qty|quantity|item|description|pack|size|uom|unit\s*price|extended|amount)\b/gi) || [];
    if (headerWords.length >= 3 && !LEADING_PURCHASE_RE.test(raw)) return true;
  }
  if (/^\s*\d{1,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){1,6}\s+(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|hwy|highway)\b/i.test(itemName) && !LEADING_PURCHASE_RE.test(raw)) return true;
  if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(itemName) && !LEADING_PURCHASE_RE.test(raw)) return true;
  return false;
}

function getPurchaseSignals(input = {}) {
  const row = inferInvoiceProductFields(input);
  const rowType = clean(row.rowType || row.lineType || row.type || '');
  const raw = invoiceRowText(row);
  const qty = parseNumber(row.quantity ?? row.qty ?? row.shippedQty ?? row.receivedQty ?? row.orderedQty);
  const unitPrice = parseNumber(row.unitPrice ?? row.priceEach ?? row.casePrice);
  const totalPrice = parseNumber(row.totalPrice ?? row.extendedPrice ?? row.lineTotal);
  const hasQuantity = qty > 0;
  const hasPrice = unitPrice > 0 || totalPrice > 0;
  const hasSku = hasValue(row.productCode || row.sku || row.itemNumber || row.itemCode || row.code || row.pfgCode);
  const hasPack = hasValue(row.packSize || row.pack || row.size || row.uom || row.unitOfMeasure || row.weight || row.catchWeight);
  const hasLeadingPurchase = LEADING_PURCHASE_RE.test(raw);
  const hasPackPattern = PACK_RE.test(raw);
  const hasUnit = UNIT_RE.test(raw);
  const explicitProductType = STOCK_ROW_TYPES.test(rowType);
  const explicitNonStockType = NON_STOCK_ROW_TYPES.test(rowType);
  const alphaWords = (raw.match(/[A-Za-z]{3,}/g) || []).length;
  const numericTokens = (raw.match(/\b\d+(?:\.\d+)?\b/g) || []).length;
  const densePurchaseSignature = hasLeadingPurchase && alphaWords >= 1 && (hasSku || hasPackPattern || hasPrice || numericTokens >= 2);
  const structuredPurchaseSignature = hasQuantity && (hasPrice || hasSku || hasPack);
  const typedEvidenceCount = [hasQuantity, hasPrice, hasSku, hasPack, hasUnit].filter(Boolean).length;
  const typedPurchaseSignature = !explicitNonStockType && explicitProductType && alphaWords >= 1 && typedEvidenceCount >= 2;
  const strongPurchase = densePurchaseSignature || structuredPurchaseSignature || typedPurchaseSignature;
  const weakPurchase = !strongPurchase && alphaWords >= 1 && [hasQuantity, hasPrice, hasSku, hasPack, hasUnit].filter(Boolean).length >= 1;
  return {
    row,
    rowType,
    raw,
    qty,
    unitPrice,
    totalPrice,
    hasQuantity,
    hasPrice,
    hasSku,
    hasPack,
    hasLeadingPurchase,
    hasPackPattern,
    hasUnit,
    explicitProductType,
    explicitNonStockType,
    alphaWords,
    numericTokens,
    densePurchaseSignature,
    structuredPurchaseSignature,
    typedPurchaseSignature,
    typedEvidenceCount,
    strongPurchase,
    weakPurchase
  };
}

function getNonFoodSupplyClassification(input = {}) {
  const row = inferInvoiceProductFields(input);
  const text = `${clean(row.itemName || row.description || row.name || '')} ${invoiceRowText(row)}`.trim();
  if (!text || EDIBLE_NON_FOOD_EXCEPTIONS.test(text)) return null;
  for (const rule of NON_FOOD_RULES) {
    if (rule.re.test(text)) return { category: rule.category, reason: rule.reason };
  }
  return null;
}

function classifyInvoiceRow(input = {}) {
  const signals = getPurchaseSignals(input);
  const row = signals.row;
  const itemName = clean(row.itemName || row.description || row.name || row.rawText || '');
  if (!itemName || itemName.length < 2) {
    return { kind: 'document', reason: 'Blank or unreadable row', category: 'Document row', row };
  }

  // Textual document evidence always wins. A mislabeled AI rowType does not win over a
  // strong distributor purchase signature, because real products are often marked as notes.
  if (isDocumentNoiseText(row)) {
    return { kind: 'document', reason: 'Invoice metadata, total, fee, contact, or header row', category: 'Document row', row };
  }
  if (signals.explicitNonStockType && !signals.densePurchaseSignature && !signals.structuredPurchaseSignature) {
    return { kind: 'document', reason: `AI row type “${signals.rowType || 'non-product'}” with no purchase signature`, category: 'Document row', row };
  }

  const nonFood = getNonFoodSupplyClassification(row);
  if (nonFood && (signals.strongPurchase || signals.weakPurchase)) {
    return { kind: 'non_food', reason: nonFood.reason, category: nonFood.category, row };
  }

  if (signals.strongPurchase) {
    return {
      kind: 'stock',
      reason: signals.densePurchaseSignature ? 'Recovered from distributor purchase row' : 'Structured purchased product row',
      category: 'Food or inventory product',
      row
    };
  }

  if (signals.weakPurchase) {
    return { kind: 'review', reason: 'Possible purchased item, but quantity/price/pack evidence is incomplete', category: 'Needs review', row };
  }

  return { kind: 'document', reason: 'No reliable purchase signature', category: 'Document row', row };
}

function isPurchasedProductRow(input = {}) {
  return classifyInvoiceRow(input).kind === 'stock';
}

function productRowKey(row = {}) {
  const enriched = inferInvoiceProductFields(row);
  const code = normalizeInvoiceSku(enriched.productCode || '');
  const name = normalizeInvoiceName(enriched.itemName || enriched.description || enriched.rawText || '');
  const qty = String(enriched.quantity || '');
  return code ? `code:${code}:${qty}` : `name:${name}:${qty}`;
}

module.exports = {
  STOCK_ROW_TYPES,
  NON_STOCK_ROW_TYPES,
  PURCHASE_UNITS,
  LEADING_PURCHASE_RE,
  PACK_RE,
  UNIT_RE,
  normalizeInvoiceSku,
  normalizeInvoiceName,
  invoiceRowText,
  inferInvoiceProductFields,
  getPurchaseSignals,
  getNonFoodSupplyClassification,
  classifyInvoiceRow,
  isPurchasedProductRow,
  productRowKey,
  isDocumentNoiseText,
  __test: {
    EDIBLE_NON_FOOD_EXCEPTIONS,
    NON_FOOD_RULES,
    parseNumber,
    hasValue,
    findMixedProductCode,
    inferDescriptionFromInvoiceText
  }
};
