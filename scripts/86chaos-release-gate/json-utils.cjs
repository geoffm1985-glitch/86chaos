'use strict';
const fs = require('fs');

function stripUtf8Bom(text = '') {
  return String(text || '').replace(/^\uFEFF/, '');
}

function readJsonFile(filePath, options = {}) {
  const { optional = false, diagnostics = null } = options || {};
  try {
    if (!fs.existsSync(filePath)) {
      if (optional) return null;
      const error = new Error(`JSON file not found: ${filePath}`);
      error.code = 'ENOENT';
      throw error;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(stripUtf8Bom(raw));
  } catch (error) {
    const diagnostic = {
      filePath,
      error: error?.message || String(error),
      code: error?.code || '',
      parsedAt: new Date().toISOString()
    };
    if (diagnostics && Array.isArray(diagnostics)) diagnostics.push(diagnostic);
    if (optional) return null;
    error.jsonDiagnostic = diagnostic;
    throw error;
  }
}

function readJsonIfExists(filePath, diagnostics = null) {
  return readJsonFile(filePath, { optional: true, diagnostics });
}

module.exports = {
  stripUtf8Bom,
  readJsonFile,
  readJsonIfExists
};
