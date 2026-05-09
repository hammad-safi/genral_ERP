import { useState } from 'react';
import { Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRGenerator({ value }) {
  const handleDownload = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `qr-${value}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="mb-3 text-sm text-slate-600">QR Code for barcode</div>
      <div className="inline-flex rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <QRCodeSVG id="qr-code-svg" value={value || 'N/A'} size={160} includeMargin={true} />
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        <Download className="h-4 w-4" />
        Download QR
      </button>
    </div>
  );
}