import React, { forwardRef, useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import Barcode from 'react-barcode';

const SupplierA4Invoice = forwardRef(({ purchase, supplier, settings, currency, businessColor }, ref) => {
  const [balance, setBalance] = useState({ previousBalance: 0, newInvoice: 0, paymentReceived: 0, newBalance: 0 });

  useEffect(() => {
    const fetchBalance = async () => {
      if (!supplier || !purchase) return;
      try {
        const res = await fetch('/api/suppliers/' + supplier.id);
        const data = await res.json();
        
        const newBalance = data.balance || 0;
        const newInvoice = purchase.totalAmount || purchase.totalCost || 0;
        const paymentReceived = purchase.amountPaid || 0;
        
        const previousBalance = newBalance - newInvoice + paymentReceived;
        
        setBalance({ previousBalance, newInvoice, paymentReceived, newBalance });
      } catch (e) {}
    };
    fetchBalance();
  }, [supplier, purchase]);

  if (!purchase) return null;

  return (
    <article 
      ref={ref} 
      className="print-page w-full max-w-[794px] min-h-[1050px] bg-white rounded-lg shadow-paper border border-slate-200/90 p-8 sm:p-12 flex flex-col justify-between mx-auto" 
      data-purpose="printable-a4-sheet"
      style={{ color: '#000', fontFamily: 'system-ui, sans-serif' }}
    >
      <div>
        {/* BEGIN: InvoiceSheetHeader */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-slate-200" data-purpose="sheet-top-header">
          {/* Document Title and Meta */}
          <div>
            <div className="inline-block">
              <span className="text-[10px] font-bold tracking-widest uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 mb-1 inline-block">Official Document</span>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">PURCHASE INVOICE</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Invoice Number:</span>
                <span className="font-mono font-bold text-slate-800 ml-1">{purchase.purchaseNumber || `INV-${purchase.id?.toString().padStart(5, '0')}`}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Issue Date:</span>
                <span className="font-semibold text-slate-800 ml-1">{formatDate(purchase.date)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Payment Terms:</span>
                <span className="font-medium text-slate-700 ml-1">On Receipt</span>
              </div>
            </div>
          </div>
          
          {/* Business / Business Branding */}
          <div className="text-left sm:text-right flex flex-col items-start sm:items-end">
            <div className="flex items-center gap-2 mb-1.5">
              {settings?.logo ? (
                <img src={settings.logo} alt="Logo" className="h-8 w-auto object-contain rounded" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center text-sm tracking-tighter shadow-sm shadow-blue-200" style={{ backgroundColor: businessColor }}>
                  {settings?.shopName ? settings.shopName.substring(0, 2).toUpperCase() : 'ERP'}
                </div>
              )}
              <div className="text-left sm:text-right">
                <h3 className="text-lg font-bold text-slate-900 leading-none">{settings?.shopName || 'Shop ERP'}</h3>
                <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Business Management System</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mt-1 whitespace-pre-wrap text-right">
              {settings?.address || '123 Business Road\nCentral District'}
              <br/>
              Phone: <span className="text-slate-700 font-medium">{settings?.phone || '(555) 123-4567'}</span>
            </p>
          </div>
        </div>
        {/* END: InvoiceSheetHeader */}
        
        {/* BEGIN: SupplierAndStoreDetails */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200 text-xs" data-purpose="parties-information">
          {/* Supplier / Vendor Information */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Supplier / Vendor</span>
            {supplier ? (
              <>
                <h4 className="text-sm font-bold text-slate-900">{supplier.name}</h4>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Phone: <span className="font-medium text-slate-800">{supplier.phone}</span><br/>
                  {supplier.address && <span>{supplier.address}</span>}
                </p>
              </>
            ) : (
              <h4 className="text-sm font-bold text-slate-900">Walk-in / General Vendor</h4>
            )}
          </div>
          
          {/* Billed / Delivered To Store */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Billed &amp; Delivered To</span>
            <h4 className="text-sm font-bold text-slate-900">{settings?.shopName || 'Shop ERP'}</h4>
            <p className="text-slate-600 mt-1 leading-relaxed">
              Attn: <span className="font-medium text-slate-700">Store Manager / Inventory In-charge</span>
            </p>
          </div>
        </div>
        {/* END: SupplierAndStoreDetails */}
        
        {/* BEGIN: ItemDetailsTable */}
        <div className="py-6" data-purpose="items-table-section">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Itemized Purchase Details</h4>
            <span className="text-[11px] text-slate-600 font-medium">Currency: {currency}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-y border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3">Product Description</th>
                  <th className="py-3 px-3">Batch &amp; Expiry</th>
                  <th className="py-3 px-3 text-center w-16">Qty</th>
                  <th className="py-3 px-3 text-right w-24">Unit Cost</th>
                  <th className="py-3 px-3 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {purchase.items?.length > 0 ? (
                  purchase.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{item.productName || item.product?.name}</div>
                        {item.product?.categoryPath && <div className="text-[11px] text-slate-500">{item.product.categoryPath}</div>}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono text-slate-700">{item.batchNumber ? `Batch: ${item.batchNumber}` : '-'}</div>
                        {item.expiryDate && <div className="text-[10px] text-emerald-600 font-medium">Exp: {formatDate(item.expiryDate)}</div>}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-800">{item.quantity}</td>
                      <td className="py-3 px-3 text-right font-mono">{formatCurrency(item.costPrice, currency)}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(item.totalCost || (item.quantity * item.costPrice), currency)}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">01</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{purchase.productName}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono text-slate-700">{purchase.batchNumber ? `Batch: ${purchase.batchNumber}` : '-'}</div>
                      {purchase.expiryDate && <div className="text-[10px] text-emerald-600 font-medium">Exp: {formatDate(purchase.expiryDate)}</div>}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-800">{purchase.quantity}</td>
                    <td className="py-3 px-3 text-right font-mono">{formatCurrency(purchase.costPrice, currency)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(purchase.totalCost, currency)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* END: ItemDetailsTable */}
        
        {/* BEGIN: FinancialTotalsAndLiveLedger */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-slate-200 items-start" data-purpose="financial-summary-grid">
          
          {/* Vendor Balance / Live Account Summary Card */}
          <div className="md:col-span-6">
            {supplier && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200" data-purpose="vendor-account-summary">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    Vendor Account Summary
                  </span>
                  <span className="text-[10px] font-medium bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">{supplier.name.substring(0, 15)}{supplier.name.length > 15 ? '...' : ''}</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Previous Account Balance:</span>
                    <span className="font-mono font-semibold text-slate-800">{formatCurrency(balance.previousBalance, currency)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Current Invoice Total:</span>
                    <span className="font-mono font-semibold text-slate-800">{formatCurrency(balance.newInvoice, currency)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-600">
                    <span>Payment Made at Delivery:</span>
                    <span className="font-mono font-semibold">{formatCurrency(balance.paymentReceived, currency)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-slate-800">Total Outstanding Balance:</span>
                    <span className={`font-mono font-bold text-sm ${balance.newBalance > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                      {formatCurrency(balance.newBalance, currency)}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-600 mt-2.5 italic">*Includes current unpaid invoice. Balance payable as per agreement.</p>
              </div>
            )}
          </div>
          
          {/* Current Invoice Subtotal & Grand Total Breakdown */}
          <div className="md:col-span-6 bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm" data-purpose="current-invoice-totals">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-500">
                <span>Items Subtotal:</span>
                <span className="font-mono text-slate-800 font-medium">{formatCurrency(purchase.subtotal || purchase.totalCost, currency)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Tax:</span>
                <span className="font-mono text-slate-800">{formatCurrency(purchase.tax || 0, currency)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Discount:</span>
                <span className="font-mono text-slate-800">{formatCurrency(purchase.discount || 0, currency)}</span>
              </div>
              <div className="pt-2 border-t-2 border-slate-200 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900">Grand Total:</span>
                <span className="text-base font-extrabold font-mono text-slate-900">{formatCurrency(purchase.totalAmount || purchase.totalCost, currency)}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-slate-500 font-medium">Amount Paid:</span>
                <span className="font-mono font-semibold text-emerald-600">{formatCurrency(purchase.paidAmount || purchase.amountPaid || 0, currency)}</span>
              </div>
              <div className="flex justify-between items-center text-xs bg-red-50/70 p-2 rounded-lg border border-red-100 mt-1">
                <span className="font-bold text-red-700">Due Amount:</span>
                <span className="font-mono font-bold text-red-700 text-sm">
                  {formatCurrency(purchase.dueAmount || ((purchase.totalAmount || purchase.totalCost) - (purchase.paidAmount || purchase.amountPaid || 0)), currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* END: FinancialTotalsAndLiveLedger */}
      </div>
      
      {/* BEGIN: SheetFooter */}
      <footer className="mt-12 pt-6 border-t border-slate-200 select-none" data-purpose="sheet-bottom-authenticity">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Terms and Barcode Identification */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="inline-flex flex-col items-center sm:items-start -ml-2">
              <Barcode value={purchase.purchaseNumber || `INV-${purchase.id?.toString().padStart(5, '0')}`} width={1.2} height={30} displayValue={true} fontSize={10} background="transparent" margin={0} />
            </div>
            <p className="text-[10px] text-slate-600 mt-2">Computer generated invoice. No physical signature required.</p>
          </div>
          
          {/* Authorized Stamp / Signature Area */}
          <div className="flex items-center gap-6 mt-4 sm:mt-0">
            <div className="text-right hidden sm:block">
              <div className="h-10 border-b border-dashed border-slate-300 w-36 mb-1"></div>
              <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Receiver's Signature</span>
            </div>
            <div className="text-right">
              <div className="h-10 border-b border-dashed border-slate-300 w-36 mb-1"></div>
              <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Store Verification</span>
            </div>
          </div>
        </div>
      </footer>
      {/* END: SheetFooter */}
    </article>
  );
});

SupplierA4Invoice.displayName = 'SupplierA4Invoice';
export default SupplierA4Invoice;
