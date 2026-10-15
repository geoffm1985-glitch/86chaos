(function(root) {
  'use strict';
  function selectFirestoreTransport({ native = false, platform = '', userAgent = '' } = {}) {
    const webkit = /AppleWebKit\//i.test(userAgent) && !/(?:Chrome|Chromium|Edg|OPR|SamsungBrowser)\//i.test(userAgent);
    const longPolling = { experimentalForceLongPolling: true, experimentalAutoDetectLongPolling: false };
    // Firebase 10.14.1 enables Fetch streams even with forced long polling.
    // Its pinned transport option selects XMLHttpRequest for WebKit navigation;
    // an installed-SDK contract and real browser requests guard this dependency.
    if (webkit) return { ...longPolling, useFetchStreams: false };
    return native && platform === 'android' ? longPolling : null;
  }
  const api = { selectFirestoreTransport };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.__86ChaosFirestorePlatformTransportShared = api;
})(globalThis);
