'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const schedule = fs.readFileSync(path.join(root, 'src/features/schedule.jsx'), 'utf8');
const tabMonth = fs.readFileSync(path.join(root, 'src/components/TabMonth.js'), 'utf8');

function assertReadableOnePagePrintCss(source, label) {
  assert.match(source, /@page\s*\{?\s*size:\s*letter landscape;\s*margin:\s*0\.12in/i, `${label} uses tight letter-landscape print margins`);
  assert.match(source, /width:\s*10\.76in;\s*height:\s*8\.26in/i, `${label} constrains the generated page to the printable letter-landscape box`);
  assert.match(source, /grid-template-rows:\s*18px\s+repeat\(\$\{weeks\},\s*minmax\(0,\s*1fr\)\)/, `${label} keeps the month grid constrained to one page`);
  assert.match(source, /font-size:\s*8\.6px/i, `${label} uses larger printed shift text than the previous 6px repair`);
  assert.match(source, /font-family:\s*["']Arial Narrow["'],\s*Arial,\s*Helvetica,\s*sans-serif/i, `${label} uses a condensed font stack for one-line name and shift rows`);
  assert.match(source, /letter-spacing:\s*-?0?\.035em/i, `${label} slightly condenses shift text instead of wrapping it`);
  assert.match(source, /white-space:\s*nowrap/i, `${label} keeps employee name and shift time on one line`);
  assert.match(source, /overflow:\s*hidden/i, `${label} prevents overflow from creating a second printed page`);
  assert.doesNotMatch(source, /font-size:\s*6px/i, `${label} no longer uses the too-small 6px printed shift text`);
}

test('Month View printed calendar uses larger one-line shift text while staying one page', () => {
  assertReadableOnePagePrintCss(schedule, 'active Schedule Month View');
  assertReadableOnePagePrintCss(tabMonth, 'legacy TabMonth print view');
});
