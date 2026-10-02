import React, { forwardRef, useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import Barcode from 'react-barcode';

const CustomerA4Invoice = forwardRef(({ sale, customer, amountPaid, settings, currency, businessColor }, ref) => {
  const [balance, setBalance] = useState({ previousBalance: 0, newInvoice: 0, paymentReceived: 0, newBalance: 0 });

  useEffect(() => {
    const fetchBalance = async () => {
      if (!customer || !sale) return;
      try {
        const res = await fetch('/api/customers/' + customer.id);
        const data = await res.json();
        
        const newBalance = data.balance || 0;
        const newInvoice = sale.totalAmount || 0;
        const paymentReceived = amountPaid || 0;
        
        // Since the backend already processed the sale, the current balance IS the new balance
        const previousBalance = newBalance - newInvoice + paymentReceived;
        
        setBalance({ previousBalance, newInvoice, paymentReceived, newBalance });
      } catch (e) {}
    };
    fetchBalance();
  }, [customer, sale, amountPaid]);

  if (!sale) return null;

  return (
    <div ref={ref} className="bg-white p-8 print:block" style={{ width: '210mm', minHeight: '297mm', color: '#000', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 pb-6 mb-6" style={{ borderColor: businessColor || '#000' }}>
        <div>
          <h1 className="text-4xl font-black uppercase tracking-widest mb-1" style={{ color: businessColor || '#000' }}>INVOICE</h1>
          <p className="text-sm font-semibold text-slate-500">Invoice INV-{sale.id?.toString().padStart(5, '0')}</p>
          <p className="text-sm font-semibold text-slate-500">Date: {formatDate(sale.date)}</p>
        </div>
        <div className="text-right flex flex-col items-end">
          {settings?.logo && (
            <img src={settings.logo} alt="Logo" className="h-16 w-auto mb-2 object-contain" />
          )}
          <h2 className="text-2xl font-bold">{settings?.shopName || 'Shop ERP'}</h2>
          <p className="text-sm text-slate-600 max-w-[200px] ml-auto">{settings?.address || '123 Business Road'}</p>
          <p className="text-sm text-slate-600">{settings?.phone || 'Phone: (555) 123-4567'}</p>
          {settings?.shopEmail && <p className="text-sm text-slate-600">{settings.shopEmail}</p>}
        </div>
      </div>

      {/* Bill To */}
      {customer && (
        <div className="mb-8">
          <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-2">Billed To</h3>
          <p className="text-lg font-bold text-slate-900">{customer.name}</p>
          <p className="text-sm text-slate-600">{customer.phone}</p>
          {customer.email && <p className="text-sm text-slate-600">{customer.email}</p>}
          {customer.address && <p className="text-sm text-slate-600">{customer.address}</p>}
        </div>
      )}

      {/* Table */}
      <table className="w-full mb-8 text-left border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="py-3 px-2 text-sm font-bold uppercase text-slate-500 tracking-wider">Item</th>
            <th className="py-3 px-2 text-sm font-bold uppercase text-slate-500 tracking-wider text-right">Qty</th>
            <th className="py-3 px-2 text-sm font-bold uppercase text-slate-500 tracking-wider text-right">Price</th>
            <th className="py-3 px-2 text-sm font-bold uppercase text-slate-500 tracking-wider text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sale.items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-3 px-2 text-sm font-medium text-slate-900">{item.productName}</td>
              <td className="py-3 px-2 text-sm text-slate-600 text-right">{item.qty}</td>
              <td className="py-3 px-2 text-sm text-slate-600 text-right">{formatCurrency(item.price, currency)}</td>
              <td className="py-3 px-2 text-sm font-semibold text-slate-900 text-right">{formatCurrency(item.subtotal, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(sale.items.reduce((sum, item) => sum + item.subtotal, 0), currency)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between text-sm text-red-500">
              <span>Discount</span>
              <span>-{formatCurrency(sale.discount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-black text-slate-900 border-t-2 border-slate-200 pt-3">
            <span>Grand Total</span>
            <span>{formatCurrency(sale.totalAmount, currency)}</span>
          </div>
        </div>
      </div>

      {/* Balance details for Customer */}
      {customer && (
        <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 w-2/3 ml-auto text-right">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Account Summary</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Previous Balance</span>
              <span className="font-semibold text-slate-900">{formatCurrency(balance.previousBalance, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">New Invoice</span>
              <span className="font-semibold text-slate-900">{formatCurrency(balance.newInvoice, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Payment Received</span>
              <span className="font-semibold text-green-600">{formatCurrency(balance.paymentReceived, currency)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-slate-200 mt-2">
              <span className="text-slate-900 font-bold">Remaining Balance</span>
              <span className={`font-bold ${balance.newBalance > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {formatCurrency(balance.newBalance, currency)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-16 pt-8 border-t-2 border-slate-200 text-center text-sm text-slate-400">
        <p className="mb-6">Thank you for your business.</p>
        <div className="flex justify-center">
          <Barcode value={`INV-${sale.id?.toString().padStart(5, '0')}`} width={1.5} height={40} displayValue={true} fontSize={12} margin={0} />
        </div>
      </div>
    </div>
  );
});

CustomerA4Invoice.displayName = 'CustomerA4Invoice';
export default CustomerA4Invoice;
