import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Printer, Phone, ArrowLeft } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import PageHeader from '@/components/PageHeader';
import GlobalTable from '@/components/GlobalTable';
import GlobalSearch from '@/components/GlobalSearch';
import { useDebounce } from '@/hooks/useDebounce';
import { clearPaginationCache } from '@/hooks/useApiPagination';
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
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
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
    try {
      const [supRes, ledgRes] = await Promise.all([
        fetch('/api/suppliers/' + supplierId),
        fetch('/api/suppliers/' + supplierId + '/ledger')
      ]);
      const supplierData = await supRes.json();
      const ledgerData = await ledgRes.json();

      if (!supplierData || !supplierData.id) return;

      setSupplier(supplierData);
      setLedger(ledgerData);

      const totalCharged = ledgerData.reduce((sum, e) => sum + Number(e.credit || 0), 0);
      const totalPaid = ledgerData.reduce((sum, e) => sum + Number(e.debit || 0), 0);

      setBalance({
        totalCharged,
        totalPaid,
        balance: totalCharged - totalPaid
      });
    } catch(err) {
      console.error(err);
    }
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

        
        <div className="flex justify-between items-center mb-4">
          <GlobalSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search transactions..."
          />
        </div>
        <GlobalTable
          hasMore={false}
          data={ledger.filter(entry => entry.description?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))}
          columns={[
            { header: 'Date', key: 'date', render: (val) => formatDate(val) },
            { header: 'Description', key: 'description' },
            { header: `DR (${currency})`, key: 'debit', render: (val, entry) => Number(entry.debit) !== 0 ? Number(entry.debit).toFixed(2) : '' },
            { header: `CR (${currency})`, key: 'credit', render: (val, entry) => Number(entry.credit) !== 0 ? Number(entry.credit).toFixed(2) : '' },
          ]}
          emptyState={<div className="p-8 text-center text-slate-500">No transactions found</div>}
        />
        <div className="bg-yellow-100 font-bold text-lg p-4 flex justify-between items-center rounded-b-xl border-x border-b border-slate-200 -mt-[1px] relative z-10">
          <div>BALANCE REMAINING</div>
          <div className="text-right pr-4">{currency} {balance.balance.toFixed(2)}</div>
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
                  {Number(entry.credit) > 0 ? Number(entry.credit).toFixed(2) : ''}
                </td>
                <td className="border p-2 text-right">
                  {Number(entry.debit) > 0 ? Number(entry.debit).toFixed(2) : ''}
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
    await fetch('/api/suppliers/' + supplierId + '/ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'charge',
        amount: Number(amount),
        description: description || 'Purchase',
        date: new Date().toISOString()
      })
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
    await fetch('/api/suppliers/' + supplierId + '/ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment',
        amount: Number(amount),
        description: description || 'Payment Given',
        date: new Date().toISOString()
      })
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



