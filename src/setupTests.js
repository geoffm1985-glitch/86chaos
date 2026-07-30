/* global globalThis, jest */
const util = require('util');

if (typeof globalThis.TextEncoder === 'undefined' && util.TextEncoder) {
  globalThis.TextEncoder = util.TextEncoder;
}

if (typeof globalThis.TextDecoder === 'undefined' && util.TextDecoder) {
  globalThis.TextDecoder = util.TextDecoder;
}

try {
  const webStreams = require('stream/web');

  if (typeof globalThis.ReadableStream === 'undefined' && webStreams.ReadableStream) {
    globalThis.ReadableStream = webStreams.ReadableStream;
  }

  if (typeof globalThis.WritableStream === 'undefined' && webStreams.WritableStream) {
    globalThis.WritableStream = webStreams.WritableStream;
  }

  if (typeof globalThis.TransformStream === 'undefined' && webStreams.TransformStream) {
    globalThis.TransformStream = webStreams.TransformStream;
  }
} catch (error) {
  // Older Node/Jest environments may not expose stream/web.
}

jest.mock('firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({
    app: null,
    name: '[jest-mocked-messaging]'
  })),
  isSupported: jest.fn(() => Promise.resolve(false)),
  getToken: jest.fn(() => Promise.resolve(null)),
  onMessage: jest.fn(() => () => {})
}));
