const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const roots = ['api', 'functions', 'scripts'];
const files = [];

function walk(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'coverage', 'build'].includes(entry.name)) continue;
      walk(rel);
    } else if (/\.(?:cjs|mjs|js)$/.test(entry.name)) {
      files.push(rel);
    }
  }
}

roots.forEach(walk);
let failures = 0;
for (const rel of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures += 1;
    console.error(`FAIL syntax ${rel}`);
    if (result.stderr) console.error(result.stderr.trim());
    if (result.stdout) console.error(result.stdout.trim());
  } else {
    console.log(`OK syntax ${rel}`);
  }
}
if (failures) {
  console.error(`API/script syntax check failed with ${failures} file(s).`);
  process.exit(1);
}
console.log(`API/script syntax check passed for ${files.length} file(s).`);
