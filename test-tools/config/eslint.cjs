module.exports = {
  root: true,
  env: { es2021: true },
  extends: ['react-app'],
  ignorePatterns: [
    'build/**',
    'coverage/**',
    'node_modules/**',
    'playwright-report/**',
    'test-results/**',
    'functions/**',
  ],
  overrides: [
    {
      files: ['api/**/*.js', 'scripts/**/*.js'],
      env: { node: true, es2022: true },
    },
    {
      files: ['src/**/*.test.js', 'src/**/*.test.jsx', 'src/**/*.spec.js', 'src/**/*.spec.jsx', 'src/**/__tests__/**/*.{js,jsx}'],
      extends: ['react-app/jest'],
    },
  ],
};
