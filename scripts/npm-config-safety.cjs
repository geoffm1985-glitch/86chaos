'use strict';
function safeNpmConfig(text) {
  return String(text).split(/\r?\n/).every(line => {
    const value = line.trim();
    if (!value || value.startsWith('#') || value.startsWith(';')) return true;
    if (value === 'registry=https://registry.npmjs.org/' || value === 'registry=https://registry.npmjs.org') return true;
    return /^(legacy-peer-deps|audit|fund|progress|engine-strict)=(true|false)$/.test(value);
  });
}
module.exports = { safeNpmConfig };
