const fs = require('fs');
const path = require('path');

function parseEnvText(text) {
  const out = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

function loadEnv(root = process.cwd()) {
  const report = [];
  for (const name of ['.env.test.local', '.env.test', '.env.local', '.env']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    try {
      const parsed = parseEnvText(fs.readFileSync(p, 'utf8'));
      let filled = 0;
      for (const [k, v] of Object.entries(parsed)) {
        if (!process.env[k] && v) { process.env[k] = v; filled += 1; }
      }
      report.push({ path: p, keys: Object.keys(parsed).length, filled });
    } catch (error) {
      report.push({ path: p, error: error.message });
    }
  }
  return report;
}

function env(...names) {
  for (const name of names) if (process.env[name]) return process.env[name];
  return '';
}

function boolEnv(...names) { return /^(1|true|yes|y)$/i.test(env(...names)); }

module.exports = { loadEnv, env, boolEnv };
