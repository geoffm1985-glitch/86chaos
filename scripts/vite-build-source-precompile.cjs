'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BUILD_WORKSPACE_PREFIX = '.vite-build-root-';
const OXC_JSX_OPTIONS = Object.freeze({
  jsx: Object.freeze({
    runtime: 'automatic',
    importSource: 'react'
  })
});

function walkFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else files.push(full);
  }
  return files;
}

function listSourceJsFiles(workspaceRoot) {
  const srcRoot = path.join(workspaceRoot, 'src');
  if (!fs.existsSync(srcRoot)) return [];
  return walkFiles(srcRoot).filter((file) => file.endsWith('.js')).sort();
}

function createBuildWorkspace(root, workspaceRoot = path.join(root, `${BUILD_WORKSPACE_PREFIX}${process.pid}`)) {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
  fs.mkdirSync(workspaceRoot, { recursive: true });
  fs.cpSync(path.join(root, 'src'), path.join(workspaceRoot, 'src'), { recursive: true });
  fs.cpSync(path.join(root, 'public'), path.join(workspaceRoot, 'public'), { recursive: true });
  fs.copyFileSync(path.join(root, 'index.html'), path.join(workspaceRoot, 'index.html'));
  return workspaceRoot;
}

async function precompileWorkspaceSource(workspaceRoot, transformWithOxc) {
  if (typeof transformWithOxc !== 'function') {
    throw new TypeError('transformWithOxc must be a function');
  }

  const sourceFiles = listSourceJsFiles(workspaceRoot);
  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    // Vite/Oxc determines whether JSX grammar is legal from the supplied filename.
    // The temporary copy keeps its real .js path for imports; only the compiler hint
    // uses .jsx so CRA-era React source can be normalized to plain JavaScript first.
    const jsxParserFilename = file.slice(0, -3) + '.jsx';
    const transformed = await transformWithOxc(source, jsxParserFilename, OXC_JSX_OPTIONS);
    if (!transformed || typeof transformed.code !== 'string') {
      throw new Error(`Oxc did not return transformed code for ${file}`);
    }
    fs.writeFileSync(file, transformed.code, 'utf8');
  }

  return sourceFiles;
}

function cleanupBuildWorkspace(workspaceRoot) {
  if (!workspaceRoot) return;
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
}

module.exports = {
  BUILD_WORKSPACE_PREFIX,
  OXC_JSX_OPTIONS,
  walkFiles,
  listSourceJsFiles,
  createBuildWorkspace,
  precompileWorkspaceSource,
  cleanupBuildWorkspace
};
