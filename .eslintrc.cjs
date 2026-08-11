module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  },
  env: {
    browser: true,
    es2022: true,
    jest: true
  },
  rules: {
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'valid-typeof': 'error'
  },
  overrides: [
    {
      files: ['api/**/*.js'],
      env: { node: true, browser: false, es2022: true },
      parserOptions: { sourceType: 'script', ecmaVersion: 2022 }
    },
    {
      files: ['api/alerts.js', 'api/scan.js', 'api/send-push.js', 'api/send-schedule-alert.js'],
      env: { node: true, browser: false, es2022: true },
      parserOptions: { sourceType: 'module', ecmaVersion: 2022 }
    },
    {
      files: ['src/**/*.{js,jsx}'],
      env: { browser: true, es2022: true, jest: true },
      parserOptions: { sourceType: 'module', ecmaVersion: 2022, ecmaFeatures: { jsx: true } }
    }
  ]
};
