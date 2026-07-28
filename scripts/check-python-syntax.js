const { spawnSync } = require('child_process');

const candidates = process.platform === 'win32'
  ? [
      { cmd: 'py', args: ['-m', 'py_compile', 'scripts/python/ops_intelligence.py'] },
      { cmd: 'python', args: ['-m', 'py_compile', 'scripts/python/ops_intelligence.py'] },
      { cmd: 'python3', args: ['-m', 'py_compile', 'scripts/python/ops_intelligence.py'] }
    ]
  : [
      { cmd: 'python3', args: ['-m', 'py_compile', 'scripts/python/ops_intelligence.py'] },
      { cmd: 'python', args: ['-m', 'py_compile', 'scripts/python/ops_intelligence.py'] },
      { cmd: 'py', args: ['-m', 'py_compile', 'scripts/python/ops_intelligence.py'] }
    ];

const attempted = [];
for (const candidate of candidates) {
  const result = spawnSync(candidate.cmd, candidate.args, { stdio: 'inherit', shell: process.platform === 'win32' });
  attempted.push(candidate.cmd);
  if (result.status === 0) process.exit(0);
  if (result.error && result.error.code !== 'ENOENT') {
    console.error(`Python syntax check failed using ${candidate.cmd}:`, result.error.message);
  }
}

console.error(`Python was not found or py_compile failed. Tried: ${attempted.join(', ')}`);
process.exit(1);
