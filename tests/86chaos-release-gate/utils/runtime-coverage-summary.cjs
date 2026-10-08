'use strict';
const { createHash } = require('node:crypto');

function mergePositiveRanges(ranges, sourceLength) {
  const selected = [];
  for (const range of ranges) {
    const { startOffset, endOffset, count } = range;
    if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || startOffset < 0 || endOffset < startOffset || endOffset > sourceLength || !Number.isFinite(count) || count < 0) {
      throw new Error('Invalid runtime coverage range');
    }
    if (count > 0 && endOffset > startOffset) selected.push([startOffset, endOffset]);
  }
  selected.sort((a,b) => a[0]-b[0]);
  const merged = [];
  for (const range of selected) {
    const last = merged[merged.length-1];
    if (!last || range[0] > last[1]) merged.push([...range]);
    else last[1] = Math.max(last[1], range[1]);
  }
  return merged;
}

function summarizeScriptCoverage(entries) {
  const groups = new Map();
  for (const [sampleIndex, entry] of entries.entries()) {
    if (!entry.url || typeof entry.source !== 'string' || !entry.source.length) throw new Error('Runtime coverage requires a captured script URL and source');
    const sourceSha256 = createHash('sha256').update(entry.source, 'utf8').digest('hex');
    // resetOnNavigation:false retains multiple V8 script IDs for the same asset.
    // Accumulate execution across documents without counting its source twice.
    const key = JSON.stringify([entry.url, sourceSha256]);
    if (!groups.has(key)) groups.set(key, {url:entry.url, source:entry.source, sourceSha256, sampleCount:0, ranges:[], functions:new Map()});
    const group = groups.get(key);
    group.sampleCount++;
    for (const [functionIndex, fn] of (entry.functions || []).entries()) {
      const ranges = fn.ranges || [];
      group.ranges.push(...ranges);
      if (!fn.functionName || fn.functionName === '(anonymous)') continue;
      const outer = ranges[0];
      const functionKey = outer ? JSON.stringify([fn.functionName,outer.startOffset,outer.endOffset]) : JSON.stringify([fn.functionName,sampleIndex,functionIndex]);
      const prior = group.functions.get(functionKey);
      group.functions.set(functionKey, {name:fn.functionName, covered:Boolean(prior?.covered || ranges.some(range => range.count > 0))});
    }
  }
  const perScript = [...groups.values()].map(group => {
    const ranges = mergePositiveRanges(group.ranges, group.source.length);
    const totalBytes = Buffer.byteLength(group.source,'utf8');
    // V8 offsets use UTF-16 code units; both sides of the byte ratio use UTF-8.
    const coveredBytes = ranges.reduce((sum,[start,end]) => sum+Buffer.byteLength(group.source.slice(start,end),'utf8'),0);
    const functions = [...group.functions.values()];
    const coveredFunctions = functions.filter(fn => fn.covered).length;
    return {url:group.url, sourceSha256:group.sourceSha256, sampleCount:group.sampleCount, totalBytes, coveredBytes,
      bytePercent:Number((coveredBytes/totalBytes*100).toFixed(2)), totalFunctions:functions.length, coveredFunctions,
      functionPercent:functions.length ? Number((coveredFunctions/functions.length*100).toFixed(2)) : 100,
      uncoveredFunctions:functions.filter(fn => !fn.covered).map(fn => fn.name).slice(0,500)};
  });
  const totals = perScript.reduce((sum,row) => ({totalBytes:sum.totalBytes+row.totalBytes,coveredBytes:sum.coveredBytes+row.coveredBytes,totalFunctions:sum.totalFunctions+row.totalFunctions,coveredFunctions:sum.coveredFunctions+row.coveredFunctions}),{totalBytes:0,coveredBytes:0,totalFunctions:0,coveredFunctions:0});
  totals.bytePercent = totals.totalBytes ? Number((totals.coveredBytes/totals.totalBytes*100).toFixed(2)) : 0;
  totals.functionPercent = totals.totalFunctions ? Number((totals.coveredFunctions/totals.totalFunctions*100).toFixed(2)) : 100;
  return {perScript,totals,aggregation:{rawScriptSamples:entries.length,uniqueScriptVersions:perScript.length,duplicateScriptSamplesMerged:entries.length-perScript.length}};
}

module.exports = { summarizeScriptCoverage };
