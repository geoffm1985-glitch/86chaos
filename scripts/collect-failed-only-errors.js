// Collect failed-only Playwright output into one uploadable text file.
const fs = require('fs');
const path = require('path');

const resultsDir = path.join(process.cwd(), 'test-results');
const jsonPath = path.join(resultsDir, '86chaos-failed-only-report.json');
const consolePath = path.join(resultsDir, '86chaos-failed-only-console.log');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = path.join(resultsDir, `86chaos-failed-only-UPLOAD-ME-${timestamp}.txt`);

function safeRead(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; }
}

function flattenSpecs(suite, rows = []) {
  for (const spec of suite.specs || []) rows.push(spec);
  for (const child of suite.suites || []) flattenSpecs(child, rows);
  return rows;
}

function allTests(report) {
  const rows = [];
  for (const suite of report.suites || []) {
    for (const spec of flattenSpecs(suite)) {
      for (const test of spec.tests || []) {
        for (const result of test.results || []) {
          rows.push({
            title: [...(suite.title ? [suite.title] : []), spec.title].join(' > '),
            file: spec.file,
            line: spec.line,
            status: result.status,
            duration: result.duration,
            errors: result.errors || [],
            attachments: result.attachments || [],
            stdout: result.stdout || [],
            stderr: result.stderr || [],
          });
        }
      }
    }
  }
  return rows;
}

let output = '';
output += '86 CHAOS FAILED-ONLY REGRESSION UPLOAD PACKET\n';
output += `Generated: ${new Date().toISOString()}\n`;
output += `Repo: ${process.cwd()}\n`;
output += `Report: ${jsonPath}\n`;
output += `Console: ${consolePath}\n\n`;

const consoleLog = safeRead(consolePath);
if (!fs.existsSync(jsonPath)) {
  output += 'No Playwright JSON report found. The test command may have failed before reporting.\n\n';
  output += 'CONSOLE OUTPUT:\n';
  output += consoleLog || '[No console log was captured.]\n';
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(outPath);
  process.exit(0);
}

let report;
try {
  report = JSON.parse(safeRead(jsonPath));
} catch (error) {
  output += `Could not parse Playwright JSON report: ${error.message}\n\n`;
  output += 'CONSOLE OUTPUT:\n';
  output += consoleLog || '[No console log was captured.]\n';
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(outPath);
  process.exit(0);
}

const rows = allTests(report);
const failed = rows.filter((r) => r.status !== 'passed' && r.status !== 'skipped');

output += `Total results: ${rows.length}\n`;
output += `Failed/non-passed: ${failed.length}\n\n`;

if (consoleLog) {
  output += 'SUMMARY CONSOLE OUTPUT:\n';
  output += consoleLog.slice(-12000) + '\n\n';
}

for (const row of failed) {
  output += '================================================================================\n';
  output += `FAILED: ${row.title}\n`;
  output += `FILE: ${row.file}:${row.line}\n`;
  output += `STATUS: ${row.status}\n`;
  output += `DURATION MS: ${row.duration}\n\n`;
  for (const error of row.errors) {
    output += 'ERROR:\n';
    output += `${error.message || ''}\n`;
    if (error.stack) output += `${error.stack}\n`;
    output += '\n';
  }
  for (const attachment of row.attachments || []) {
    output += `ATTACHMENT: ${attachment.name || ''} ${attachment.path || ''}\n`;
    if (attachment.path && fs.existsSync(attachment.path)) {
      const content = safeRead(attachment.path);
      if (content) output += content.slice(0, 10000) + '\n';
    }
  }
  output += '\n';
}

if (!failed.length) {
  output += 'All failed-only regression tests passed.\n';
}

fs.mkdirSync(resultsDir, { recursive: true });
fs.writeFileSync(outPath, output, 'utf8');
console.log(outPath);
