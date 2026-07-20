function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value) {
  return String(value ?? '').trim();
}

function itemName(item = {}) {
  return text(item.name || item.itemName || item.title || item.text || 'Inventory item');
}

function datePart(value) {
  const raw = text(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function safeErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || error.name || 'Unknown error';
  if (typeof error === 'object') {
    const direct = error.message || error.error || error.detail || error.reason || error.code;
    if (direct && direct !== error) return safeErrorMessage(direct);
    try { return JSON.stringify(error); } catch (_) { return String(error); }
  }
  return String(error);
}

function buildReports(result) {
  const lines = [];
  lines.push('86 Chaos Ops Scan Report');
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push('');
  for (const line of result.managerBrief || []) lines.push(`- ${line}`);
  lines.push('');
  const csvRows = [['Area', 'Severity', 'Title', 'Detail', 'Recommendation']];
  const addRows = (area, rows, titleKey, detailKey, recommendationKey) => {
    for (const row of asArray(rows)) {
      csvRows.push([
        area,
        row.severity || row.status || 'low',
        row[titleKey] || row.title || row.itemName || row.recipeName || area,
        row[detailKey] || row.detail || row.summary || '',
        row[recommendationKey] || row.recommendation || row.suggestion || ''
      ]);
    }
  };
  addRows('Inventory', result.priceWatch, 'itemName', 'summary', 'recommendation');
  addRows('Inventory', result.parRecommendations, 'itemName', 'reason', 'recommendation');
  addRows('Waste', result.wastePatterns, 'itemName', 'suggestion', 'suggestion');
  addRows('Menu Cost', result.menuCosting, 'recipeName', 'summary', 'recommendation');
  addRows('Labor', result.laborScheduleWarnings, 'title', 'detail', 'recommendation');
  addRows('Data Health', result.dataHealth, 'title', 'detail', 'recommendation');
  const csv = csvRows.map(row => row.map(col => `"${String(col ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  return { text: lines.join('\n').trim(), csv };
}

function fallbackInventoryDataHealth(payload) {
  const rows = [];
  if (!asArray(payload.inventoryItems).length) rows.push({ severity: 'medium', area: 'Inventory', title: 'No inventory items loaded', detail: 'The scan payload did not include inventory items.', recommendation: 'Open Inventory and confirm items are loaded before running deeper cost checks.' });
  if (!asArray(payload.invoices).length) rows.push({ severity: 'low', area: 'Invoices', title: 'No invoice history loaded', detail: 'Invoice-based price checks could not run without invoice data.', recommendation: 'Scan or review vendor invoices to improve back-office intelligence.' });
  if (!asArray(payload.recipes).length && !asArray(payload.menuDependencies).length) rows.push({ severity: 'low', area: 'Menu Intelligence', title: 'No recipe or menu dependency data loaded', detail: 'Menu cost checks need recipes or menu dependency records.', recommendation: 'Add recipes or scan the menu to unlock stronger food-cost analysis.' });
  return rows;
}

function buildFallbackOpsResult(payload = {}, sourceError) {
  const generatedAt = new Date().toISOString();
  const inventoryItems = asArray(payload.inventoryItems);
  const invoices = asArray(payload.invoices);
  const recipes = asArray(payload.recipes);
  const shifts = asArray(payload.shifts);
  const timePunches = asArray(payload.timePunches);
  const maintenanceLogs = asArray(payload.maintenanceLogs);
  const events = asArray(payload.events);
  const dataHealth = fallbackInventoryDataHealth(payload);

  const parRecommendations = inventoryItems
    .filter(item => asNumber(item.parLevel) > 0 && asNumber(item.currentStock) <= asNumber(item.parLevel) * 0.5)
    .slice(0, 30)
    .map(item => ({
      itemId: item.id || '',
      itemName: itemName(item),
      currentPar: asNumber(item.parLevel),
      stock: asNumber(item.currentStock),
      direction: 'review',
      severity: asNumber(item.currentStock) <= 0 ? 'high' : 'medium',
      reason: `${itemName(item)} is at ${asNumber(item.currentStock)} on hand against par ${asNumber(item.parLevel)}.`,
      recommendation: 'Review stock count and ordering needs before the next order.'
    }));

  const invoiceAnomalies = [];
  const invoiceFingerprints = new Map();
  for (const invoice of invoices) {
    const key = [text(invoice.vendorName || invoice.supplierName || invoice.vendor), datePart(invoice.invoiceDate || invoice.date || invoice.createdAt), asNumber(invoice.total || invoice.grandTotal)].join('|');
    if (key.replace(/[|0.]/g, '').trim()) invoiceFingerprints.set(key, (invoiceFingerprints.get(key) || 0) + 1);
  }
  for (const [key, count] of invoiceFingerprints.entries()) {
    if (count > 1) invoiceAnomalies.push({ severity: 'medium', type: 'possible_duplicate_invoice', title: 'Possible duplicate invoice', detail: `${count} invoices share the same vendor/date/total fingerprint.`, recommendation: 'Review invoice history before approving costs or order drafts.' });
  }

  const laborScheduleWarnings = [];
  if (shifts.length && !timePunches.length) {
    laborScheduleWarnings.push({ severity: 'low', title: 'No recent punch data loaded', detail: 'Schedule coverage can be reviewed, but labor-vs-actual checks need time punches.', recommendation: 'Open Financials/Timesheets to confirm punch data is syncing.' });
  }
  const urgentMaintenance = maintenanceLogs.filter(row => /urgent|critical|emergency/i.test(text(row.priority || row.status || row.title || row.description))).slice(0, 10);
  for (const row of urgentMaintenance) {
    dataHealth.push({ severity: 'high', area: 'Maintenance', title: row.title || 'Urgent maintenance item', detail: row.description || row.note || 'Urgent maintenance item needs review.', recommendation: 'Open Kitchen Command or Maintenance and confirm status.' });
  }

  const managerBrief = [];
  if (parRecommendations.length) managerBrief.push(`${parRecommendations.length} inventory par item(s) need review before ordering.`);
  if (invoiceAnomalies.length) managerBrief.push(`${invoiceAnomalies.length} invoice anomaly check(s) need review.`);
  if (laborScheduleWarnings.length) managerBrief.push(`${laborScheduleWarnings.length} labor/schedule warning(s) need review.`);
  if (dataHealth.length) managerBrief.push(`${dataHealth.length} data health item(s) could reduce scan accuracy.`);
  if (!managerBrief.length) managerBrief.push('Ops scan fallback found no major risk queues in the provided data window.');

  const result = {
    ok: true,
    engine: 'python-ops-intelligence',
    runtime: 'node-safe-fallback',
    fallback: true,
    fallbackReason: safeErrorMessage(sourceError) || 'Python function was unavailable.',
    version: '1.0.1-fallback',
    generatedAt,
    currentDate: datePart(payload.currentDate) || generatedAt.slice(0, 10),
    summary: {
      priceWarningCount: 0,
      invoiceAnomalyCount: invoiceAnomalies.length,
      parRecommendationCount: parRecommendations.length,
      wasteInsightCount: 0,
      menuCostCount: 0,
      laborWarningCount: laborScheduleWarnings.length,
      dataHealthCount: dataHealth.length,
      backupCheckCount: 0,
      eventCount: events.length,
      recipeCount: recipes.length
    },
    managerBrief,
    priceWatch: [],
    invoiceAnomalies,
    parRecommendations,
    wastePatterns: [],
    wasteInsights: [],
    eventSupplyPlan: [],
    menuCosting: [],
    laborScheduleWarnings,
    dataHealth,
    backupChecks: [],
    reports: { text: '', csv: '' },
    warning: 'Python runtime did not complete, so 86 Chaos returned a safe payload-based Ops Scan instead of failing the Manager Brief.'
  };
  result.reports = buildReports(result);
  return result;
}

module.exports = { buildFallbackOpsResult, safeErrorMessage };
