import { Capacitor, registerPlugin } from '@capacitor/core';
import { createNativeSpeechRecognition } from './nativeSpeechClient.mjs';

export const NativeCapabilities = registerPlugin('ChaosNative');
export const isNativeAndroid = () => Capacitor.getPlatform() === 'android';
export const AndroidSpeechRecognition = createNativeSpeechRecognition(NativeCapabilities);

export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the selected file.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

export async function saveNativeFile(blob, filename) {
  const result = await NativeCapabilities.saveFile({ base64: await blobToBase64(blob), filename, mimeType: blob.type || 'application/octet-stream' });
  return { method: result.cancelled ? 'native-save-cancelled' : 'native-save', ...result };
}

export function installNativeDocumentBridge() {
  if (!isNativeAndroid() || typeof window === 'undefined' || window.__chaosNativeDocumentsInstalled) return;
  window.__chaosNativeDocumentsInstalled = true;
  const showError = error => window.alert(error?.message || 'The document could not be saved. Please try again.');
  window.print = () => { NativeCapabilities.printPage({ title: '86 Chaos' }).catch(showError); };
  document.addEventListener('click', event => {
    const link = event.target?.closest?.('a[download]');
    if (!link || !/^(blob:|data:)/i.test(link.href)) return;
    event.preventDefault();
    // Begin reading before callers revoke their temporary browser URL.
    const response = fetch(link.href);
    response.then(result => result.blob()).then(blob => saveNativeFile(blob, link.download || '86chaos-export')).catch(showError);
  }, true);
}
