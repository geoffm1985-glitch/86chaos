import { PDFDocument } from 'pdf-lib';
import { Capacitor } from '@capacitor/core';
import { NativeCapabilities, installNativeDocumentBridge, saveNativeFile } from './nativeCapabilities';
import { deliverSchedulePdf } from './schedulePdfDelivery';

jest.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: jest.fn(() => 'android') },
  registerPlugin: () => ({ saveFile: jest.fn(), printPage: jest.fn() })
}));

beforeEach(() => { jest.clearAllMocks(); Capacitor.getPlatform.mockReturnValue('android'); });

test('APK schedule PDF bytes survive native encoding and bypass unavailable browser delivery', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage([612,792]);
  const bytes = await pdf.save(); NativeCapabilities.saveFile.mockResolvedValue({cancelled:false});
  const browser = { open:jest.fn(), navigator:{share:jest.fn()}, Blob };
  const result = await deliverSchedulePdf(bytes,{filename:'schedule.pdf',windowObject:browser});
  const saved = NativeCapabilities.saveFile.mock.calls[0][0];
  expect(saved.filename).toBe('schedule.pdf'); expect(saved.mimeType).toBe('application/pdf');
  expect((await PDFDocument.load(Uint8Array.from(atob(saved.base64),c=>c.charCodeAt(0)))).getPageCount()).toBe(1);
  expect(result.method).toBe('native-save'); expect(browser.open).not.toHaveBeenCalled(); expect(browser.navigator.share).not.toHaveBeenCalled();
});
test('cancelling the Android picker is a cancellation and save failures reach the caller', async () => {
  NativeCapabilities.saveFile.mockResolvedValue({cancelled:true});
  expect((await saveNativeFile(new Blob(['csv'],{type:'text/csv'}),'report.csv')).method).toBe('native-save-cancelled');
  NativeCapabilities.saveFile.mockRejectedValue(new Error('Provider unavailable'));
  await expect(saveNativeFile(new Blob(['csv']),'report.csv')).rejects.toThrow('Provider unavailable');
});
test('native download bridge starts reading before a synchronous URL revocation and installs once', async () => {
  delete window.__chaosNativeDocumentsInstalled;
  const order=[]; window.fetch=jest.fn(()=>{order.push('read');return Promise.resolve({blob:()=>Promise.resolve(new Blob(['a,b\n1,2'],{type:'text/csv'}))});});
  global.fetch=window.fetch;
  NativeCapabilities.saveFile.mockResolvedValue({cancelled:false});
  installNativeDocumentBridge(); installNativeDocumentBridge();
  const link=document.createElement('a'); link.href='blob:https://app.86chaos.com/test';link.download='review.csv';document.body.appendChild(link);
  const click=new MouseEvent('click',{bubbles:true,cancelable:true}); link.dispatchEvent(click);order.push('revoke');link.remove();
  expect(click.defaultPrevented).toBe(true);expect(order).toEqual(['read','revoke']);
  await new Promise(resolve=>setTimeout(resolve,30));
  expect(NativeCapabilities.saveFile).toHaveBeenCalledTimes(1);expect(NativeCapabilities.saveFile.mock.calls[0][0].filename).toBe('review.csv');
  NativeCapabilities.printPage.mockResolvedValue({});window.print();expect(NativeCapabilities.printPage).toHaveBeenCalledTimes(1);
});
