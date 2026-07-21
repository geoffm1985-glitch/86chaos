import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

const DayDotPrintScreen = ({ labelsToPrint, prepDate, appUser, onClose, formatDisplayDate, getExpDate }) => {
  const onCloseRef = useRef(onClose);
  const closingRef = useRef(false);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const closePrintScreenOnce = () => { if (closingRef.current) return; closingRef.current = true; onCloseRef.current?.(); };
    const handleBackButton = () => closePrintScreenOnce(); 
    const handleAfterPrint = () => closePrintScreenOnce();
    window.history.pushState({ tab: 'prep', printScreen: true }, ''); 
    window.addEventListener('popstate', handleBackButton);
    window.addEventListener('afterprint', handleAfterPrint);
    const timer = setTimeout(() => { window.print(); setTimeout(closePrintScreenOnce, 1200); }, 800);
    return () => { clearTimeout(timer); window.removeEventListener('popstate', handleBackButton); window.removeEventListener('afterprint', handleAfterPrint); };
  }, []);
  
  return (
    <div id="master-print-wrapper" className="fixed inset-0 z-[999999] bg-white overflow-y-auto text-black print:static print:block print:overflow-visible print:h-auto print:w-auto">
      <style>{`@media print { 
        @page { size: 3.5in 1.1in; margin: 0; } 
        body, html { margin: 0 !important; background: white !important; height: auto !important; } 
        #master-print-wrapper { position: static !important; overflow: visible !important; height: auto !important; display: block !important; }
        .no-print { display: none !important; } 
        .dk-label { width: 3.5in !important; height: 1.1in !important; display: flex !important; flex-direction: column !important; justify-content: center !important; padding: 0.05in 0.15in !important; box-sizing: border-box !important; page-break-after: always !important; margin: 0 !important; font-family: sans-serif !important; overflow: hidden !important; } 
        .dk-title { font-size: 16px !important; font-weight: 900 !important; text-transform: uppercase !important; text-align: center !important; margin-bottom: 2px !important; } 
        .dk-row { display: flex !important; justify-content: space-between !important; font-size: 11px !important; font-weight: bold !important; margin-bottom: 2px !important; } 
        .dk-exp { display: flex !important; justify-content: center !important; font-size: 14px !important; font-weight: 900 !important; border-top: 2px solid black !important; padding-top: 2px !important; } 
      }`}</style>
      <div className="no-print p-6 flex flex-col items-center justify-center min-h-screen bg-slate-100">
         <Loader2 className="animate-spin text-[#8F6040] mb-6" size={64} />
         <h2 className="text-3xl font-black text-slate-900 mb-2">Generating Labels</h2>
         <button onClick={() => onCloseRef.current?.()} className="bg-slate-900 text-white px-10 py-5 rounded-xl font-black text-lg shadow-xl hover:bg-slate-800 w-full max-w-xs mt-8">Return to App</button>
      </div>
      <div id="print-data">
        {labelsToPrint.map((item, idx) => {
          const prepDateParts = formatDisplayDate(prepDate).split(','); const prepStr = prepDateParts.length > 1 ? prepDateParts[1].trim() : formatDisplayDate(prepDate);
          return (<div key={`print-${idx}`} className="dk-label"><div className="dk-title">{item.text}</div><div className="dk-row"><span>PREP: {prepStr}</span><span>EMP: {appUser?.name ? appUser.name.split(' ')[0].toUpperCase() : '___'}</span></div><div className="dk-exp">EXP: {getExpDate(prepDate)}</div></div>);
        })}
      </div>
    </div>
  );
};

export default DayDotPrintScreen;
