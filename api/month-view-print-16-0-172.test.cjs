"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildMonthCalendarFrame,
  buildScheduleMonthPrintHtml,
} = require("../src/core/scheduleMonthPrint.cjs");

test("August 2026 month frame is deterministic", () => {
  const frame = buildMonthCalendarFrame("2026-08");
  assert.equal(frame.monthStr, "2026-08");
  assert.equal(frame.days, 31);
  assert.equal(frame.firstDay, 6, "August 1, 2026 is Saturday");
  assert.equal(frame.weeks, 6);
  const augustOne = frame.cells.find(cell => cell.date === "2026-08-01");
  assert.equal(augustOne.weekday, 6);
});

test("September 2026 month frame cannot leak across months", () => {
  const frame = buildMonthCalendarFrame("2026-09");
  assert.equal(frame.days, 30);
  assert.equal(frame.firstDay, 2, "September 1, 2026 is Tuesday");
  assert.equal(frame.leadingBlanks, 2);
  assert.equal(frame.weeks, 5);
  assert.equal(frame.trailingBlanks, 3);
});

test("print document exposes exact month identity and selected month days", () => {
  const dayRows = Array.from({ length: 30 }, (_, index) => ({ date: `2026-09-${String(index + 1).padStart(2, "0")}`, dayNumber: index + 1, shifts: [] }));
  const html = buildScheduleMonthPrintHtml({ monthStr: "2026-09", displayMonth: "September 2026", roleFilter: "All", roleFilterLabel: "Whole Schedule", dayRows });
  assert.match(html, /data-calendar-month="2026-09"/);
  assert.match(html, /September 2026/);
  assert.match(html, /data-day-number="1"/);
  assert.match(html, /data-day-number="30"/);
  assert.doesNotMatch(html, /data-day-number="31"/);
  assert.doesNotMatch(html, /September 31/);
});

test("malformed print month never falls back to current date", () => {
  for (const value of ["", "2026", "not-a-month", null]) {
    assert.throws(() => buildMonthCalendarFrame(value), /Invalid schedule print month/);
    assert.throws(() => buildScheduleMonthPrintHtml({ monthStr: value, displayMonth: "Bad Month", dayRows: [] }), /Invalid schedule print month/);
  }
});

test("standalone print HTML escapes dynamic shift labels", () => {
  const html = buildScheduleMonthPrintHtml({
    monthStr: "2026-08",
    displayMonth: "August 2026",
    roleFilter: "Server & Bar",
    roleFilterLabel: "<Server & \"Bar\">",
    dayRows: [{ date: "2026-08-01", dayNumber: 1, shifts: [{ id: "shift-1", fullLabel: "<Server & \"Bar\">" }] }],
  });
  assert.match(html, /&lt;Server &amp; &quot;Bar&quot;&gt;/);
  assert.doesNotMatch(html, /<Server & "Bar">/);
  assert.doesNotMatch(html, /<script/i);
});

test("print snapshots are independent frozen documents", () => {
  const july = buildScheduleMonthPrintHtml({ monthStr: "2026-07", displayMonth: "July 2026", roleFilter: "All", roleFilterLabel: "Whole Schedule", dayRows: [] });
  const august = buildScheduleMonthPrintHtml({ monthStr: "2026-08", displayMonth: "August 2026", roleFilter: "All", roleFilterLabel: "Whole Schedule", dayRows: [] });
  assert.match(july, /data-calendar-month="2026-07"/);
  assert.doesNotMatch(july, /data-calendar-month="2026-08"/);
  assert.match(august, /data-calendar-month="2026-08"/);
  assert.doesNotMatch(august, /data-calendar-month="2026-07"/);
});
