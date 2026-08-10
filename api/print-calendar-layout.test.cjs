"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function activeTabMonthSource() {
  const source = read("src/features/schedule.jsx");
  const start = source.indexOf("const TabMonth =");
  const end = source.indexOf("const TabAvailability", start);
  assert.ok(start >= 0 && end > start, "active TabMonth source should be locatable");
  return source.slice(start, end);
}

test("active Month View print path uses a dedicated isolated print helper", () => {
  const tabMonth = activeTabMonthSource();
  assert.doesNotMatch(tabMonth, /onClick=\{\s*\(\)\s*=>\s*window\.print\(\)\s*\}/);
  assert.doesNotMatch(tabMonth, /window\.print\s*\(/);
  assert.match(tabMonth, /openScheduleMonthPrintWindow\(monthCalendarModel\)/);
  assert.match(tabMonth, /monthCalendarModel\.monthStr|monthStr,/);
  assert.match(tabMonth, /monthCalendarModel\.dayRows\.map/);
  assert.match(tabMonth, /dayRows,/);
});

test("active Month View no longer relies on SPA-wide print visibility hijacking", () => {
  const tabMonth = activeTabMonthSource();
  assert.doesNotMatch(tabMonth, /body \*\s*\{\s*visibility:\s*hidden/);
  assert.doesNotMatch(tabMonth, /\.print-container[\s\S]{0,80}visibility:\s*visible/);
  assert.doesNotMatch(tabMonth, /print-container/);
});

test("isolated print document preserves dense shift layout and full labels on paper", () => {
  const printModule = read("src/core/scheduleMonthPrint.cjs");
  const tabMonth = activeTabMonthSource();
  assert.match(printModule, /print-shift-stack/);
  assert.match(printModule, /overflow:\s*visible/);
  assert.match(printModule, /print-day-dense/);
  assert.match(printModule, /font-size:\s*7px/);
  assert.match(printModule, /line-height:\s*1/);
  assert.match(tabMonth, /fullLabel:\s*labels\.full/);
  assert.match(tabMonth, /<span className="hidden sm:inline">\{s\.fullLabel\}<\/span>/);
});

test("active App runtime loads Schedule from src/features/schedule, not legacy month components", () => {
  const app = read("src/App.js");
  assert.match(app, /import\('\.\/features\/schedule'\)/);
  const schedule = read("src/features/schedule.jsx");
  assert.match(schedule, /const TabMonth =/);
});
