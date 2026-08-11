/* global globalThis, jest */
const util = require('util');

function installFetchShim() {
  if (typeof globalThis.fetch === 'function') return;
  try {
    const undici = require('undici');
    if (typeof undici.fetch === 'function') globalThis.fetch = undici.fetch;
    if (typeof globalThis.Headers === 'undefined' && undici.Headers) globalThis.Headers = undici.Headers;
    if (typeof globalThis.Request === 'undefined' && undici.Request) globalThis.Request = undici.Request;
    if (typeof globalThis.Response === 'undefined' && undici.Response) globalThis.Response = undici.Response;
    if (typeof globalThis.FormData === 'undefined' && undici.FormData) globalThis.FormData = undici.FormData;
    if (typeof globalThis.File === 'undefined' && undici.File) globalThis.File = undici.File;
    if (typeof globalThis.Blob === 'undefined' && undici.Blob) globalThis.Blob = undici.Blob;
    return;
  } catch (_) {}

  globalThis.fetch = () => Promise.reject(new Error('fetch is unavailable in the Jest environment'));
  if (typeof globalThis.Headers === 'undefined') globalThis.Headers = class Headers {};
  if (typeof globalThis.Request === 'undefined') globalThis.Request = class Request {};
  if (typeof globalThis.Response === 'undefined') globalThis.Response = class Response {};
}

installFetchShim();

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
