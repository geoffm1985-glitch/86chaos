'use strict';
const { applyFirebaseEmulatorEnv, getFirebaseTarget } = require('./86chaos-firebase-target.cjs');
const bridge = require('../yardmaster.firebase.json');

function prepareYardmasterEnv(env) {
  // Yardmaster's pinned target takes precedence over inherited CRA/cloud settings.
  const selected = env.YARDMASTER_FIREBASE_TARGET || env.CHAOS_FIREBASE_TARGET || env.REACT_APP_86CHAOS_FIREBASE_TARGET;
  if (String(selected || '').trim().toLowerCase() !== 'emulator') throw new Error('Yardmaster local startup requires an explicit emulator target; live Firebase was not selected.');
  env.REACT_APP_86CHAOS_FIREBASE_TARGET = 'emulator';
  const target = getFirebaseTarget(env);
  applyFirebaseEmulatorEnv(env);
  for (const [product, port] of Object.entries(target.ports)) env[`REACT_APP_86CHAOS_${product.toUpperCase()}_EMULATOR_PORT`] = String(port);
  env.REACT_APP_86CHAOS_FIREBASE_EMULATOR_HOST = target.host;
  const url = new URL(bridge.localApp.url);
  env.HOST = url.hostname;
  env.PORT = url.port;
  env.BROWSER = 'none';
  env.HTTPS = 'false';
  env.PUBLIC_URL = '/';
  env.REACT_APP_86CHAOS_YARDMASTER = 'true';
  return target;
}
if (require.main === module) {
  prepareYardmasterEnv(process.env);
  // Yardmaster blocks remote assets; build the existing Tailwind utilities locally.
  require('node:fs').mkdirSync('.cache', { recursive: true });
  const css = require('node:child_process').spawnSync(process.execPath, [require.resolve('tailwindcss/lib/cli.js'), '--config', 'scripts/yardmaster-tailwind.config.cjs', '--input', 'src/styles.css', '--output', '.cache/yardmaster-tailwind.css'], { stdio: 'inherit', windowsHide: true });
  if (css.status !== 0) process.exit(css.status || 1);
  process.env.NODE_ENV = process.env.BABEL_ENV = 'development';
  const configPath = require.resolve('react-scripts/config/webpack.config');
  const factory = require(configPath);
  require.cache[configPath].exports = mode => {
    const config = factory(mode);
    config.plugins.push({ apply(compiler) {
      compiler.hooks.compilation.tap('YardmasterLocalStyles', compilation => {
        require('html-webpack-plugin').getHooks(compilation).beforeEmit.tap('YardmasterLocalStyles', data => {
          data.html = data.html.replace('<script src="https://cdn.tailwindcss.com"></script>', '<link rel="stylesheet" href="/yardmaster-tailwind.css">');
          return data;
        });
      });
    } });
    return config;
  };
  require('react-scripts/scripts/start');
}
module.exports = { prepareYardmasterEnv };
