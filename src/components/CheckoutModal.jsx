import { useState, useEffect, useRef } from 'react';
import { X, User, CreditCard, Banknote, Wallet, BookOpen, Plus, Search } from 'lucide-react';
import { getDB } from '@/lib/db';
import { formatCurrency, removeLeadingZeros } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { useLiveQuery } from 'dexie-react-hooks';

const PAYMENT_METHODS = [
  { id: 'Cash', label: 'Cash', icon: Banknote },
  { id: 'Card', label: 'Card', icon: CreditCard },
  { id: 'Wallet', label: 'Wallet', icon: Wallet },
  { id: 'Credit', label: 'Credit', icon: BookOpen },
];

export default function CheckoutModal({ open, totalAmount, currency, onClose, onConfirm }) {
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [cashTendered, setCashTendered] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerBalance, setCustomerBalance] = useState(null);
  const [amountPaying, setAmountPaying] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', email: '', address: '', openingBalance: '' });
  const searchRef = useRef(null);

  const debouncedCustomerSearch = useDebounce(customerSearch, 300);

  const customerResults = useLiveQuery(
    async () => {
      if (!debouncedCustomerSearch || debouncedCustomerSearch.length < 1) return [];
      const term = debouncedCustomerSearch.toLowerCase();
      const currentDB = getDB();
      return await currentDB.customers
        .where('name').startsWithIgnoreCase(term)
        .or('phone').startsWithIgnoreCase(term)
        .limit(10)
        .toArray();
    },
    [debouncedCustomerSearch],
    []
  );

  // Load customer balance when selected
  useEffect(() => {
    const loadBalance = async () => {
      if (!selectedCustomer?.id) {
        setCustomerBalance(null);
        return;
      }
      const currentDB = getDB();
      const ledger = await currentDB.customerLedger.where('customerId').equals(selectedCustomer.id).toArray();
      const charged = ledger
        .filter(e => e.type === 'charge' || e.type === 'purchase')
        .reduce((sum, e) => sum + e.amount, 0);
      const paid = ledger
        .filter(e => e.type === 'payment' || e.type === 'payment_reversal')
        .reduce((sum, e) => sum + e.amount, 0);
      setCustomerBalance({ charged, paid, balance: charged - paid });
    };
    loadBalance();
  }, [selectedCustomer?.id]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPaymentMethod('Cash');
      setCashTendered('');
      setSelectedCustomer(null);
      setCustomerSearch('');
      setAmountPaying('');
      setShowAddCustomer(false);
      setNewCustomerForm({ name: '', phone: '', email: '', address: '', openingBalance: '' });
    }
  }, [open]);

  if (!open) return null;

  const changeDue = Math.max(0, (parseFloat(cashTendered) || 0) - totalAmount);

  const quickAmounts = [
    { label: `Exact (${currency} ${totalAmount.toLocaleString()})`, value: totalAmount },
    { label: `${currency} 500`, value: 500 },
    { label: `${currency} 1,000`, value: 1000 },
    { label: `${currency} 5,000`, value: 5000 },
  ];

  const handleAddNewCustomer = async () => {
    if (!newCustomerForm.name.trim()) return;
    const currentDB = getDB();
    const customerId = await currentDB.customers.add({
      name: newCustomerForm.name.trim(),
      phone: newCustomerForm.phone.trim() || '',
      email: newCustomerForm.email.trim() || '',
      address: newCustomerForm.address.trim() || '',
      createdAt: new Date().toISOString()
    });

    const ob = parseFloat(newCustomerForm.openingBalance);
    if (!isNaN(ob) && ob > 0) {
      await currentDB.customerLedger.add({
        customerId,
        type: 'charge',
        amount: ob,
        description: 'Opening balance',
        date: new Date().toISOString()
      });
    }

    const newCust = { id: customerId, name: newCustomerForm.name.trim(), phone: newCustomerForm.phone.trim() };
    setSelectedCustomer(newCust);
    setShowAddCustomer(false);
    setNewCustomerForm({ name: '', phone: '', email: '', address: '', openingBalance: '' });
    setCustomerSearch('');
  };

  const handleConfirm = () => {
    onConfirm({
      customer: selectedCustomer,
      paymentMethod: selectedCustomer ? 'customer_account' : paymentMethod,
      cashTendered: parseFloat(cashTendered) || 0,
      amountPaying: parseFloat(amountPaying) || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Checkout</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Customer */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Customer (Optional)</p>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedCustomer.name}</p>
                    <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>
                    {customerBalance && (
                      <p className={`text-xs font-medium mt-1 ${customerBalance.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Balance: {formatCurrency(customerBalance.balance, currency)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); setAmountPaying(''); setCustomerBalance(null); }}
                    className="text-red-400 hover:text-red-600 text-xl leading-none ml-3"
                  >×</button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                      placeholder="Search customer name or phone..."
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white transition-colors"
                    />
                  </div>
                  {showCustomerDropdown && customerResults && customerResults.length > 0 && (
                    <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-40 overflow-y-auto">
                      {customerResults.map(c => (
                        <div
                          key={c.id}
                          onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerDropdown(false); }}
                          className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                        >
                          <p className="text-sm font-medium text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.phone}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!selectedCustomer && !showAddCustomer && (
                <button
                  onClick={() => setShowAddCustomer(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add New Customer
                </button>
              )}

              {showAddCustomer && (
                <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Customer Name *"
                        value={newCustomerForm.name}
                        onChange={e => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={newCustomerForm.phone}
                      onChange={e => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <input
                      type="email"
                      placeholder="Email (Optional)"
                      value={newCustomerForm.email}
                      onChange={e => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Address (Optional)"
                        value={newCustomerForm.address}
                        onChange={e => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Opening Balance (Optional, e.g. amount they owe)"
                        value={newCustomerForm.openingBalance}
                        onChange={e => setNewCustomerForm({ ...newCustomerForm, openingBalance: removeLeadingZeros(e.target.value) })}
                        onFocus={e => e.target.select()}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddCustomer(false)} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                    <button onClick={handleAddNewCustomer} className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">Save</button>
                  </div>
                </div>
              )}

              {/* Amount Paying (for Credit/Customer) */}
              {selectedCustomer && (
                <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Customer Account</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Previous Balance:</span>
                      <span className={`font-medium ${(customerBalance?.balance ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(customerBalance?.balance ?? 0, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">New Purchase:</span>
                      <span className="font-medium text-red-600">+{formatCurrency(totalAmount, currency)}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1 flex justify-between font-bold">
                      <span>Total After Sale:</span>
                      <span className="text-red-600">{formatCurrency((customerBalance?.balance ?? 0) + totalAmount, currency)}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs font-medium text-slate-600">Amount Paying Now ({currency})</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amountPaying}
                      onChange={e => setAmountPaying(removeLeadingZeros(e.target.value))}
                      onFocus={e => e.target.select()}
                      placeholder="Enter amount"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right: Payment */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Payment Method</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {PAYMENT_METHODS.map(method => {
                  const Icon = method.icon;
                  const isActive = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {method.label}
                    </button>
                  );
                })}
              </div>

              {/* Cash Tendered */}
              {paymentMethod === 'Cash' && !selectedCustomer && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cash Tendered</p>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashTendered}
                    onChange={e => setCashTendered(removeLeadingZeros(e.target.value))}
                    onFocus={e => e.target.select()}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-semibold text-slate-900 outline-none focus:border-blue-500 transition-colors"
                    placeholder="0"
                  />
                  <div className="flex flex-wrap gap-2">
                    {quickAmounts.map((qa, i) => (
                      <button
                        key={i}
                        onClick={() => setCashTendered(String(qa.value))}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                          parseFloat(cashTendered) === qa.value
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400'
                        }`}
                      >
                        {qa.label}
                      </button>
                    ))}
                  </div>
                  {parseFloat(cashTendered) > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Change Due:</span>
                      <span className="text-lg font-bold text-green-600">{formatCurrency(changeDue, currency)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-500">Total Due</span>
            <span className="text-3xl font-bold text-slate-900">{formatCurrency(totalAmount, currency)}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-[2] rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              🖨️ Confirm & Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
