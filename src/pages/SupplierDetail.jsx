import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Printer, Phone, ArrowLeft } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import PageHeader from '@/components/PageHeader';
import { initDB, getDB } from '@/lib/db';
import { clearPaginationCache } from '@/hooks/useDexiePagination';
import { formatCurrency, formatDate, removeLeadingZeros } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { useBusiness } from '@/contexts/BusinessContext';

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const supplierId = Number(id);
  const { businessColor } = useBusiness();
  const [supplier, setSupplier] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [balance, setBalance] = useState({ totalCharged: 0, totalPaid: 0, balance: 0 });
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ledger_${supplier?.name || 'supplier'}`,
  });

  useEffect(() => {
    loadSupplierData();
  }, [supplierId]);

  const loadSupplierData = async () => {
    await initDB();
    const currentDB = getDB();

    const supplierData = await currentDB.suppliers.get(supplierId);
    if (!supplierData) return;

    const ledgerData = await currentDB.supplierLedger
      .where('supplierId').equals(supplierId)
      .sortBy('date');

    setSupplier(supplierData);
    setLedger(ledgerData);

    const totalCharged = ledgerData
      .filter(e => e.type === 'charge' || e.type === 'purchase')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalPaid = ledgerData
      .filter(e => e.type === 'payment' || e.type === 'payment_reversal')
      .reduce((sum, e) => sum + e.amount, 0);

    setBalance({
      totalCharged,
      totalPaid,
      balance: totalCharged - totalPaid
    });
  };

  if (!supplier) {
    return (
      <div className="space-y-6">
        <PageHeader title="Supplier Ledger" description="Account details" />
        <div className="text-center py-8 text-slate-500">supplier not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="👤 Supplier Ledger" 
        description={`Account details for ${supplier.name}`}
        action={
          <button
            onClick={() => navigate('/suppliers')}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to suppliers
          </button>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-sm text-slate-500">Name</p>
            <p className="font-semibold text-slate-900">{supplier.name}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Phone</p>
            <p className="font-semibold text-slate-900">{supplier.phone}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Email</p>
            <p className="font-semibold text-slate-900">{supplier.email || '-'}</p>
          </div>
          {supplier.address && (
            <div>
              <p className="text-sm text-slate-500">Address</p>
              <p className="font-semibold text-slate-900">{supplier.address}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {supplier.phone && (
            <a
              href={`tel:${supplier.phone}`}
              className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700"
            >
              <Phone className="h-4 w-4" />
              Call
            </a>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-900">💰 Account Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-slate-500">Total Purchased</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(balance.totalCharged, currency)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-500">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(balance.totalPaid, currency)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-500">Balance Left</p>
            <p className={`text-2xl font-bold ${balance.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(balance.balance, currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-900">📋 Transaction History</h3>

        <div className="overflow-x-auto overflow-y-auto max-h-[58vh] rounded-xl border border-slate-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-2 text-slate-900">Date</th>
                <th className="text-left py-2 text-slate-900">Description</th>
                <th className="text-right py-2 text-slate-900">DR</th>
                <th className="text-right py-2 text-slate-900">CR</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="py-2 text-slate-900">{formatDate(entry.date)}</td>
                  <td className="py-2 text-slate-900">{entry.description}</td>
                  <td className="text-right py-2 text-slate-900">
                    {entry.type !== 'payment' ? formatCurrency(entry.amount, currency) : ''}
                  </td>
                  <td className="text-right py-2 text-slate-900">
                    {entry.type === 'payment' ? formatCurrency(entry.amount, currency) : ''}
                  </td>
                </tr>
              ))}
              <tr className="bg-yellow-50 font-bold">
                <td colSpan={2} className="py-3 text-center text-slate-900">BALANCE REMAINING</td>
                <td colSpan={2} className="text-right py-3 text-slate-900">
                  {formatCurrency(balance.balance, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <button
          onClick={() => setChargeModalOpen(true)}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Charge
        </button>
        <button
          onClick={() => setPaymentModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Record Payment
        </button>
        <button
          onClick={handlePrint}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          Print Ledger
        </button>
      </div>

      {chargeModalOpen && (
        <ChargeModal
          supplierId={supplierId}
          onClose={() => setChargeModalOpen(false)}
          onSave={() => {
            setChargeModalOpen(false);
            clearPaginationCache('suppliers');
            loadSupplierData();
          }}
        />
      )}

      {paymentModalOpen && (
        <PaymentModal
          supplierId={supplierId}
          onClose={() => setPaymentModalOpen(false)}
          onSave={() => {
            setPaymentModalOpen(false);
            clearPaginationCache('suppliers');
            loadSupplierData();
          }}
        />
      )}

      {/* Hidden Printable Content */}
      <div ref={printRef} className="print-source p-8">
        <div className="text-center border-b-2 border-black pb-4 mb-4">
          <p className="text-2xl font-bold">{settings?.shopName || 'Shop ERP'}</p>
          <p className="text-lg">supplier Account Statement</p>
          <p className="text-sm text-slate-600">Date: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="mb-6 p-4 bg-slate-100">
          <div className="flex justify-between mb-2">
            <span><b>supplier Name:</b> {supplier?.name}</span>
            <span><b>Phone:</b> {supplier?.phone}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span><b>Email:</b> {supplier?.email || 'N/A'}</span>
            {supplier?.address && <span><b>Address:</b> {supplier.address}</span>}
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-black text-white">
              <th className="border p-2 text-left">Date</th>
              <th className="border p-2 text-left">Description</th>
              <th className="border p-2 text-right">Debit ({currency})</th>
              <th className="border p-2 text-right">Credit ({currency})</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((entry) => (
              <tr key={entry.id} className="border-b">
                <td className="border p-2">{formatDate(entry.date)}</td>
                <td className="border p-2">{entry.description}</td>
                <td className="border p-2 text-right">
                  {entry.type !== 'payment' ? entry.amount.toFixed(2) : ''}
                </td>
                <td className="border p-2 text-right">
                  {entry.type === 'payment' ? entry.amount.toFixed(2) : ''}
                </td>
              </tr>
            ))}
            <tr className="bg-yellow-100 font-bold text-lg">
              <td colSpan={2} className="border p-2">BALANCE REMAINING</td>
              <td colSpan={2} className="border p-2 text-right">{currency} {balance.balance.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 text-center text-xs text-slate-600">
          <p>Total Purchased: {currency} {balance.totalCharged.toFixed(2)} | Total Paid: {currency} {balance.totalPaid.toFixed(2)} | Balance: {currency} {balance.balance.toFixed(2)}</p>
          <p className="mt-2">Thank you!</p>
        </div>
      </div>
    </div>
  );
}

function ChargeModal({ supplierId, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const settings = useSettings();
  const { businessColor } = useBusiness();
  const currency = settings?.currency ?? 'Rs';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentDB = getDB();
    await currentDB.supplierLedger.add({
      supplierId,
      type: 'charge',
      amount: Number(amount),
      description: description || 'Purchase',
      date: new Date().toISOString()
    });
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add Charge</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Amount ({currency}) *</label>
            <input
              type="text"
              inputMode="decimal"
              min="1"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(removeLeadingZeros(e.target.value))}
              onFocus={e => e.target.select()}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              placeholder=""
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              placeholder="Purchase description"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-200 text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Add Charge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentModal({ supplierId, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const settings = useSettings();
  const { businessColor } = useBusiness();
  const currency = settings?.currency ?? 'Rs';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentDB = getDB();
    await currentDB.supplierLedger.add({
      supplierId,
      type: 'payment',
      amount: Number(amount),
      description: note || 'Payment received',
      date: new Date().toISOString()
    });
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Record Payment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Amount ({currency}) *</label>
            <input
              type="text"
              inputMode="decimal"
              min="1"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(removeLeadingZeros(e.target.value))}
              onFocus={e => e.target.select()}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              placeholder=""
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 block w-full border rounded-md px-3 py-2"
              placeholder="Payment note"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-200 text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


