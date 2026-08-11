'use strict';

function normalizeModuleId(id = '') {
  return String(id || '').split('?', 1)[0].replace(/\\/g, '/');
}

function isReactSourceJs(id = '') {
  const normalized = normalizeModuleId(id);
  return /(?:^|\/)src\/.*\.js$/i.test(normalized);
}

function createReactJsxModuleTypePlugin() {
  return {
    name: '86chaos-react-js-as-jsx',
    enforce: 'pre',
    transform(code, id) {
      if (!isReactSourceJs(id)) return null;
      return {
        code,
        map: null,
        moduleType: 'jsx'
      };
    }
  };
}

module.exports = {
  normalizeModuleId,
  isReactSourceJs,
  createReactJsxModuleTypePlugin
};
