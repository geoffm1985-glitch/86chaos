"use strict";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function assertValidMonthKey(monthStr) {
  if (typeof monthStr !== "string" || !/^\d{4}-\d{2}$/.test(monthStr)) {
    throw new Error(`Invalid schedule print month: ${String(monthStr ?? "")}`);
  }
  const year = Number(monthStr.slice(0, 4));
  const month = Number(monthStr.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid schedule print month: ${monthStr}`);
  }
  return { year, month };
}

function buildMonthCalendarFrame(monthStr) {
  const { year, month } = assertValidMonthKey(monthStr);
  const firstDay = new Date(year, month - 1, 1, 12, 0, 0, 0).getDay();
  const days = new Date(year, month, 0, 12, 0, 0, 0).getDate();
  const totalCells = firstDay + days;
  const weeks = Math.ceil(totalCells / 7);
  const trailingBlanks = (weeks * 7) - totalCells;
  const cells = [];
  for (let index = 0; index < firstDay; index += 1) {
    cells.push({ type: "blank", key: `leading-${index}`, leading: true });
  }
  for (let dayNumber = 1; dayNumber <= days; dayNumber += 1) {
    cells.push({
      type: "day",
      key: `${monthStr}-${String(dayNumber).padStart(2, "0")}`,
      date: `${monthStr}-${String(dayNumber).padStart(2, "0")}`,
      dayNumber,
      weekday: (firstDay + dayNumber - 1) % 7,
    });
  }
  for (let index = 0; index < trailingBlanks; index += 1) {
    cells.push({ type: "blank", key: `trailing-${index}`, trailing: true });
  }
  return { monthStr, firstDay, days, weeks, leadingBlanks: firstDay, trailingBlanks, cells };
}

function normalizeDayRows(dayRows = []) {
  const byDay = new Map();
  for (const row of Array.isArray(dayRows) ? dayRows : []) {
    const dayNumber = Number(row?.dayNumber);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) continue;
    const shifts = Array.isArray(row?.shifts) ? row.shifts.map((shift, index) => ({
      id: String(shift?.id || `${row?.date || "shift"}-${index}`),
      fullLabel: String(shift?.fullLabel || shift?.label || ""),
      mobileLabel: String(shift?.mobileLabel || shift?.fullLabel || shift?.label || ""),
    })).filter(shift => shift.fullLabel || shift.mobileLabel) : [];
    byDay.set(dayNumber, { ...row, dayNumber, shifts });
  }
  return byDay;
}

function buildScheduleMonthPrintHtml(model = {}) {
  const monthStr = String(model.monthStr || "");
  const frame = buildMonthCalendarFrame(monthStr);
  const displayMonth = String(model.displayMonth || "").trim();
  if (!displayMonth) throw new Error("Schedule month print requires displayMonth.");
  const roleFilter = String(model.roleFilter || "All");
  const roleFilterLabel = String(model.roleFilterLabel || roleFilter || "All").trim();
  const dayRows = normalizeDayRows(model.dayRows || []);
  const titleParts = ["86 Chaos Schedule"];
  if (roleFilter && roleFilter !== "All") titleParts.push(roleFilterLabel);
  titleParts.push(displayMonth);
  const title = titleParts.join(" - ");
  const gridCells = [];
  for (const label of WEEKDAY_LABELS) {
    gridCells.push(`<div class="weekday-cell" role="columnheader">${escapeHtml(label)}</div>`);
  }
  for (const cell of frame.cells) {
    if (cell.type !== "day") {
      gridCells.push(`<div class="calendar-cell blank-cell" aria-hidden="true"></div>`);
      continue;
    }
    const row = dayRows.get(cell.dayNumber) || { date: cell.date, dayNumber: cell.dayNumber, shifts: [] };
    const dense = row.shifts.length >= 6 ? " print-day-dense" : "";
    const shiftHtml = row.shifts.map(shift => `<div class="print-shift" data-shift-id="${escapeHtml(shift.id)}">${escapeHtml(shift.fullLabel)}</div>`).join("");
    gridCells.push([
      `<section class="calendar-cell day-cell${dense}" data-date="${escapeHtml(cell.date)}" data-day-number="${cell.dayNumber}" aria-label="${escapeHtml(`${displayMonth} day ${cell.dayNumber}`)}">`,
      `<div class="cell-date">${cell.dayNumber}</div>`,
      `<div class="print-shift-stack">${shiftHtml}</div>`,
      `</section>`
    ].join(""));
  }
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: landscape; margin: 0.25in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
  body { width: 100%; min-height: 100vh; }
  #schedule-month-print-root { width: 100%; min-height: 100vh; background: #fff; color: #000; padding: 0; }
  .print-header { text-align: center; font-size: 22px; font-weight: 900; color: #000; margin: 0 0 8px 0; text-transform: uppercase; line-height: 1.15; }
  .print-subheader { text-align: center; font-size: 10px; font-weight: 800; color: #334155; margin: -5px 0 6px 0; text-transform: uppercase; letter-spacing: 0.08em; }
  .print-grid { display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: 25px repeat(${frame.weeks}, 1fr); border-top: 2px solid #000; border-left: 2px solid #000; height: calc(100vh - 48px); max-height: calc(100vh - 48px); overflow: hidden; page-break-inside: avoid; }
  .weekday-cell, .calendar-cell { border-right: 2px solid #000; border-bottom: 2px solid #000; }
  .weekday-cell { display: flex; align-items: center; justify-content: center; background: #fff; color: #000; font-size: 11px; font-weight: 900; text-transform: uppercase; }
  .calendar-cell { background: #fff; color: #000; min-height: 0; padding: 3px; display: flex; flex-direction: column; overflow: hidden; gap: 1px; }
  .blank-cell { background: #f8fafc; }
  .cell-date { font-size: 13px; font-weight: 900; color: #000; text-align: right; margin-bottom: 2px; line-height: 1; }
  .print-shift-stack { display: flex; flex-direction: column; gap: 1px; min-height: 0; overflow: visible; }
  .print-shift { background: #f8fafc; color: #000; border: 1px solid #94a3b8; border-radius: 3px; padding: 0 2px; font-size: 7.6px; font-weight: 900; line-height: 1.05; margin-bottom: 0; min-height: 0; white-space: nowrap; overflow: hidden; text-overflow: clip; flex: 0 0 auto; }
  .print-day-dense .print-shift { border-radius: 2px; padding: 0 1px; font-size: 7px; line-height: 1; }
</style>
</head>
<body>
<div id="schedule-month-print-root" data-calendar-month="${escapeHtml(monthStr)}">
  <h1 class="print-header">${escapeHtml(title)}</h1>
  <div class="print-subheader">Selected month: ${escapeHtml(monthStr)}</div>
  <main class="print-grid" data-calendar-weeks="${frame.weeks}">
    ${gridCells.join("\n    ")}
  </main>
</div>
</body>
</html>`;
}

function openScheduleMonthPrintWindow(model = {}, options = {}) {
  const browserWindow = options.window || (typeof window !== "undefined" ? window : null);
  if (!browserWindow || typeof browserWindow.open !== "function") return false;
  const html = buildScheduleMonthPrintHtml(model);
  const printWindow = browserWindow.open("", "_blank");
  if (!printWindow || !printWindow.document) return false;
  try { printWindow.opener = null; } catch (_) {}
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  let printed = false;
  const runPrint = () => {
    if (printed) return;
    printed = true;
    const doPrint = () => {
      try { if (typeof printWindow.focus === "function") printWindow.focus(); } catch (_) {}
      if (typeof printWindow.print === "function") printWindow.print();
    };
    const fontsReady = printWindow.document?.fonts?.ready;
    if (fontsReady && typeof fontsReady.then === "function") {
      fontsReady.then(doPrint).catch(doPrint);
    } else {
      doPrint();
    }
  };
  try {
    printWindow.addEventListener("load", runPrint, { once: true });
  } catch (_) {}
  const readyState = printWindow.document?.readyState;
  if (readyState === "complete" || readyState === "interactive") {
    printWindow.setTimeout ? printWindow.setTimeout(runPrint, 50) : setTimeout(runPrint, 50);
  } else {
    const timer = printWindow.setTimeout || setTimeout;
    timer(runPrint, 750);
  }
  return true;
}

module.exports = {
  WEEKDAY_LABELS,
  escapeHtml,
  assertValidMonthKey,
  buildMonthCalendarFrame,
  buildScheduleMonthPrintHtml,
  openScheduleMonthPrintWindow,
};
