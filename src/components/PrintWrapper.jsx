import { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useSettings } from '@/hooks/useSettings';

export default function PrintWrapper({ title, printLabel, children }) {
  const printRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);
  const settings = useSettings();

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: printLabel,
    onAfterPrint: () => setShowPreview(false),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-panel sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-600">{title}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowPreview(true);
            setTimeout(() => handlePrint(), 100);
          }}
          className="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          🖨 Print {printLabel}
        </button>
      </div>
      <div ref={printRef} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="space-y-3 text-center border-b border-slate-200 pb-4 mb-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">{settings?.shopName || 'Offline Shop ERP'}</p>
            {settings?.address && (
              <p className="text-sm text-slate-600">{settings.address}</p>
            )}
            {settings?.phone && (
              <p className="text-sm text-slate-600">Ph: {settings.phone}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}