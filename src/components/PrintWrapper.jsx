import { forwardRef, useRef, useImperativeHandle } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useSettings } from '@/hooks/useSettings';
import { Printer } from 'lucide-react';
import GlobalButton from './GlobalButton';

const PrintWrapper = forwardRef(({ title, printLabel, children, showButton = false }, ref) => {
  const internalPrintRef = useRef(null);
  const settings = useSettings();

  // Expose the internal ref element to the parent so they can use it for their own react-to-print
  useImperativeHandle(ref, () => internalPrintRef.current, []);

  const handlePrint = useReactToPrint({
    contentRef: internalPrintRef,
    documentTitle: printLabel,
  });

  return (
    <div className="space-y-4">
      {showButton && (
        <div className="flex justify-end">
          <GlobalButton variant="primary" icon={Printer} onClick={() => handlePrint()}>
            Print {title}
          </GlobalButton>
        </div>
      )}
      <div ref={internalPrintRef} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:shadow-none print:border-none print:p-0">
        <div className="hidden print:block space-y-3 text-center border-b border-slate-200 pb-4 mb-4">
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
});

PrintWrapper.displayName = 'PrintWrapper';
export default PrintWrapper;
