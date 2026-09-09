import { useEffect, useMemo, useState, useCallback, memo, forwardRef, useImperativeHandle, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Printer, X, Search, FileText, BookOpen, Trash2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import PageHeader from '@/components/PageHeader';
import PrintWrapper from '@/components/PrintWrapper';
import SupplierA4Invoice from '@/components/SupplierA4Invoice';
import ConfirmDialog from '@/components/ConfirmDialog';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import { useSettings } from '@/hooks/useSettings';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useBusiness } from '@/contexts/BusinessContext';
import { useDexieOffsetPagination, clearPaginationCache } from '@/hooks/useDexiePagination';
import GlobalTable from '@/components/GlobalTable';
import GlobalSearch from '@/components/GlobalSearch';
import GlobalFilter from '@/components/GlobalFilter';
import GlobalButton from '@/components/GlobalButton';
import RowsDropdown from '@/components/RowsDropdown';
import ColumnVisibilityDropdown from '@/components/ColumnVisibilityDropdown';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency, formatDate, removeLeadingZeros, forceRepaintAfterRender } from '@/lib/utils';
import { initDB, getDB } from '@/lib/db';

const PurchaseFormModal = memo(forwardRef(({ currency, onSuccess }, ref) => {
  const [openForm, setOpenForm] = useState(false);
  const [formError, setFormError] = useState(null);
  
  const [formCategoryFilter, setFormCategoryFilter] = useState('All');
  const categoriesList = useLiveQuery(() => getDB().categories.toArray(), []) || [];

  const [productSearch, setProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [supplierBalance, setSupplierBalance] = useState(0);

  // Global transaction state
  const [transaction, setTransaction] = useState({
    supplierId: 0,
    amountPaid: '',
    date: new Date().toISOString().slice(0, 10),
    note: '',
  });

  // Current item being added
  const [itemForm, setItemForm] = useState({
    productId: 0,
    quantity: '',
    costPrice: '',
    batchNumber: '',
    expiryDate: '',
  });

  const [cart, setCart] = useState([]);

  // Queries
  const selectedSupplier = useLiveQuery(() => transaction.supplierId && openForm ? getDB().suppliers.get(transaction.supplierId) : Promise.resolve(null), [transaction.supplierId, openForm]);
  const selectedProduct = useLiveQuery(() => itemForm.productId && openForm ? getDB().products.get(itemForm.productId) : Promise.resolve(null), [itemForm.productId, openForm]);
  const selectedProductStock = useLiveQuery(() => itemForm.productId && openForm ? getDB().inventory.where('productId').equals(itemForm.productId).first() : Promise.resolve(null), [itemForm.productId, openForm]);

  useEffect(() => {
    if (selectedSupplier) {
      const fetchBalance = async () => {
        const currentDB = getDB();
        const ledgerData = await currentDB.supplierLedger.where('supplierId').equals(selectedSupplier.id).toArray();
        const charged = ledgerData.filter(e => e.type === 'charge' || e.type === 'purchase').reduce((s, e) => s + e.amount, 0);
        const paid = ledgerData.filter(e => e.type === 'payment' || e.type === 'payment_reversal').reduce((s, e) => s + e.amount, 0);
        setSupplierBalance(charged - paid);
      };
      fetchBalance();
    } else {
      setSupplierBalance(0);
    }
  }, [selectedSupplier]);

  useImperativeHandle(ref, () => ({
    openNew: () => {
      setTransaction({
        supplierId: 0,
        amountPaid: '',
        discount: '',
        tax: '',
        paymentMethod: 'Cash',
        date: new Date().toISOString().slice(0, 10),
        note: '',
      });
      setItemForm({
        productId: 0,
        quantity: '',
        costPrice: '',
        batchNumber: '',
        expiryDate: '',
      });
      setCart([]);
      setProductSearch('');
      setSupplierSearch('');
      setFormError(null);
      setOpenForm(true);
    },
    close: () => setOpenForm(false)
  }));

  const debouncedProductSearch = useDebounce(productSearch, 300);
  const debouncedSupplierSearch = useDebounce(supplierSearch, 300);

  const productResults = useLiveQuery(async () => {
    if (!openForm) return [];
    if (!debouncedProductSearch && formCategoryFilter === 'All') return [];
    
    const db = getDB();
    const term = debouncedProductSearch.toLowerCase();
    
    let products = [];
    if (term) {
      products = await db.products.filter(p => {
        const nameMatch = p.name?.toLowerCase().includes(term);
        const barcodeMatch = p.barcode?.toLowerCase().includes(term);
        return nameMatch || barcodeMatch;
      }).toArray();
    } else {
      products = await db.products.toArray();
    }
    
    const categoriesList = await db.categories.toArray();
    const catMap = new Map(categoriesList.map(c => [c.id, c]));

    // Apply category filter
    if (formCategoryFilter !== 'All') {
      products = products.filter(p => {
        let matches = p.category === formCategoryFilter || p.category === Number(formCategoryFilter);
        if (!matches) {
          let currId = p.category;
          let safeCount = 0;
          while (currId && safeCount < 20) {
            const cat = catMap.get(currId) || catMap.get(Number(currId));
            if (!cat) break;
            if (cat.parentId === formCategoryFilter || cat.parentId === Number(formCategoryFilter) || Number(cat.parentId) === Number(formCategoryFilter)) {
              matches = true;
              break;
            }
            currId = cat.parentId;
            safeCount++;
          }
        }
        return matches;
      });
    }

    products = products.slice(0, 20); // Limit to 20 results for performance
    
    const inventoryItems = await db.inventory.where('productId').anyOf(products.map(p => p.id)).toArray();

    return products.map(product => {
      const inv = inventoryItems.find(i => i.productId === product.id);
      
      const chain = [];
      let currId = product.category;
      let safeCount = 0;
      while (currId && safeCount < 20) {
        chain.unshift(currId);
        const cat = catMap.get(currId) || catMap.get(Number(currId));
        if (!cat) break;
        currId = cat.parentId ? Number(cat.parentId) : null;
        safeCount++;
      }
      
      const categoryNames = chain.map(id => catMap.get(id)?.name || catMap.get(Number(id))?.name).filter(Boolean);
      
      return {
        ...product,
        currentStock: inv ? inv.quantity : 0,
        categoryPath: categoryNames.length > 0 ? categoryNames.join(' → ') : (product.category || 'Uncategorized')
      };
    });
  }, [debouncedProductSearch, openForm, formCategoryFilter], []);

  const supplierResults = useLiveQuery(async () => {
    if (!debouncedSupplierSearch || !openForm) return [];
    const db = getDB();
    const term = debouncedSupplierSearch.toLowerCase();
    return await db.suppliers.filter(s => 
      (s.name && s.name.toLowerCase().includes(term)) || 
      (s.phone && s.phone.toLowerCase().includes(term))
    ).limit(10).toArray();
  }, [debouncedSupplierSearch, openForm], []);

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
    if (cost <= 0) {
      setFormError('Purchase price must be greater than 0');
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

    setCart([...cart, newItem]);

    setItemForm({
      productId: 0,
      quantity: '',
      costPrice: '',
      batchNumber: '',
      expiryDate: '',
    });
    setProductSearch('');
  };

  const removeCartItem = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.totalCost, 0);

  const savePurchase = async (event) => {
    event.preventDefault();
    setFormError(null);

    if (cart.length === 0) {
      setFormError('Cart is empty. Please add at least one product.');
      return;
    }

    const amtPaid = parseFloat(transaction.amountPaid) || 0;
    const discount = parseFloat(transaction.discount) || 0;
    const tax = parseFloat(transaction.tax) || 0;
    
    const subtotal = cartTotal;
    const grandTotal = subtotal - discount + tax;

    if (!selectedSupplier && amtPaid !== grandTotal) {
      setFormError('Amount paid must equal the total cost when no supplier is selected.');
      return;
    }

    const currentDB = getDB();
    const purchaseDate = new Date(transaction.date).toISOString();
    
    const lastBatch = await currentDB.productBatches.orderBy('id').last();
    let nextBatchId = lastBatch ? lastBatch.id + 1 : 1;

    const savedItems = [];

    // Loop items to update inventory, batches, and price history
    for (const item of cart) {
      let generatedBatchNumber = item.batchNumber?.trim();
      if (!generatedBatchNumber) {
        generatedBatchNumber = `B-${String(nextBatchId).padStart(4, '0')}`;
        nextBatchId++;
      }

      savedItems.push({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        costPrice: item.costPrice,
        totalCost: item.totalCost,
        expiryDate: item.expiryDate || null,
        batchNumber: generatedBatchNumber,
      });

      // Update price history (used for WAC calculation)
      const allHistory = await currentDB.priceHistory.where('productId').equals(item.productId).toArray();
      const purchaseHistory = allHistory.filter(h => h.type === 'purchase');
      const totalCostAmount = purchaseHistory.reduce((sum, h) => sum + ((h.purchasePrice || 0) * (h.quantity || 1)), 0) + item.totalCost;
      const totalQty = purchaseHistory.reduce((sum, h) => sum + (h.quantity || 1), 0) + item.quantity;
      const wac = totalQty > 0 ? totalCostAmount / totalQty : 0;
      await currentDB.products.update(item.productId, { costPrice: wac });

      await currentDB.priceHistory.add({
        productId: item.productId,
        type: 'purchase',
        purchasePrice: item.costPrice,
        wac: wac,
        date: purchaseDate,
        quantity: item.quantity,
        supplier: selectedSupplier?.name,
      });

      // Update Inventory
      const inventoryItem = await currentDB.inventory.where('productId').equals(item.productId).first();
      if (item.expiryDate) {
        await currentDB.products.update(item.productId, { expiryDate: item.expiryDate });
      }

      if (inventoryItem && inventoryItem.id) {
        await currentDB.inventory.update(inventoryItem.id, {
          quantity: inventoryItem.quantity + item.quantity,
          lastUpdated: new Date().toISOString(),
          expiryDate: item.expiryDate || inventoryItem.expiryDate || null,
        });
      } else {
        await currentDB.inventory.add({
          productId: item.productId,
          quantity: item.quantity,
          lowStockThreshold: 5,
          lastUpdated: new Date().toISOString(),
          expiryDate: item.expiryDate || null,
        });
      }

      // Update Batches
      const allBatches = await currentDB.productBatches.where('productId').equals(item.productId).toArray();
      const existingBatch = allBatches.find(b => b.batchNumber === generatedBatchNumber);

      if (existingBatch && existingBatch.id) {
        await currentDB.productBatches.update(existingBatch.id, {
          quantity: existingBatch.quantity + item.quantity,
          costPrice: item.costPrice,
          expiryDate: item.expiryDate || existingBatch.expiryDate || null
        });
      } else {
        await currentDB.productBatches.add({
          productId: item.productId,
          batchNumber: generatedBatchNumber,
          quantity: item.quantity,
          costPrice: item.costPrice,
          expiryDate: item.expiryDate || null,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Generate a unique Purchase Invoice ID for UI
    const lastPurchase = await currentDB.purchases.orderBy('id').last();
    const purchaseId = lastPurchase ? lastPurchase.id + 1 : 1;
    const purchaseNumber = `PUR-${String(purchaseId).padStart(4, '0')}`;

    const purchase = {
      purchaseNumber,
      supplier: selectedSupplier?.name || 'Walk-in Supplier',
      supplierId: selectedSupplier?.id || 0,
      date: purchaseDate,
      items: savedItems,
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      totalAmount: grandTotal,
      paidAmount: amtPaid,
      dueAmount: grandTotal - amtPaid,
      paymentStatus: amtPaid >= grandTotal ? 'Paid' : amtPaid > 0 ? 'Partial' : 'Unpaid',
      paymentMethod: transaction.paymentMethod,
      note: transaction.note,
    };
    
    // Save ONE record to purchases
    await currentDB.purchases.add(purchase);

    if (selectedSupplier) {
      await currentDB.supplierLedger.add({
        supplierId: selectedSupplier.id,
        type: 'charge',
        amount: grandTotal,
        description: `Purchase Invoice ${purchaseNumber}`,
        date: purchaseDate,
      });

      if (amtPaid > 0) {
        await currentDB.supplierLedger.add({
          supplierId: selectedSupplier.id,
          type: 'payment',
          amount: amtPaid,
          description: `Payment for ${purchaseNumber}`,
          date: purchaseDate,
        });
      }
    }

    clearPaginationCache('inventory');
    setOpenForm(false);
    onSuccess('add');
  };

  if (!openForm) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-6 text-slate-800 font-sans antialiased selection:bg-brand-500 selection:text-white backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200" data-purpose="purchase-invoice-modal">
        {/* BEGIN: ModalHeader */}
        <header className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              {/* Document / Invoice Icon */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Record Purchase Invoice</h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  New Invoice
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Add multiple products to record a verified vendor purchase stock update.</p>
            </div>
          </div>
          {/* Close Button */}
          <button onClick={() => setOpenForm(false)} aria-label="Close Modal" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" type="button">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </button>
        </header>
        {/* END: ModalHeader */}

        {/* BEGIN: ModalContentBody */}
        <div className="p-6 overflow-y-auto max-h-[calc(88vh-130px)] bg-slate-50/60">
          <form id="purchase-form" onSubmit={savePurchase}>
            {formError && (
              <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100 flex items-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {formError}
              </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* BEGIN: LeftColumn (Products & Items List) */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                
                {/* Section: Add Product Form */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm" data-purpose="add-product-card">
                  <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      <h2 className="text-xs font-bold tracking-wider text-slate-700 uppercase">Add Product to Invoice</h2>
                    </div>
                    <span className="text-xs text-slate-400">Step 1 of 2</span>
                  </div>
                  <div className="space-y-4">
                    
                    {/* Filter by Category */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="category-select">
                        Filter by Category
                      </label>
                      <div className="relative flex items-center gap-2 flex-wrap">
                        {(() => {
                          const chain = [];
                          let currId = formCategoryFilter === 'All' ? null : formCategoryFilter;
                          let safeCount = 0;
                          while (currId && safeCount < 20) {
                            chain.unshift(currId);
                            const cat = categoriesList.find(c => c.id === currId || c.id === Number(currId));
                            if (!cat) break;
                            currId = cat.parentId;
                            safeCount++;
                          }
                          
                          const levels = [];
                          let currentParentId = null;
                          let i = 0;
                          
                          while (i <= chain.length && i < 3) {
                            const targetParentId = currentParentId !== null ? Number(currentParentId) : null;
                            const opts = categoriesList.filter(c => {
                              const cParentId = c.parentId ? Number(c.parentId) : null;
                              return cParentId === targetParentId;
                            }).map(c => ({ label: c.name, value: c.id }));
                            
                            if (opts.length === 0) break;
                            
                            const selectedVal = chain[i] || 'All';
                            const levelIndex = i;
                            const loopParentId = currentParentId;
                            
                            levels.push(
                              <div key={`cat-select-${levelIndex}`} className="relative flex-1 min-w-[140px]">
                                <select 
                                  className="w-full bg-slate-50 hover:bg-white text-slate-800 text-sm rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 py-2.5 pl-3 pr-8 transition-colors appearance-none cursor-pointer"
                                  value={selectedVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'All') {
                                      setFormCategoryFilter(levelIndex === 0 ? 'All' : loopParentId);
                                    } else {
                                      setFormCategoryFilter(val);
                                    }
                                  }}
                                >
                                  <option value="All">{levelIndex === 0 ? 'All Categories' : 'All Subcats'}</option>
                                  {opts.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                </div>
                              </div>
                            );
                            
                            if (selectedVal === 'All') break;
                            currentParentId = selectedVal;
                            i++;
                          }
                          return levels;
                        })()}
                      </div>
                    </div>
                    
                    {/* Product Field with Stock Pill */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider" htmlFor="product-name">
                          Product <span className="text-rose-500">*</span>
                        </label>
                        {selectedProduct && (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${selectedProductStock?.quantity > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${selectedProductStock?.quantity > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                            Stock: <span className="font-bold">{selectedProductStock ? selectedProductStock.quantity : 0} {selectedProduct.unit || 'pcs'}</span>
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input 
                          id="product-name"
                          type="text" 
                          className="w-full bg-white text-slate-800 text-sm font-medium rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 py-2.5 pl-3.5 pr-10 shadow-sm transition-all" 
                          placeholder="Search or select product..." 
                          value={isProductDropdownOpen ? productSearch : selectedProduct?.name || ''}
                          onChange={(e) => setProductSearch(e.target.value)}
                          onFocus={() => { setIsProductDropdownOpen(true); setProductSearch(''); }}
                          onBlur={() => setTimeout(() => setIsProductDropdownOpen(false), 200)}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </div>
                        
                        {isProductDropdownOpen && (productSearch || formCategoryFilter !== 'All') && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                            {productResults.map((product) => (
                              <div
                                key={product.id}
                                onClick={() => { setItemForm({ ...itemForm, productId: product.id }); setIsProductDropdownOpen(false); }}
                                className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-slate-900">{product.name}</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Barcode: {product.barcode || 'N/A'}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Stock</p>
                                    <p className={`text-xs font-bold ${product.currentStock > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                      {product.currentStock} {product.unit || 'pcs'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {productResults.length === 0 && (
                              <div className="px-4 py-3 text-sm text-slate-500">No products found</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Grid: Quantity & Purchase Price */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="quantity">
                          Quantity <span className="text-rose-500">*</span>
                        </label>
                        <input 
                          id="quantity"
                          type="text"
                          inputMode="decimal"
                          min="1"
                          step="0.01"
                          className="w-full bg-white text-slate-800 text-sm font-medium rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 py-2.5 px-3.5 shadow-sm transition-all" 
                          placeholder="0" 
                          value={itemForm.quantity}
                          onChange={(event) => setItemForm((current) => ({ ...current, quantity: removeLeadingZeros(event.target.value) }))}
                          onFocus={e => e.target.select()}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="purchase-price">
                          Purchase Price / Unit <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm font-medium">{currency}</div>
                          <input 
                            id="purchase-price"
                            type="text"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            className="w-full bg-white text-slate-800 text-sm font-medium rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 py-2.5 pl-9 pr-3.5 shadow-sm transition-all" 
                            placeholder="0.00" 
                            value={itemForm.costPrice}
                            onChange={(event) => setItemForm((current) => ({ ...current, costPrice: removeLeadingZeros(event.target.value) }))}
                            onFocus={e => e.target.select()}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Grid: Batch Number & Expiry Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5" htmlFor="batch-no">
                          Batch Number <span className="text-slate-400 font-normal lowercase">(optional)</span>
                        </label>
                        <input 
                          id="batch-no"
                          type="text" 
                          className="w-full bg-white text-slate-800 text-sm rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 py-2 px-3.5 shadow-sm transition-all placeholder:text-slate-300" 
                          placeholder="e.g. B-001" 
                          value={itemForm.batchNumber}
                          onChange={(event) => setItemForm((current) => ({ ...current, batchNumber: event.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5" htmlFor="expiry-date">
                          Expiry Date <span className="text-slate-400 font-normal lowercase">(optional)</span>
                        </label>
                        <div className="relative">
                          <input 
                            id="expiry-date"
                            type="date" 
                            className="w-full bg-white text-slate-800 text-sm rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 py-2 px-3.5 shadow-sm transition-all" 
                            value={itemForm.expiryDate}
                            onChange={(event) => setItemForm((current) => ({ ...current, expiryDate: event.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Add to List Action */}
                    <div className="pt-2 flex justify-end">
                      <button 
                        type="button"
                        onClick={addItemToCart}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-sm font-medium shadow-sm transition-all"
                      >
                        <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                        <span>Add to Purchase List</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section: Purchase Items Table */}
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden" data-purpose="purchase-list-card">
                  <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold tracking-wider text-slate-700 uppercase">Purchase List</h2>
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200/60">
                        {cart.length} {cart.length === 1 ? 'Item' : 'Items'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">Items added will reflect in inventory</span>
                  </div>
                  
                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm" data-purpose="items-table">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-4 font-semibold" scope="col">Product</th>
                          <th className="py-3 px-3 font-semibold text-center" scope="col">Qty</th>
                          <th className="py-3 px-3 font-semibold text-right" scope="col">Price</th>
                          <th className="py-3 px-4 font-semibold text-right" scope="col">Total</th>
                          <th className="py-3 px-3 text-center font-semibold" scope="col">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cart.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-slate-400">
                              No products added yet.
                            </td>
                          </tr>
                        ) : (
                          cart.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-900">{item.product.name}</div>
                                {(item.batchNumber || item.expiryDate) && (
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    {item.batchNumber && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">Lot #{item.batchNumber}</span>}
                                    {item.expiryDate && <span>• Exp: {formatDate(item.expiryDate)}</span>}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center font-medium text-slate-700">{item.quantity} {item.product.unit || ''}</td>
                              <td className="py-3 px-3 text-right text-slate-600 font-mono">{formatCurrency(item.costPrice, currency)}</td>
                              <td className="py-3 px-4 text-right font-semibold text-slate-900 font-mono">{formatCurrency(item.totalCost, currency)}</td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button type="button" onClick={() => removeCartItem(item.id)} className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Remove">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              {/* END: LeftColumn */}
              
              {/* BEGIN: RightColumn (Invoice Details & Payment Summary) */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* Section: Invoice Metadata Details */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm" data-purpose="invoice-details-card">
                  <div className="flex items-center gap-2 pb-3.5 mb-4 border-b border-slate-100">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <h2 className="text-xs font-bold tracking-wider text-slate-700 uppercase">Invoice Details</h2>
                  </div>
                  <div className="space-y-4">
                    
                    {/* Supplier */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="supplier-input">
                        Supplier <span className="text-slate-400 font-normal lowercase">(optional)</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </div>
                        <input 
                          id="supplier-input"
                          type="text" 
                          className="w-full bg-white text-slate-800 text-sm font-medium rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 py-2 pl-9 pr-3.5 shadow-sm transition-all" 
                          placeholder="Enter supplier name" 
                          value={isSupplierDropdownOpen ? supplierSearch : selectedSupplier?.name || ''}
                          onChange={(e) => setSupplierSearch(e.target.value)}
                          onFocus={() => { setIsSupplierDropdownOpen(true); setSupplierSearch(''); }}
                          onBlur={() => setTimeout(() => setIsSupplierDropdownOpen(false), 200)}
                        />
                        {isSupplierDropdownOpen && supplierSearch && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                            {supplierResults.map((supplier) => (
                              <div
                                key={supplier.id}
                                onClick={() => { setTransaction({ ...transaction, supplierId: supplier.id }); setIsSupplierDropdownOpen(false); }}
                                className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                              >
                                <p className="font-medium text-slate-900">
                                  {supplier.name}
                                  {supplier.phone && <span className="ml-2 text-xs text-slate-500 font-normal">({supplier.phone})</span>}
                                </p>
                              </div>
                            ))}
                            {supplierResults.length === 0 && (
                              <div className="px-4 py-3 text-sm text-slate-500">No suppliers found</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Date Picker */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="invoice-date">
                        Date <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input 
                          id="invoice-date"
                          type="date" 
                          className="w-full bg-white text-slate-800 text-sm rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 py-2 px-3.5 shadow-sm transition-all" 
                          value={transaction.date}
                          onChange={(event) => setTransaction((current) => ({ ...current, date: event.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    
                    {/* Note */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="invoice-note">
                        Note <span className="text-slate-400 font-normal lowercase">(optional)</span>
                      </label>
                      <textarea 
                        id="invoice-note"
                        className="w-full bg-white text-slate-800 text-sm rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 p-2.5 shadow-sm transition-all placeholder:text-slate-300 resize-none" 
                        placeholder="Add remarks or purchase order ref..." 
                        rows="2"
                        value={transaction.note}
                        onChange={(event) => setTransaction((current) => ({ ...current, note: event.target.value }))}
                      ></textarea>
                    </div>
                  </div>
                </div>

                {/* Section: Payment Summary Card */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm flex flex-col" data-purpose="payment-summary-card">
                  <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <h2 className="text-xs font-bold tracking-wider text-slate-700 uppercase">Payment Summary</h2>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Auto-Calculated</span>
                  </div>
                  
                  {/* Live Account Balance Pill */}
                  {selectedSupplier && (
                    <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border border-blue-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center text-blue-700">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-700">Live Account Balance</span>
                          <span className="text-xs text-slate-600 font-medium">Previous Balance</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-800 font-mono">{formatCurrency(supplierBalance, currency)}</span>
                    </div>
                  )}

                  {/* Calculation Rows */}
                  <div className="space-y-3">
                    
                    {/* Subtotal */}
                    <div className="flex items-center justify-between text-sm py-1 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">Subtotal</span>
                      <span className="text-slate-900 font-semibold font-mono text-base">{formatCurrency(cartTotal, currency)}</span>
                    </div>
                    
                    {/* Discount & Tax Inputs */}
                    <div className="grid grid-cols-2 gap-3 py-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1" htmlFor="discount-val">Discount ({currency})</label>
                        <input 
                          id="discount-val"
                          type="text" 
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          className="w-full bg-slate-50 hover:bg-white text-slate-800 text-sm font-medium rounded-lg border border-slate-200 focus:border-indigo-500 focus:bg-white py-1.5 px-2.5 transition-all" 
                          value={transaction.discount || ''}
                          onChange={(event) => setTransaction((current) => ({ ...current, discount: removeLeadingZeros(event.target.value) }))}
                          onFocus={e => e.target.select()}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1" htmlFor="tax-val">Tax / GST ({currency})</label>
                        <input 
                          id="tax-val"
                          type="text" 
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          className="w-full bg-slate-50 hover:bg-white text-slate-800 text-sm font-medium rounded-lg border border-slate-200 focus:border-indigo-500 focus:bg-white py-1.5 px-2.5 transition-all" 
                          value={transaction.tax || ''}
                          onChange={(event) => setTransaction((current) => ({ ...current, tax: removeLeadingZeros(event.target.value) }))}
                          onFocus={e => e.target.select()}
                        />
                      </div>
                    </div>
                    
                    {/* Grand Total Box */}
                    <div className="mt-2 p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-inner">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Grand Total</span>
                        <span className="text-xs text-slate-400">Total payable for items</span>
                      </div>
                      <div className="text-2xl font-bold font-mono tracking-tight text-white">
                        {formatCurrency(cartTotal - (parseFloat(transaction.discount) || 0) + (parseFloat(transaction.tax) || 0), currency)}
                      </div>
                    </div>
                    
                    {/* Amount Paid Now Field */}
                    <div className="pt-2">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="amount-paid">
                        Amount Paid Now ({currency})
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-bold text-sm">{currency}</div>
                        <input 
                          id="amount-paid"
                          type="text" 
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          className="w-full bg-white text-slate-900 text-base font-bold rounded-lg border-2 border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 py-2 pl-9 pr-3.5 transition-all shadow-sm" 
                          value={transaction.amountPaid}
                          onChange={(event) => setTransaction((current) => ({ ...current, amountPaid: removeLeadingZeros(event.target.value) }))}
                          onFocus={e => e.target.select()}
                        />
                      </div>
                    </div>
                    
                    {/* Updated Live Balance Result */}
                    {selectedSupplier && (
                      <div className="pt-2 flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 mt-2">
                        <span className="text-xs font-medium text-slate-600">New Account Balance:</span>
                        <span className={`text-sm font-bold font-mono tracking-tight ${(supplierBalance + (cartTotal - (parseFloat(transaction.discount) || 0) + (parseFloat(transaction.tax) || 0)) - (parseFloat(transaction.amountPaid) || 0)) > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                          {formatCurrency(supplierBalance + (cartTotal - (parseFloat(transaction.discount) || 0) + (parseFloat(transaction.tax) || 0)) - (parseFloat(transaction.amountPaid) || 0), currency)}
                        </span>
                      </div>
                    )}
                    
                  </div>
                </div>
              </div>
              {/* END: RightColumn */}
            </div>
          </form>
        </div>
        {/* END: ModalContentBody */}

        {/* BEGIN: ModalFooter */}
        <footer className="px-6 py-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-20 rounded-b-2xl">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded shadow-sm">Esc</kbd> to close
            <span className="text-slate-300">•</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded shadow-sm">Enter</kbd> to record invoice
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => setOpenForm(false)}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 active:bg-slate-100 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              form="purchase-form"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              <span>Record Invoice</span>
            </button>
          </div>
        </footer>
        {/* END: ModalFooter */}
      </div>
    </div>
  );
}));

export default function Purchases() {
  const { businessColor } = useBusiness();

  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeletePurchase, setConfirmDeletePurchase] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [printingPurchase, setPrintingPurchase] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const debouncedHistorySearchQuery = useDebounce(historySearchQuery, 300);

  const categoriesList = useLiveQuery(() => getDB().categories.toArray(), []) || [];
  const productsList = useLiveQuery(() => getDB().products.toArray(), []) || [];

  const optionalColumns = ['Supplier', 'Paid', 'Balance', 'Action'];
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('purchases_visible_columns');
      return saved ? JSON.parse(saved) : ['Supplier', 'Paid', 'Balance', 'Action'];
    } catch {
      return ['Supplier', 'Paid', 'Balance', 'Action'];
    }
  });

  const toggleColumn = (col) => {
    setVisibleCols(prev => {
      const next = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem('purchases_visible_columns', JSON.stringify(next));
      return next;
    });
  };

  const matchedSuppliers = useLiveQuery(
    async () => {
      if (!debouncedHistorySearchQuery) return [];
      const term = debouncedHistorySearchQuery.toLowerCase();
      const currentDB = getDB();
      return await currentDB.suppliers.filter(s => s.name ? s.name.toLowerCase().includes(term) : false).primaryKeys();
    },
    [debouncedHistorySearchQuery],
    []
  );

  const matchedProducts = useLiveQuery(
    async () => {
      if (!debouncedHistorySearchQuery) return [];
      const term = debouncedHistorySearchQuery.toLowerCase();
      const currentDB = getDB();
      return await currentDB.products.filter(p => {
        const nameMatch = p.name ? p.name.toLowerCase().includes(term) : false;
        const barcodeMatch = p.barcode ? p.barcode.toLowerCase().includes(term) : false;
        return nameMatch || barcodeMatch;
      }).primaryKeys();
    },
    [debouncedHistorySearchQuery],
    []
  );

  const modalRef = useRef(null);
  const invoiceRef = useRef(null);

  const handlePrintInvoice = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: 'Purchase_Invoice',
  });

  const viewInvoice = async (purchase) => {
    const currentDB = getDB();
    let supplier = null;
    if (purchase.supplierId) {
      supplier = await currentDB.suppliers.get(purchase.supplierId);
    } else if (purchase.supplier) {
      supplier = await currentDB.suppliers.where('name').equals(purchase.supplier).first();
    }
    setPrintingPurchase({ 
      purchase: purchase, 
      supplier 
    });
    setReceiptOpen(true);
  };

  useEffect(() => {
    const load = async () => {
      await initDB();
    };
    load();
  }, []);

  const queryBuilder = useCallback((db) => {
    let query = db.purchases.reverse();
    if (debouncedHistorySearchQuery) {
      const term = debouncedHistorySearchQuery.toLowerCase();
      const cleanIdTerm = term.replace(/^#/, ''); // Remove # if user typed it
      query = query.filter((p) => {
        const idMatch = p.purchaseNumber ? p.purchaseNumber.toLowerCase().includes(term) : (p.id ? p.id.toString().includes(cleanIdTerm) : false);
        const dateMatch = p.date ? new Date(p.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }).toLowerCase().includes(term) : false;
        const supplierMatch = p.supplierId && matchedSuppliers && matchedSuppliers.includes(p.supplierId);
        return idMatch || dateMatch || supplierMatch;
      });
    }

    return query;
  }, [debouncedHistorySearchQuery, matchedSuppliers]);

  const [limit, setLimit] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [debouncedHistorySearchQuery, limit, matchedSuppliers]);

  const { data: visibleData, totalCount, isLoading, refresh: refreshPurchases } = useDexieOffsetPagination(
    queryBuilder,
    [debouncedHistorySearchQuery, matchedSuppliers],
    currentPage,
    limit
  );

  const [stats, setStats] = useState({ totalSpent: 0, totalOutstanding: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const db = getDB();
      const allPurchases = await db.purchases.toArray();
      let spent = 0;
      let outstanding = 0;
      allPurchases.forEach(p => {
        spent += (p.totalCost || 0);
        outstanding += ((p.totalCost || 0) - (p.amountPaid || 0));
      });
      setStats({ totalSpent: spent, totalOutstanding: outstanding });
    };
    fetchStats();
  }, [totalCount]);
  
  const { selectedIds, isSelected, toggleOne, toggleAll, clearSelection, isAllSelected, selectedCount } = useMultiSelect(visibleData);

  const openNewPurchase = () => modalRef.current?.openNew();

  const deletePurchase = async (purchase) => {
    if (!purchase.id) return;

    const currentDB = getDB();
    await currentDB.purchases.delete(purchase.id);
    
    const itemsToRevert = purchase.items || [{
      productId: purchase.productId,
      quantity: purchase.quantity,
      batchNumber: purchase.batchNumber,
      totalCost: purchase.totalCost,
    }];
    
    for (const item of itemsToRevert) {
      if (!item.productId) continue;
      
      const inventoryItem = await currentDB.inventory.where('productId').equals(item.productId).first();
      if (inventoryItem && inventoryItem.id) {
        const updatedQuantity = Math.max(0, inventoryItem.quantity - item.quantity);
        await currentDB.inventory.update(inventoryItem.id, { quantity: updatedQuantity, lastUpdated: new Date().toISOString() });
      }

      if (item.batchNumber) {
        const allBatches = await currentDB.productBatches.where('productId').equals(item.productId).toArray();
        const batchItem = allBatches.find(b => b.batchNumber === item.batchNumber);
        if (batchItem && batchItem.id) {
          const updatedQuantity = Math.max(0, batchItem.quantity - item.quantity);
          await currentDB.productBatches.update(batchItem.id, { quantity: updatedQuantity });
        }
      }
      
      const allHistory = await currentDB.priceHistory.where('productId').equals(item.productId).toArray();
      const purchaseHistory = allHistory.filter(h => h.type === 'purchase');
      if (purchaseHistory.length > 0) {
        const totalCostAmt = purchaseHistory.reduce((s, h) => s + ((h.purchasePrice || 0) * (h.quantity || 1)), 0);
        const totalQtyAmt = purchaseHistory.reduce((s, h) => s + (h.quantity || 1), 0);
        const newWac = totalQtyAmt > 0 ? totalCostAmt / totalQtyAmt : 0;
        await currentDB.products.update(item.productId, { costPrice: newWac });
      } else {
        await currentDB.products.update(item.productId, { costPrice: 0 });
      }
    }

    if (purchase.supplierId) {
      await currentDB.supplierLedger.add({
        supplierId: purchase.supplierId,
        type: 'charge_reversal',
        amount: purchase.totalAmount || purchase.totalCost,
        description: `Reversal of deleted invoice #${purchase.purchaseNumber || purchase.id}`,
        date: new Date().toISOString(),
      });
      if (purchase.paidAmount || purchase.amountPaid) {
        await currentDB.supplierLedger.add({
          supplierId: purchase.supplierId,
          type: 'payment_reversal',
          amount: purchase.paidAmount || purchase.amountPaid,
          description: `Reversal of payment for deleted invoice #${purchase.purchaseNumber || purchase.id}`,
          date: new Date().toISOString(),
        });
      }
    }

    clearPaginationCache('inventory');
    refreshPurchases();
    setConfirmDeletePurchase(null);
  };

  const deleteSelected = () => {
    if (selectedCount === 0) return;
    setConfirmBulkDelete(true);
  };

  const performBulkDelete = async () => {
    setConfirmBulkDelete(false);
    setIsDeleting(true);
    try {
      const currentDB = getDB();
      const purchasesToDelete = visibleData.filter((p) => selectedIds.includes(p.id));
      
      for (const purchase of purchasesToDelete) {
        const itemsToRevert = purchase.items || [{
          productId: purchase.productId,
          quantity: purchase.quantity,
          batchNumber: purchase.batchNumber,
          totalCost: purchase.totalCost,
        }];

        for (const item of itemsToRevert) {
          if (!item.productId) continue;

          const inventoryItem = await currentDB.inventory.where('productId').equals(item.productId).first();
          if (inventoryItem && inventoryItem.id) {
            const updatedQuantity = Math.max(0, inventoryItem.quantity - item.quantity);
            await currentDB.inventory.update(inventoryItem.id, { quantity: updatedQuantity, lastUpdated: new Date().toISOString() });
          }

          if (item.batchNumber) {
            const allBatches = await currentDB.productBatches.where('productId').equals(item.productId).toArray();
            const batchItem = allBatches.find(b => b.batchNumber === item.batchNumber);
            if (batchItem && batchItem.id) {
              const updatedQuantity = Math.max(0, batchItem.quantity - item.quantity);
              await currentDB.productBatches.update(batchItem.id, { quantity: updatedQuantity });
            }
          }
        }
        
        if (purchase.supplierId) {
          await currentDB.supplierLedger.add({
            supplierId: purchase.supplierId,
            type: 'charge_reversal',
            amount: purchase.totalAmount || purchase.totalCost,
            description: `Reversal of deleted invoice #${purchase.purchaseNumber || purchase.id}`,
            date: new Date().toISOString(),
          });
          if (purchase.paidAmount || purchase.amountPaid) {
            await currentDB.supplierLedger.add({
              supplierId: purchase.supplierId,
              type: 'payment_reversal',
              amount: purchase.paidAmount || purchase.amountPaid,
              description: `Reversal of payment for deleted invoice #${purchase.purchaseNumber || purchase.id}`,
              date: new Date().toISOString(),
            });
          }
        }
      }
      
      await currentDB.purchases.bulkDelete(selectedIds);
      
      refreshPurchases();
      clearSelection();
      
      const affectedProductIds = [...new Set(
        purchasesToDelete.flatMap(p => (p.items || [p]).map(i => i.productId)).filter(Boolean)
      )];
      
      await Promise.all(affectedProductIds.map(async (productId) => {
        const allHistory = await currentDB.priceHistory.where('productId').equals(productId).toArray();
        const purchaseHistory = allHistory.filter(h => h.type === 'purchase');
        if (purchaseHistory.length > 0) {
          const totalCostAmt = purchaseHistory.reduce((s, h) => s + ((h.purchasePrice || 0) * (h.quantity || 1)), 0);
          const totalQtyAmt = purchaseHistory.reduce((s, h) => s + (h.quantity || 1), 0);
          const newWac = totalQtyAmt > 0 ? totalCostAmt / totalQtyAmt : 0;
          await currentDB.products.update(productId, { costPrice: newWac });
        } else {
          await currentDB.products.update(productId, { costPrice: 0 });
        }
      }));
      
      clearSelection();
      clearPaginationCache('inventory');
      clearPaginationCache('suppliers');
      clearPaginationCache('purchases');
      forceRepaintAfterRender();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Purchase Management</h1>
        <div className="flex items-center gap-3 shrink-0 mt-2 md:mt-0">
          <GlobalButton
            icon={Plus}
            onClick={openNewPurchase}
          >
            Record Purchase
          </GlobalButton>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Purchases</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{totalCount || 0}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Recorded purchase transactions</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Spent</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalSpent, currency)}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Total value of all purchases</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Outstanding</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalOutstanding, currency)}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Unpaid purchase balances</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-4 flex-1">
              <div className="max-w-md w-full">
                <GlobalSearch
                  value={historySearchQuery}
                  onChange={setHistorySearchQuery}
                  placeholder="Search purchases by ID or supplier..."
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        <PrintWrapper title="Purchase Report" printLabel="Purchase Report">
          {useMemo(() => {
            const totalPages = Math.max(1, Math.ceil((totalCount || 0) / limit));
            
            const getPageNumbers = () => {
              const pages = [];
              if (totalPages <= 5) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                if (currentPage <= 3) {
                  pages.push(1, 2, 3, 4, '...', totalPages);
                } else if (currentPage >= totalPages - 2) {
                  pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                } else {
                  pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
                }
              }
              return pages;
            };

            const startItem = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
            const endItem = Math.min(currentPage * limit, totalCount || 0);

            const tableColumns = [
              {
                header: (
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                ),
                className: "w-10",
              },
              { header: "Purchase #" },
              { header: "Supplier" },
              { header: "Date" },
              { header: "Items" },
              { header: "Total Amount" },
              { header: "Paid" },
              { header: "Due" },
              { header: "Status" },
              { header: "Action" },
            ];

            return (
              <div className="mt-2">
                <GlobalTable
                  data={visibleData}
                  columns={tableColumns}
                  renderRow={(purchase, virtualIndex, measureRef) => {
                    const rowBg = virtualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                    
                    return (
                    <tr
                      key={purchase.id}
                      ref={measureRef}
                      data-index={virtualIndex}
                      className={`border-b border-slate-200 transition-colors ${isSelected(purchase.id) ? 'bg-red-50 hover:bg-red-100' : `hover:bg-slate-100 ${rowBg}`}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected(purchase.id)}
                          onChange={() => toggleOne(purchase.id)}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 text-sm">{purchase.purchaseNumber || `PUR-${String(purchase.id).padStart(4, '0')}`}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 text-sm">{purchase.supplier || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm">{formatDate(purchase.date)}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{purchase.items ? purchase.items.length : 1}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-900">{formatCurrency(purchase.totalAmount || purchase.totalCost, currency)}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600 font-medium">{formatCurrency(purchase.paidAmount || purchase.amountPaid || 0, currency)}</td>
                      <td className="px-4 py-3 text-sm text-red-600 font-medium">{formatCurrency(purchase.dueAmount || ((purchase.totalAmount || purchase.totalCost) - (purchase.paidAmount || purchase.amountPaid || 0)), currency)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                          (purchase.paymentStatus === 'Paid' || (purchase.paidAmount || purchase.amountPaid) >= (purchase.totalAmount || purchase.totalCost))
                            ? 'bg-emerald-100 text-emerald-700' 
                            : (purchase.paymentStatus === 'Partial' || (purchase.paidAmount || purchase.amountPaid) > 0)
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                        }`}>
                          {purchase.paymentStatus || ((purchase.paidAmount || purchase.amountPaid) >= (purchase.totalAmount || purchase.totalCost) ? 'Paid' : (purchase.paidAmount || purchase.amountPaid) > 0 ? 'Partial' : 'Unpaid')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2 pr-2">
                          <button
                            type="button"
                            onClick={() => viewInvoice(purchase)}
                            className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 hover:bg-blue-100 transition-colors"
                            title="View Invoice"
                          >
                            <BookOpen className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePurchase(purchase)}
                            className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition-colors"
                            title="Delete Purchase"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  }}
                  emptyState={
                    <div className="p-8 text-center text-slate-500">
                      No purchases found.
                    </div>
                  }
                />
                
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div>
                      Showing <span className="font-bold text-slate-700">{startItem}</span> to <span className="font-bold text-slate-700">{endItem}</span> of <span className="font-bold text-slate-700">{totalCount || 0}</span> items
                    </div>
                    <div className="h-3 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                      <span>Rows:</span>
                      <RowsDropdown limit={limit} setLimit={setLimit} />
                    </div>
                    {isLoading && <span className="ml-2 animate-pulse text-blue-500">Loading...</span>}
                  </div>

                  <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm text-sm font-medium text-slate-600">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className={`flex h-7 w-7 items-center justify-center rounded ${currentPage === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    
                    {getPageNumbers().map((pageNum, idx) => (
                      <button
                        key={idx}
                        disabled={pageNum === '...'}
                        onClick={() => typeof pageNum === 'number' && setCurrentPage(pageNum)}
                        className={`flex h-7 w-7 items-center justify-center rounded ${
                          pageNum === '...' 
                            ? 'text-slate-400 cursor-default' 
                            : pageNum === currentPage 
                              ? 'bg-blue-50 text-blue-600' 
                              : 'hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className={`flex h-7 w-7 items-center justify-center rounded ${currentPage === totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          }, [visibleData, currentPage, limit, totalCount, isLoading, isAllSelected, selectedIds])}
        </PrintWrapper>
      </div>

      <ConfirmDialog
        open={!!confirmDeletePurchase}
        title="Delete purchase"
        description="This will remove this purchase record. Inventory will be adjusted. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setConfirmDeletePurchase(null)}
        onConfirm={() => deletePurchase(confirmDeletePurchase)}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selectedCount} purchases?`}
        description="This will permanently remove the selected purchase records. Inventory quantities will be reversed. This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={performBulkDelete}
      />

        <PurchaseFormModal 
          ref={modalRef}
          currency={currency}
          onSuccess={(type, purchase) => {
            clearPaginationCache('suppliers');
            clearPaginationCache('purchases');
            refreshPurchases();
            forceRepaintAfterRender();
            viewInvoice(purchase);
          }}
        />

      <BulkDeleteBar
        selectedCount={selectedCount}
        onDelete={deleteSelected}
        onCancel={clearSelection}
        itemLabel="purchase"
        isDeleting={isDeleting}
      />

      {receiptOpen && printingPurchase && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 flex flex-col items-center justify-center font-sans antialiased">
          {/* BEGIN: ModalContainer */}
          <div className="relative w-full max-w-5xl bg-slate-50 rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200" data-purpose="invoice-preview-modal">
            
            {/* BEGIN: ModalHeader */}
            <header className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 select-none shrink-0" data-purpose="modal-header">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-semibold text-slate-800">Purchase Invoice Preview</h1>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                      Verified &amp; Recorded
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">Reference: {printingPurchase.purchase?.purchaseNumber || `INV-${printingPurchase.purchase?.id?.toString().padStart(5, '0')}`} • {formatDate(printingPurchase.purchase?.date)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3">
                <button 
                  onClick={handlePrintInvoice}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition" 
                  type="button"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                    <path d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                  <span>Print A4 Invoice</span>
                </button>
                <div className="h-5 w-[1px] bg-slate-200 mx-0.5"></div>
                <button 
                  onClick={() => { setReceiptOpen(false); setPrintingPurchase(null); }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition" 
                  title="Close Preview" 
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                </button>
              </div>
            </header>
            {/* END: ModalHeader */}

            {/* BEGIN: ModalDocumentViewport */}
            <main className="overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-100/80 flex-1" data-purpose="invoice-document-viewport">
              {/* THE RECEIPT CONTENT */}
              <SupplierA4Invoice 
                ref={invoiceRef}
                purchase={printingPurchase.purchase}
                supplier={printingPurchase.supplier}
                settings={settings}
                currency={currency}
                businessColor={businessColor}
              />
            </main>
            {/* END: ModalDocumentViewport */}

            {/* BEGIN: ModalBottomBar */}
            <div className="px-6 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 shrink-0" data-purpose="modal-footer-toolbar">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Paper Format: <strong>A4 Standard (210 × 297 mm)</strong></span>
              </div>
              <div className="flex items-center gap-4">
                <span>Page 1 of 1</span>
              </div>
            </div>
            {/* END: ModalBottomBar */}
          </div>
        </div>
      )}

      {/* Hidden A4 Invoice Print Block for ReactToPrint if modal is closed but we still needed it, but now it's inside modal */}
      <div className="hidden">
        {printingPurchase && (
          <SupplierA4Invoice 
            ref={invoiceRef}
            purchase={printingPurchase.purchase || printingPurchase}
            supplier={printingPurchase.supplier}
            settings={settings}
            currency={currency}
            businessColor={businessColor}
          />
        )}
      </div>
    </div>
  );
}
