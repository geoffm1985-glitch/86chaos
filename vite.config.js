const { defineConfig } = require('vite');
const reactPluginModule = require('@vitejs/plugin-react');
const { createReactJsxModuleTypePlugin } = require('./scripts/vite-react-jsx-module-type.cjs');

const react = reactPluginModule.default || reactPluginModule;

const browserEnvKeys = [
  'REACT_APP_ALLOW_TEST_FIREBASE_API_KEY_OVERRIDE',
  'REACT_APP_FIREBASE_ACTIVE_PROJECT_ID',
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_APPCHECK_SITE_KEY',
  'REACT_APP_FIREBASE_APP_ID',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_DEPLOYMENT_MODE',
  'REACT_APP_FIREBASE_MEASUREMENT_ID',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_MASTER_ADMIN_EMAIL',
  'REACT_APP_MFA_ENFORCE_ELEVATED_ROLES',
  'REACT_APP_PROD_FIREBASE_API_KEY',
  'REACT_APP_PROD_FIREBASE_APPCHECK_SITE_KEY',
  'REACT_APP_PROD_FIREBASE_APP_ID',
  'REACT_APP_PROD_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_PROD_FIREBASE_DATABASE_URL',
  'REACT_APP_PROD_FIREBASE_MEASUREMENT_ID',
  'REACT_APP_PROD_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_PROD_FIREBASE_PROJECT_ID',
  'REACT_APP_PROD_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_TEST_FIREBASE_API_KEY',
  'REACT_APP_TEST_FIREBASE_APPCHECK_SITE_KEY',
  'REACT_APP_TEST_FIREBASE_APP_ID',
  'REACT_APP_TEST_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_TEST_FIREBASE_DATABASE_URL',
  'REACT_APP_TEST_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_TEST_FIREBASE_PROJECT_ID',
  'REACT_APP_TEST_FIREBASE_STORAGE_BUCKET'
];

function buildBrowserProcessEnv() {
  const browserEnv = { NODE_ENV: process.env.NODE_ENV || 'production' };
  for (const key of browserEnvKeys) {
    browserEnv[key] = process.env[key] || '';
  }
  return browserEnv;
}

module.exports = defineConfig(({ mode }) => {
  const nodeEnv = mode === 'production' ? 'production' : 'development';
  const processEnv = buildBrowserProcessEnv();
  processEnv.NODE_ENV = nodeEnv;
  return {
    plugins: [createReactJsxModuleTypePlugin(), react()],
    publicDir: 'public',
    define: {
      'process.env': JSON.stringify(processEnv)
    },
    build: {
      outDir: 'build',
      emptyOutDir: true,
      sourcemap: false,
      assetsDir: 'static',
      target: 'es2020'
    },
    server: {
      host: '0.0.0.0'
    }
  };
});

module.exports._test = { browserEnvKeys, buildBrowserProcessEnv };
