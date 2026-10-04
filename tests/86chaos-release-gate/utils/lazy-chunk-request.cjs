'use strict';

function normalizeRequestPath(value = '') {
  try {
    return new URL(String(value || ''), 'http://127.0.0.1').pathname;
  } catch (_) {
    return String(value || '').split(/[?#]/, 1)[0];
  }
}

function isLazyJavaScriptChunkRequest(value = '') {
  const pathname = normalizeRequestPath(value);
  if (!/\/static\/js\//i.test(pathname)) return false;
  const filename = pathname.split('/').pop() || '';
  if (/^(?:bundle|main|runtime-main)(?:\.[^.]+)?\.js$/i.test(filename)) return false;
  return /\.chunk\.js$/i.test(filename);
}

module.exports = { normalizeRequestPath, isLazyJavaScriptChunkRequest };
