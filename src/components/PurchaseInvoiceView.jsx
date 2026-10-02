import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Package, Tag, Calendar, Plus, Trash2, 
  Store, Wallet, AlertCircle, Check, Info, ArrowLeft, Search, Scan, X 
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency, removeLeadingZeros } from '@/lib/utils';
import CustomSelect from '@/components/CustomSelect';

export default function PurchaseInvoiceView({ 
  currency = 'Rs', 
  onClose, 
  onSuccess 
}) {
  const [formError, setFormError] = useState(null);
  
  // Category list
  const [categoriesList, setCategoriesList] = useState([]);
  const [formCategoryFilter, setFormCategoryFilter] = useState('All');
  useEffect(() => { 
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => setCategoriesList(d.data || d || [])); 
  }, []);

  // Products search & selection
  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useDebounce(productSearch, 300);
  const [productResults, setProductResults] = useState([]);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const productDropdownRef = useRef(null);

  // Supplier search & selection
  const [supplierSearch, setSupplierSearch] = useState('');
  const debouncedSupplierSearch = useDebounce(supplierSearch, 300);
  const [supplierResults, setSupplierResults] = useState([]);
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', email: '', address: '', openingBalance: '' });
  const supplierDropdownRef = useRef(null);

  // Transaction state
  const [transaction, setTransaction] = useState({
    supplierId: 0,
    amountPaid: '',
    discount: '',
    tax: '',
    paymentMethod: 'Cash',
    date: new Date().toISOString().slice(0, 10),
    note: '',
    storageNotes: '',
  });

  // Current item form
  const [itemForm, setItemForm] = useState({
    productId: 0,
    quantity: '1',
    costPrice: '',
    batchNumber: '',
    expiryDate: '',
  });

  // Cart
  const [cart, setCart] = useState([]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
        setIsProductDropdownOpen(false);
      }
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(e.target)) {
        setIsSupplierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch product search results
  useEffect(() => {
    const fetchProds = async () => {
      let url = '/api/products?';
      if (debouncedProductSearch) url += 'search=' + encodeURIComponent(debouncedProductSearch) + '&';
      if (formCategoryFilter !== 'All') url += 'category=' + encodeURIComponent(formCategoryFilter);
      try {
        const res = await fetch(url);
        const data = await res.json();
        setProductResults(data.data || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchProds();
  }, [debouncedProductSearch, formCategoryFilter]);

  // Fetch supplier search results
  useEffect(() => {
    const fetchSupps = async () => {
      let url = '/api/suppliers?';
      if (debouncedSupplierSearch) url += 'search=' + encodeURIComponent(debouncedSupplierSearch);
      try {
        const res = await fetch(url);
        const data = await res.json();
        setSupplierResults(data.data || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchSupps();
  }, [debouncedSupplierSearch]);

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setItemForm(prev => ({
      ...prev,
      productId: product.id,
      costPrice: (product.costPrice !== undefined && product.costPrice !== null && Number(product.costPrice) > 0)
        ? String(product.costPrice)
        : prev.costPrice
    }));
    setProductSearch(product.name);
    setIsProductDropdownOpen(false);
  };

  const handleSelectSupplier = (supplier) => {
    setTransaction(prev => ({ ...prev, supplierId: supplier.id }));
    setSelectedSupplier(supplier);
    setSupplierSearch(supplier.name);
    setIsSupplierDropdownOpen(false);
  };

  const handleSaveNewSupplier = async () => {
    if (!newSupplier.name.trim() || !newSupplier.phone.trim()) {
      setFormError('Supplier Name and Phone are required.');
      return;
    }
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupplier.name.trim(),
          phone: newSupplier.phone.trim(),
          email: newSupplier.email.trim(),
          address: newSupplier.address.trim(),
          openingBalance: parseFloat(newSupplier.openingBalance) || 0
        })
      });
      if (!res.ok) throw new Error('Failed to create supplier');
      const data = await res.json();
      const created = data.data || data;
      setTransaction(prev => ({ ...prev, supplierId: created.id }));
      setSelectedSupplier(created);
      setSupplierSearch(created.name);
      setShowAddSupplierModal(false);
      setNewSupplier({ name: '', phone: '', email: '', address: '', openingBalance: '' });
      setFormError(null);
    } catch (err) {
      console.error(err);
      setFormError('Failed to create new supplier.');
    }
  };

  const addItemToCart = () => {
    setFormError(null);
    const qty = parseFloat(itemForm.quantity) || 0;
    const cost = parseFloat(itemForm.costPrice) || 0;

    if (!selectedProduct) {
      setFormError('Please select a product to add');
      return;
    }
    if (qty <= 0) {
      setFormError('Quantity must be greater than 0');
      return;
    }
    if (cost < 0) {
      setFormError('Purchase price cannot be negative');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      product: selectedProduct,
      productId: selectedProduct.id,
      quantity: qty,
      costPrice: cost,
      totalCost: qty * cost,
      batchNumber: itemForm.batchNumber,
      expiryDate: itemForm.expiryDate,
    };

    setCart(prev => [...prev, newItem]);

    setItemForm({
      productId: 0,
      quantity: '1',
      costPrice: '',
      batchNumber: '',
      expiryDate: '',
    });
    setSelectedProduct(null);
    setProductSearch('');
  };

  const removeCartItem = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Totals
  const subtotal = cart.reduce((sum, item) => sum + item.totalCost, 0);
  const discount = parseFloat(transaction.discount) || 0;
  const tax = parseFloat(transaction.tax) || 0;
  const grandTotal = Math.max(0, subtotal - discount + tax);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        savePurchase(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, transaction, selectedSupplier]);

  const savePurchase = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setFormError(null);

    if (cart.length === 0) {
      setFormError('Purchase list is empty. Please add at least one product.');
      return;
    }

    const amtPaid = parseFloat(transaction.amountPaid) || 0;

    if (!selectedSupplier && amtPaid !== grandTotal) {
      setFormError('Amount paid must equal the grand total when no supplier is selected.');
      return;
    }

    const payload = {
      supplierName: selectedSupplier?.name || 'Walk-in Supplier',
      supplierId: selectedSupplier?.id || 0,
      date: new Date(transaction.date).toISOString(),
      items: cart.map(item => ({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        costPrice: item.costPrice,
        totalCost: item.totalCost,
        expiryDate: item.expiryDate || null,
        batchNumber: item.batchNumber
      })),
      subtotal,
      discount,
      tax,
      totalAmount: grandTotal,
      amountPaid: amtPaid,
      paymentMethod: transaction.paymentMethod,
      note: transaction.note + (transaction.storageNotes ? `\nStorage: ${transaction.storageNotes}` : '')
    };

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save purchase');
      onSuccess('add');
    } catch (err) {
      console.error(err);
      setFormError('Failed to record purchase invoice.');
    }
  };

  const handleResetForm = () => {
    setCart([]);
    setSelectedSupplier(null);
    setSupplierSearch('');
    setSelectedProduct(null);
    setProductSearch('');
    setTransaction({
      supplierId: 0,
      amountPaid: '',
      discount: '',
      tax: '',
      paymentMethod: 'Cash',
      date: new Date().toISOString().slice(0, 10),
      note: '',
      storageNotes: '',
    });
    setFormError(null);
  };

  return (
    <div className="w-full text-slate-800">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Record Purchase Invoice</h1>
            <p className="text-xs text-slate-500 font-normal">
              Add multiple products to record a verified vendor purchase stock update.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleResetForm}
          className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
        >
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          New Invoice
        </button>
      </div>

      {formError && (
        <div className="mb-3 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Grid: Left Column & Right Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          
          {/* Card 1: Product & Invoice Details */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold text-slate-800 tracking-wide">
                Product & Invoice Details
              </h2>
            </div>

            {/* Row 1: Product Search, Category, Quantity */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
              {/* Product */}
              <div className="md:col-span-6 space-y-1 relative" ref={productDropdownRef}>
                <label className="text-[11px] font-bold text-slate-700 tracking-wider">
                  Product <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search or select product..."
                    value={productSearch}
                    onFocus={() => setIsProductDropdownOpen(true)}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setIsProductDropdownOpen(true);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2 text-xs text-slate-900 font-medium placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                  />
                  <Scan className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>

                {isProductDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl bg-white shadow-xl border border-slate-100 max-h-56 overflow-y-auto py-1">
                    {productResults.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-400 text-center">No products found</div>
                    ) : (
                      productResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProduct(p)}
                          className="w-full text-left px-3.5 py-2 text-xs hover:bg-blue-50/60 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <div className="font-semibold text-slate-800">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{p.barcode || 'No barcode'}</div>
                          </div>
                          <span className="text-blue-600 font-bold">{currency} {Number(p.costPrice || 0).toFixed(2)}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Category */}
              <div className="md:col-span-4 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wider">
                  Category <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  value={formCategoryFilter}
                  onChange={(val) => setFormCategoryFilter(val)}
                  options={[
                    { label: 'All Categories', value: 'All' },
                    ...categoriesList.map(c => ({ label: c.name, value: c.name }))
                  ]}
                  placeholder="Select category"
                />
              </div>

              {/* Quantity */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wider">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-center"
                />
              </div>
            </div>

            {/* Row 2: Purchase Price / Unit, Batch Number, Expiry Date */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {/* Purchase Price */}
              <div className="md:col-span-4 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wider">
                  Purchase Price / Unit <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-medium text-xs">
                    {currency}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm(prev => ({ ...prev, costPrice: removeLeadingZeros(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs font-bold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none"
                  />
                </div>
              </div>

              {/* Batch Number */}
              <div className="md:col-span-4 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wider">
                  Batch Number <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. B-001"
                  value={itemForm.batchNumber}
                  onChange={(e) => setItemForm(prev => ({ ...prev, batchNumber: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none"
                />
              </div>

              {/* Expiry Date */}
              <div className="md:col-span-4 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wider">
                  Expiry Date <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={itemForm.expiryDate}
                  onChange={(e) => setItemForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none"
                />
              </div>
            </div>

            {/* Add to Purchase List Button */}
            <div className="flex justify-end mt-3 pt-2">
              <button
                type="button"
                onClick={addItemToCart}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                Add to Purchase List
              </button>
            </div>
          </div>

          {/* Card 2: Purchase List Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-slate-800 tracking-wide">
                  Purchase List
                </h2>
                <span className="rounded-full bg-blue-50 text-blue-600 border border-blue-200/60 px-2.5 py-0.5 text-[10px] font-bold">
                  {cart.length} items
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Items added will reflect in inventory
              </span>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">PRODUCT</th>
                    <th className="py-2.5 px-3 text-center">QTY</th>
                    <th className="py-2.5 px-3 text-right">PRICE (UNIT)</th>
                    <th className="py-2.5 px-3 text-right">TOTAL</th>
                    <th className="py-2.5 px-3 text-center w-16">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-2">
                            <Package className="w-6 h-6" />
                          </div>
                          <p className="text-xs font-bold text-slate-700">No products added yet.</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Search and add products to start the purchase list.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{item.product.name}</div>
                          {item.batchNumber && (
                            <div className="text-[10px] text-slate-400">Batch: {item.batchNumber}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-600">{currency} {Number(item.costPrice).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-600">{currency} {Number(item.totalCost).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.id)}
                            className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          {/* Card 1: Supplier Details */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-slate-800 tracking-wide">
                  Supplier Details
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(true)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                + Register New Supplier
              </button>
            </div>

            {/* Supplier Search */}
            <div className="space-y-1 relative" ref={supplierDropdownRef}>
              <label className="text-[11px] font-bold text-slate-700 tracking-wider">
                Supplier <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Store className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search or enter supplier name..."
                  value={supplierSearch}
                  onFocus={() => setIsSupplierDropdownOpen(true)}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setIsSupplierDropdownOpen(true);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 font-medium placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none"
                />
              </div>

              {isSupplierDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-xl bg-white shadow-xl border border-slate-100 max-h-48 overflow-y-auto py-1">
                  {supplierResults.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-400 text-center">No suppliers found</div>
                  ) : (
                    supplierResults.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectSupplier(s)}
                        className="w-full text-left px-3.5 py-2 text-xs hover:bg-emerald-50/60 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0"
                      >
                        <div>
                          <div className="font-semibold text-slate-800">{s.name}</div>
                          <div className="text-[10px] text-slate-400">{s.phone}</div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">Bal: {currency} {Number(s.openingBalance || 0).toFixed(2)}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Date & Note */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wider">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={transaction.date}
                  onChange={(e) => setTransaction(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wider">
                  Note <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Add remarks or purchase order ref..."
                  value={transaction.note}
                  onChange={(e) => setTransaction(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Payment Summary */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-slate-800 tracking-wide">
                  Payment Summary
                </h2>
              </div>
              <span className="rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60 px-2.5 py-0.5 text-[10px] font-bold">
                Auto-Calculated
              </span>
            </div>

            {/* Subtotal */}
            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-bold text-slate-700">Subtotal</span>
              <span className="text-sm font-bold text-slate-900">{currency} {subtotal.toFixed(2)}</span>
            </div>

            {/* Discount & Tax */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wider">Discount ({currency})</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={transaction.discount}
                  onChange={(e) => setTransaction(prev => ({ ...prev, discount: removeLeadingZeros(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 tracking-wider">Tax / GST ({currency})</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={transaction.tax}
                  onChange={(e) => setTransaction(prev => ({ ...prev, tax: removeLeadingZeros(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* GRAND TOTAL Banner */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-indigo-950 text-white rounded-xl p-3 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/60 flex items-center justify-center text-white shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-200">GRAND TOTAL</div>
                  <div className="text-[9px] text-slate-400">Total payable for items</div>
                </div>
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {currency} {grandTotal.toFixed(2)}
              </div>
            </div>

            {/* Amount Paid Now */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 tracking-wider">
                Amount Paid Now ({currency})
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={transaction.amountPaid}
                onChange={(e) => setTransaction(prev => ({ ...prev, amountPaid: removeLeadingZeros(e.target.value) }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Card 3: Description & Storage Notes */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold text-slate-800 tracking-wide">
                Description & Storage Notes
              </h2>
            </div>
            <textarea
              rows={2}
              maxLength={500}
              placeholder="Add storage guidelines, manufacturer details (e.g. GSK Pakistan), storage conditions (store below 25°C), or prescription requirements..."
              value={transaction.storageNotes}
              onChange={(e) => setTransaction(prev => ({ ...prev, storageNotes: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none resize-none font-sans"
            />
            <div className="text-[10px] text-slate-400 text-right font-medium">
              {transaction.storageNotes.length}/500
            </div>
          </div>
        </div>

        {/* Bottom Static Action Bar */}
        <div className="col-span-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 mt-1 border-t border-slate-200/80">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Info className="w-4 h-4 text-slate-400" />
            <span>
              Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-semibold text-[10px]">Esc</kbd> to cancel, <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-semibold text-[10px]">Ctrl+S</kbd> to save
            </span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-7 py-2.5 text-xs transition-colors shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={savePurchase}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-2.5 text-xs shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              Record Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Register New Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">Register New Supplier</h3>
              <button 
                type="button" 
                onClick={() => setShowAddSupplierModal(false)} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Name *</label>
                <input
                  type="text"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 outline-none"
                  placeholder="e.g. Medico Pharma"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 outline-none"
                  placeholder="0300-1234567"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newSupplier.email}
                  onChange={(e) => setNewSupplier(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 outline-none"
                  placeholder="supplier@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 outline-none"
                  placeholder="Market Street, Lahore"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance ({currency})</label>
                <input
                  type="number"
                  value={newSupplier.openingBalance}
                  onChange={(e) => setNewSupplier(prev => ({ ...prev, openingBalance: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setShowAddSupplierModal(false)} 
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSaveNewSupplier}
                className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                Register Supplier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
