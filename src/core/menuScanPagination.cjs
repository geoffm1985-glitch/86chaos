'use strict';
function appendScanPage(existingRows = [], pageRows = []) {
  const byId = new Map();
  [...existingRows, ...pageRows].forEach(row => { if (row && row.id && !byId.has(row.id)) byId.set(row.id, row); });
  return Array.from(byId.values());
}
function simulateCursorPagination(rows = [], pageSize = 20) {
  const sorted = [...rows].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || String(b.id || '').localeCompare(String(a.id || '')));
  const page1 = sorted.slice(0, pageSize);
  const cursor = page1[page1.length - 1] || null;
  const cursorIndex = cursor ? sorted.findIndex(row => row.id === cursor.id) : -1;
  const page2 = cursorIndex >= 0 ? sorted.slice(cursorIndex + 1, cursorIndex + 1 + pageSize) : [];
  return { page1, page2, combined: appendScanPage(page1, page2), cursor };
}
module.exports = { appendScanPage, simulateCursorPagination };
