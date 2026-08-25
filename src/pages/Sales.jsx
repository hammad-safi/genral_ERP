import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Search, Trash2, Printer, CheckCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import { initDB, getDB } from '@/lib/db';
import { formatCurrency, formatDate, removeLeadingZeros, forceRepaintAfterRender } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useDebounce } from '@/hooks/useDebounce';
import { useBusiness } from '@/contexts/BusinessContext';
import { useDexiePagination } from '@/hooks/useDexiePagination';
import VirtualTable from '@/components/VirtualTable';
import { useLiveQuery } from 'dexie-react-hooks';

const paymentMethods = ['Cash', 'Card', 'Other'];

export default function Sales() {
  const { businessColor } = useBusiness();
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [amountPaying, setAmountPaying] = useState('');
  const [customerBalance, setCustomerBalance] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);
  const [receiptCustomer, setReceiptCustomer] = useState(null);
  const [receiptAmountPaid, setReceiptAmountPaid] = useState('');
  const [fromDate, setFromDate] = useState(() => new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().substring(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().substring(0, 10));
  const receiptRef = useRef(null);
  const salesReportRef = useRef(null);
  const barcodeRef = useRef(null);
  const [barcodeValue, setBarcodeValue] = useState('');
  const [scanFeedback, setScanFeedback] = useState(null);
  const [confirmFreeSale, setConfirmFreeSale] = useState(false);
  const [returningSale, setReturningSale] = useState(null);
  const [confirmReturnSale, setConfirmReturnSale] = useState(false);
  const [returnSuccessMessage, setReturnSuccessMessage] = useState(null);
  const [returnAlreadyProcessedMessage, setReturnAlreadyProcessedMessage] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [viewSale, setViewSale] = useState(null);
  
  const queryBuilder = useCallback((db) => {
    return db.sales.orderBy('date').reverse().filter((s) => {
      const d = new Date(s.date);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return localDateStr >= fromDate && localDateStr <= toDate;
    });
  }, [fromDate, toDate]);

  const transformChunk = useCallback(async (chunk) => {
    const currentDB = getDB();
    const customerIds = [...new Set(chunk.map(s => s.customerId).filter(Boolean))];
    const customers = await currentDB.customers.where('id').anyOf(customerIds).toArray();
    const customerMap = new Map(customers.map(c => [c.id, c.name]));
    
    return chunk.map(sale => {
      let customerName = 'Walk-in';
      if (sale.customerId && customerMap.has(sale.customerId)) {
        customerName = customerMap.get(sale.customerId);
      }
      return {
        ...sale,
        customerName: customerName,
      };
    });
  }, []);

  const { data: visibleData, loadMoreRef, hasMore, refresh: refreshSales } = useDexiePagination(queryBuilder, [fromDate, toDate], 20, transformChunk, 'sales-history');

  const { selectedIds: selectedSalesIds, isSelected: isSalesSelected, toggleOne: toggleSaleOne, toggleAll: toggleSalesAll, clearSelection: clearSalesSelection, isAllSelected: isAllSalesSelected, selectedCount: selectedSalesCount } = useMultiSelect(visibleData);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const debouncedCustomerSearch = useDebounce(customerSearch, 300);

  const searchResults = useLiveQuery(
    async () => {
      if (!debouncedSearchQuery) return [];
      const term = debouncedSearchQuery.toLowerCase();
      const currentDB = getDB();
      return await currentDB.products
        .where('name').startsWithIgnoreCase(term)
        .or('barcode').startsWithIgnoreCase(term)
        .limit(20)
        .toArray();
    },
    [debouncedSearchQuery],
    []
  );

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

  useEffect(() => {
    const loadInitialData = async () => {
      await initDB();
      const currentDB = getDB();
      // Only keep inventory for stock display check in dropdown
      const inventoryData = await currentDB.inventory.toArray();
      setInventory(inventoryData);
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const loadBalance = async () => {
      if (!selectedCustomer?.id) {
        setCustomerBalance(null);
        return;
      }
      const currentDB = getDB();
      const ledgerTable = currentDB.customerLedger;
      const idField = 'customerId';
      const ledger = await ledgerTable.where(idField).equals(selectedCustomer.id).toArray();
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

  const addToCart = (product) => {
    const inventoryItem = inventory.find((item) => item.productId === product.id);
    if (!inventoryItem || inventoryItem.quantity <= 0) {
      setScanFeedback({ msg: `✗ ${product.name} is out of stock!`, type: 'error' });
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    const existing = cart.find((item) => item.productId === product.id);
    const nextQty = existing ? existing.qty + 1 : 1;
    if (nextQty > inventoryItem.quantity) {
      setScanFeedback({ msg: `✗ Only ${inventoryItem.quantity} in stock for ${product.name}.`, type: 'error' });
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    if (existing) {
      setCart((current) =>
        current.map((item) =>
          item.productId === product.id
            ? { ...item, qty: item.qty + 1, subtotal: (item.qty + 1) * item.unitPrice }
            : item
        )
      );
    } else {
      setCart((current) => [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          qty: 1,
          unitPrice: product.price,
          costPrice: product.costPrice ?? 0,
          subtotal: product.price,
          expiryDate: product.expiryDate || null,
        },
      ]);
    }
    setSearchQuery('');
  };

  const handleBarcodeSearch = async (value) => {
    const barcode = value.trim();
    if (!barcode) return;

    const currentDB = getDB();
    const product = await currentDB.products.where('barcode').equals(barcode).first();
    if (!product) {
      setScanFeedback({ msg: `✗ No product found for barcode: ${barcode}`, type: 'error' });
      setBarcodeValue('');
      barcodeRef.current?.focus();
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    const inventoryItem = await currentDB.inventory.where('productId').equals(product.id).first();
    if (inventoryItem && inventoryItem.quantity <= 0) {
      setScanFeedback({ msg: `✗ ${product.name} is out of stock!`, type: 'error' });
      setBarcodeValue('');
      barcodeRef.current?.focus();
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    addToCart(product);
    setScanFeedback({ msg: `✓ ${product.name} added to cart!`, type: 'success' });
    setBarcodeValue('');
    barcodeRef.current?.focus();
    setTimeout(() => setScanFeedback(null), 3000);
  };

  const handleBarcodeInput = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleBarcodeSearch(barcodeValue);
    }
  };

  const updateQty = (productId, qty) => {
    if (qty === '' || qty === null || qty === undefined) {
      setCart((current) =>
        current.map((item) =>
          item.productId === productId
            ? { ...item, qty: '', subtotal: 0 }
            : item
        )
      );
      return;
    }

    const numQty = Number(qty);
    if (isNaN(numQty)) return;

    const inventoryItem = inventory.find((item) => item.productId === productId);
    if (inventoryItem && numQty > inventoryItem.quantity) {
      setScanFeedback({ msg: `✗ Cannot exceed stock of ${inventoryItem.quantity}.`, type: 'error' });
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.productId === productId
          ? { ...item, qty: numQty, subtotal: numQty * item.unitPrice }
          : item
      )
    );
  };

  const removeItem = (productId) => {
    setCart((current) => current.filter((item) => item.productId !== productId));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const totalAmount = Math.max(0, subtotal - (Number(discount) || 0));

  const handleConfirmFreeSale = async () => {
    setConfirmFreeSale(false);
    await completeSaleLogic();
  };

  const completeSaleLogic = async () => {
    if (cart.length === 0) return;
    const currentDB = getDB();
    const saleDate = new Date().toISOString();
    const sale = {
      items: cart,
      totalAmount,
      discount: Number(discount) || 0,
      paymentMethod: selectedCustomer ? 'customer_account' : paymentMethod,
      customerId: selectedCustomer?.id ?? null,
      date: saleDate,
      returned: false,
    };
    const id = await currentDB.sales.add(sale);
    
    await Promise.all(
      cart.map(async (item) => {
        const inventoryItem = await currentDB.inventory.where('productId').equals(item.productId).first();
        if (inventoryItem && inventoryItem.id) {
          const updatedQuantity = Math.max(0, inventoryItem.quantity - item.qty);
          await currentDB.inventory.update(inventoryItem.id, {
            quantity: updatedQuantity,
            lastUpdated: new Date().toISOString(),
          });
        }
      })
    );

    if (selectedCustomer) {
      await currentDB.customerLedger.add({
        customerId: selectedCustomer.id,
        type: 'charge',
        amount: totalAmount,
        description: `Purchase - Sale #${id}`,
        date: saleDate,
      });

      const parsedAmountPaying = parseFloat(amountPaying) || 0;
      const validatedAmountPaying = Math.min(parsedAmountPaying, totalAmount);
      if (validatedAmountPaying > 0) {
        await currentDB.customerLedger.add({
          customerId: selectedCustomer.id,
          type: 'payment',
          amount: validatedAmountPaying,
          description: `Payment at sale #${id}`,
          date: saleDate,
        });
      }
    }

    const updatedInventory = await currentDB.inventory.toArray();
    setInventory(updatedInventory);

    setReceiptSale({ ...sale, id });
    setReceiptCustomer(selectedCustomer);
    setReceiptAmountPaid(parseFloat(amountPaying) || 0);
    setReceiptOpen(true);
    setCart([]);
    setSelectedCustomer(null);
    setAmountPaying('');
    setCustomerSearch('');
    setCustomerBalance(null);
    setDiscount('');
    setPaymentMethod('Cash');

    refreshSales();
  };

  const completeSale = async () => {
    if (totalAmount === 0 && cart.length > 0) {
      setConfirmFreeSale(true);
      return;
    }
    await completeSaleLogic();
  };

  const returnSale = (sale) => {
    if (!sale || sale.returned) {
      setReturnAlreadyProcessedMessage('This sale has already been returned.');
      return;
    }
    setReturningSale(sale);
    setConfirmReturnSale(true);
  };

  const performReturnSale = async () => {
    if (!returningSale) return;

    const sale = returningSale;
    const currentDB = getDB();

    const totalPreDiscountSubtotal = sale.items.reduce((s, i) => s + (i.subtotal || 0), 0);
    const discountRatio = totalPreDiscountSubtotal > 0 ? sale.totalAmount / totalPreDiscountSubtotal : 1;

    await Promise.all(
      sale.items.map(async (item) => {
        const inventoryItem = await currentDB.inventory.where('productId').equals(item.productId).first();
        if (inventoryItem && inventoryItem.id) {
          const newQty = Math.max(0, inventoryItem.quantity + item.qty);
          await currentDB.inventory.update(inventoryItem.id, { quantity: newQty, lastUpdated: new Date().toISOString() });
        }

        const adjustedRefundAmount = Math.round(item.subtotal * discountRatio * 100) / 100;

        await currentDB.salesReturns.add({
          originalSaleId: sale.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.qty,
          refundAmount: adjustedRefundAmount,
          reason: 'Customer return',
          refundMethod: sale.paymentMethod,
          customerId: sale.customerId || null,
          date: new Date().toISOString(),
        });
      })
    );

    if (sale.customerId) {
      await currentDB.customerLedger.add({
        customerId: sale.customerId,
        type: 'charge',
        amount: -sale.totalAmount,
        description: `Return reversal for sale #${sale.id}`,
        date: new Date().toISOString(),
      });

      const paymentEntries = await currentDB.customerLedger
        .where('customerId')
        .equals(sale.customerId)
        .toArray();
      
      const paymentsToReverse = paymentEntries.filter(
        (entry) => entry.type === 'payment' && entry.description && entry.description.includes(`sale #${sale.id}`)
      );

      for (const payment of paymentsToReverse) {
        await currentDB.customerLedger.add({
          customerId: sale.customerId,
          type: 'payment_reversal',
          amount: -payment.amount,
          description: `Payment reversal for sale #${sale.id}`,
          date: new Date().toISOString(),
        });
      }
    }

    await currentDB.sales.update(sale.id, { returned: true });

    const [updatedInventory] = await Promise.all([
      currentDB.inventory.toArray(),
    ]);

    setInventory(updatedInventory);
    refreshSales();

    setViewSale(null);
    setReturningSale(null);
    setConfirmReturnSale(false);
    setReturnSuccessMessage('Sale returned and inventory restored successfully.');
    
    setTimeout(() => setReturnSuccessMessage(null), 3000);
  };

  const deleteSelectedSales = () => {
    if (selectedSalesCount === 0) return;
    setConfirmBulkDelete(true);
  };

  const performBulkDeleteSales = async () => {
    setConfirmBulkDelete(false);
    setIsDeleting(true);
    try {
      const currentDB = getDB();
      
      for (const saleId of selectedSalesIds) {
        const sale = visibleData.find((s) => s.id === saleId);
        
        if (sale && sale.returned !== true && sale.items && Array.isArray(sale.items)) {
          for (const item of sale.items) {
            if (item.productId && item.qty) {
              const inventoryItem = await currentDB.inventory.where('productId').equals(item.productId).first();
              if (inventoryItem && inventoryItem.id) {
                const restoredQuantity = inventoryItem.quantity + item.qty;
                await currentDB.inventory.update(inventoryItem.id, { quantity: restoredQuantity, lastUpdated: new Date().toISOString() });
              }
            }
          }
        }
      }
      
      // Bulk delete the sales
      await currentDB.sales.bulkDelete(selectedSalesIds);

      
      // Re-fetch inventory from DB and update local state
      const updatedInventory = await currentDB.inventory.toArray();
      setInventory(updatedInventory);
      
      clearSalesSelection();
      forceRepaintAfterRender();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrintReceipt = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: 'Sale_Receipt',
  });

  const printReceipt = async () => {
    if (window.electronAPI && window.electronAPI.printReceipt && receiptRef.current) {
      try {
        const printerName = settings?.receiptPrinter || settings?.reportsPrinter;
        const result = await window.electronAPI.printReceipt(receiptRef.current.innerHTML, printerName);
        if (result.success) {
          setScanFeedback({ msg: '✓ Receipt sent to printer.', type: 'success' });
        } else {
          setScanFeedback({ msg: `✗ Print failed: ${result.errorType}`, type: 'error' });
        }
        setTimeout(() => setScanFeedback(null), 3000);
      } catch (err) {
        setScanFeedback({ msg: '✗ Print error occurred.', type: 'error' });
        setTimeout(() => setScanFeedback(null), 3000);
      }
    } else {
      handlePrintReceipt();
    }
  };

  const handlePrintSalesReport = useReactToPrint({
    contentRef: salesReportRef,
    documentTitle: 'Sales_Report',
  });

  const printSalesReport = () => {
    handlePrintSalesReport();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" description="POS with scanner, cart, and receipt printing" />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Search product</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Add items to cart</h2>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
              {searchResults.length} product(s) found
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-2">
                🔍 Scan Barcode or Search by Name
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  ref={barcodeRef}
                  type="text"
                  value={barcodeValue}
                  onChange={(e) => setBarcodeValue(e.target.value)}
                  onKeyDown={handleBarcodeInput}
                  placeholder="📷 Scan barcode or type number + Enter"
                  className="flex-1 rounded-xl border-2 border-blue-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={async () => await handleBarcodeSearch(barcodeValue)}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>
              {scanFeedback && (
                <div className={`px-4 py-2 rounded-xl text-sm font-medium mb-3 ${
                  scanFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {scanFeedback.msg}
                </div>
              )}
            </div>

            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔤 Or search product by name..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pl-10 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
              />
              {searchQuery.length > 0 && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {searchResults.map((product) => (
                    <div
                      key={product.id}
                      onMouseDown={() => addToCart(product)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                    >
                      {product.image ? (
                        <img src={product.image} className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs text-slate-400">No img</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          {formatCurrency(product.price, currency)} | Stock: {inventory.find((entry) => entry.productId === product.id)?.quantity ?? 0}
                        </p>
                      </div>
                      <span className="text-blue-600 text-xs font-semibold">+ Add</span>
                    </div>
                  ))}
                </div>
              )}
              {searchQuery.length > 0 && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-lg">
                  No products found
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-900">Cart summary</p>
            <p className="mt-1 text-sm text-slate-600">Tap a product to add it to the cart.</p>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[58vh] rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Subtotal</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center text-slate-500">
                        <svg className="h-10 w-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3v1.585a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0019.5 18.835v-1.585a3 3 0 00-3-3m-6 0h6" />
                        </svg>
                        <p className="text-sm">No items in the cart</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  cart.map((item) => (
                    <tr key={item.productId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 font-semibold text-slate-900">{item.productName}</td>
                      <td className="px-4 py-4 text-slate-700">{formatCurrency(item.unitPrice, currency)}</td>
                      <td className="px-4 py-4 text-slate-700">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-4">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.qty}
                          onChange={(event) => {
                            const val = removeLeadingZeros(event.target.value);
                            updateQty(item.productId, val === '' ? '' : Number(val));
                          }}
                          onFocus={e => e.target.select()}
                          className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-center outline-none transition-colors focus:border-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900">{formatCurrency(item.subtotal, currency)}</td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Order summary</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-semibold text-slate-900">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Discount (flat amount in {currency})</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={discount}
                    onChange={(event) => setDiscount(removeLeadingZeros(event.target.value))}
                    onFocus={e => e.target.select()}
                    className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-right outline-none transition-colors focus:border-blue-500"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Enter amount to deduct, not percentage</p>
              </div>

              {/* Customer Search */}
                <label className="text-sm font-medium text-gray-700">
                  Customer (optional)
                </label>
                {selectedCustomer ? (
                  <div className="mt-1 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{selectedCustomer.name}</p>
                      <p className="text-xs text-gray-500">
                        Phone: {selectedCustomer.phone} {selectedCustomer.email ? `| ${selectedCustomer.email}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch('');
                        setAmountPaying('');
                        setCustomerBalance(null);
                      }}
                      className="text-red-400 hover:text-red-600 text-lg leading-none ml-2"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={e => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                      placeholder="Search by name or phone..."
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                    {showCustomerDropdown && customerResults && customerResults.length > 0 && (
                      <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {customerResults.map(c => (
                          <div
                            key={c.id}
                            onMouseDown={() => {
                              setSelectedCustomer(c);
                              setCustomerSearch('');
                              setShowCustomerDropdown(false);
                            }}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                          >
                            <p className="text-sm font-medium">{c.name}</p>
                            <p className="text-xs text-gray-400">
                              Phone: {c.phone} {c.email ? `| ${c.email}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}


              {selectedCustomer && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3 border">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Customer Account
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Previous Balance:</span>
                      <span className={`font-medium ${
                        (customerBalance?.balance ?? 0) > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(customerBalance?.balance ?? 0, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">New Purchase:</span>
                      <span className="font-medium text-red-600">+{formatCurrency(totalAmount, currency)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between text-sm font-bold">
                      <span>Total After Sale:</span>
                      {(() => {
                        const totalAfterSale = (customerBalance?.balance ?? 0) + totalAmount;
                        const isCredit = totalAfterSale < 0;
                        return (
                          <span className={isCredit ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(Math.abs(totalAfterSale), currency)} {isCredit ? '(Credit)' : ''}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs font-medium text-gray-600">
                      Amount Paying Now ({currency})
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amountPaying}
                      onChange={e => {
                        const value = removeLeadingZeros(e.target.value);
                        setAmountPaying(value);
                      }}
                      onFocus={e => e.target.select()}
                      placeholder="Enter amount"
                      className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span>Payment method</span>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="w-36 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
              {cart.length > 0 && Number(discount) >= subtotal && (
                <p className="text-xs text-amber-600 font-medium">⚠ Discount equals or exceeds subtotal. Total will be Rs 0.</p>
              )}
              <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span>{formatCurrency(totalAmount, currency)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={completeSale}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <CheckCircle className="h-4 w-4" />
              Complete Sale
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Clear cart
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex gap-3 mb-4 items-center flex-wrap">
          <div>
            <label className="text-xs text-gray-500">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button onClick={async () => {
            const currentDB = getDB();
            const [salesData, customerData] = await Promise.all([
              currentDB.sales.toArray(),
              currentDB.customers.toArray()
            ]);
            loadSalesList(salesData, customerData);
          }} className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
            Refresh
          </button>
          <div className="flex gap-2 ml-auto">
            <button onClick={printSalesReport}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
              🖨 Print Sales Report
            </button>
          </div>
        </div>

        <VirtualTable
          data={visibleData}
          columns={[
            {
              header: (
                <input
                  type="checkbox"
                  checked={isAllSalesSelected}
                  onChange={toggleSalesAll}
                  className="w-4 h-4 rounded cursor-pointer"
                />
              ),
              className: "w-10",
            },
            { header: "Date" },
            { header: "Items" },
            { header: "Customer" },
            { header: "Total" },
            { header: "Actions" },
          ]}
          hasMore={hasMore}
          loadMoreRef={loadMoreRef}
          emptyState={
            <div className="p-8 text-center text-gray-500">
              No sales found
            </div>
          }
          renderRow={(sale, virtualIndex, measureRef) => (
            <tr
              key={sale.id}
              ref={measureRef}
              data-index={virtualIndex}
              className={isSalesSelected(sale.id) ? 'bg-red-50' : 'border-b hover:bg-gray-50'}
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={isSalesSelected(sale.id)}
                  onChange={() => toggleSaleOne(sale.id)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
              </td>
              <td className="py-3 px-4 text-sm">
                {new Date(sale.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="py-3 px-4 text-sm">
                {sale.items?.length ?? 0} item(s)
                <br />
                <span className="text-xs text-gray-400">
                  {sale.items?.map((item) => item.productName).join(', ')}
                </span>
              </td>
              <td className="py-3 px-4 text-sm">{sale.customerName}</td>
              <td className="py-3 px-4 text-sm font-medium">{formatCurrency(sale.totalAmount, currency)}</td>
              <td className="py-3 px-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewSale(sale)}
                    className="text-blue-600 text-xs border border-blue-200 px-2 py-1 rounded hover:bg-blue-50"
                  >
                    👁 View
                  </button>
                  <button
                    onClick={() => returnSale(sale)}
                    className={`text-sm rounded px-2 py-1 ${sale.returned ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' : 'border border-red-200 text-red-600 hover:bg-red-50'}`}
                    disabled={sale.returned}
                  >
                    ↩ Return
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      </section>

      {viewSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Sale Details</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date:</span>
                <span>{new Date(viewSale.date).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Return status:</span>
                <span className={viewSale.returned ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                  {viewSale.returned ? 'Returned' : 'Active'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Customer:</span>
                <span>{viewSale.customerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Payment:</span>
                <span>{viewSale.paymentMethod}</span>
              </div>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[40vh] rounded-xl border border-slate-200 mb-4">
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2">Product</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Price</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewSale.items?.map((item, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{item.productName}</td>
                      <td className="p-2 text-right">{item.qty}</td>
                      <td className="p-2 text-right">{formatCurrency(item.unitPrice, currency)}</td>
                      <td className="p-2 text-right">{formatCurrency(item.subtotal, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between font-bold border-t pt-2">
              <span>Total</span>
              <span>{formatCurrency(viewSale.totalAmount, currency)}</span>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => {
                  setReceiptSale(viewSale);
                  setReceiptCustomer(null);
                  setReceiptAmountPaid('');
                  setReceiptOpen(true);
                  setViewSale(null);
                  setTimeout(() => printReceipt(), 300);
                }}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm">
                🖨 Print Receipt
              </button>
              <button
                onClick={() => {
                  if (!viewSale.returned) returnSale(viewSale);
                }}
                className={`flex-1 py-2 rounded-lg text-sm ${viewSale.returned ? 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200' : 'bg-red-500 text-white hover:bg-red-600'}`}
                disabled={viewSale.returned}
              >
                {viewSale.returned ? 'Already Returned' : '↩ Make Return'}
              </button>
              <button onClick={() => setViewSale(null)}
                className="flex-1 border py-2 rounded-lg text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptOpen && receiptSale ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-sm px-4 py-10 flex items-center justify-center">
          <div className="mx-auto w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between gap-3 border-b pb-4">
              <h2 className="text-xl font-bold text-slate-900">Receipt Preview</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={printReceipt}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-md active:scale-95"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button
                  onClick={() => setReceiptOpen(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            {/* THE RECEIPT CONTENT */}
            <div 
              ref={receiptRef} 
              className="receipt-container bg-white text-slate-900"
              style={{ 
                fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                lineHeight: '1.4'
              }}
            >
              {/* PRINT ONLY STYLES */}
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  @page { 
                    size: 80mm auto; 
                    margin: 0; 
                  }
                  body { 
                    margin: 0; 
                    padding: 0; 
                    background: #fff !important;
                  }
                  .receipt-container {
                    width: 80mm;
                    padding: 5mm;
                    margin: 0 auto;
                    color: #000 !important;
                    border: none !important;
                  }
                  .no-print { display: none !important; }
                  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                  .badge { border: 1px solid #000 !important; color: #000 !important; background: transparent !important; }
                }
                .receipt-container {
                  padding: 20px;
                  border: 1px solid #e2e8f0;
                  border-radius: 12px;
                }
              `}} />

              {/* Header */}
              <div className="text-center mb-6">
                {settings?.logo ? (
                  <img 
                    src={settings.logo} 
                    alt="Logo" 
                    className="w-12 h-12 mx-auto object-contain mb-2 rounded-full" 
                    style={{ width: '48px', height: '48px', maxWidth: '48px', maxHeight: '48px' }}
                  />
                ) : (
                  <div className="mb-2 inline-flex items-center justify-center w-12 h-12 bg-slate-900 text-white rounded-xl font-bold text-xl">
                    {settings?.shopName?.charAt(0) || 'S'}
                  </div>
                )}
                <h1 className="text-xl font-extrabold uppercase tracking-tight">{settings?.shopName || 'Shop ERP'}</h1>
                <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-relaxed">
                  {settings?.address && <span>{settings.address}<br /></span>}
                  {settings?.phone && <span>Ph: {settings.phone}</span>}
                </p>
                <div className="mt-3">
                  <span className="badge inline-block px-3 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    PAID
                  </span>
                </div>
              </div>

              {/* Order Metadata */}
              <div className="grid grid-cols-2 gap-y-3 mb-6 border-t border-b border-slate-100 py-4 text-[11px]">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-0.5">Order Number</p>
                  <p className="font-bold text-slate-800">#{receiptSale.id?.toString().padStart(5, '0')}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-0.5">Date</p>
                  <p className="font-bold text-slate-800">{new Date(receiptSale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-0.5">Payment Method</p>
                  <p className="font-bold text-slate-800">{receiptSale.paymentMethod === 'customer_account' ? 'Customer Account' : receiptSale.paymentMethod}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-0.5">Customer</p>
                  <p className="font-bold text-slate-800">{receiptCustomer?.name || 'Walk-in Customer'}</p>
                </div>
              </div>

              {/* Items Table Header */}
              <div className="flex justify-between items-center mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                <span>Description</span>
                <span>Amount</span>
              </div>

              {/* Items List */}
              <div className="space-y-4 mb-6">
                {receiptSale.items.map((item) => (
                  <div key={item.productId} className="flex justify-between items-start group">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-900 mb-0.5">{item.productName}</p>
                      <div className="flex flex-col text-[10px] text-slate-500">
                        <span>{item.qty} × {formatCurrency(item.unitPrice, currency)}</span>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-slate-900">{formatCurrency(item.subtotal, currency)}</p>
                  </div>
                ))}
              </div>

              {/* Totals Section */}
              <div className="space-y-2 border-t border-slate-100 pt-4 mb-4">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(receiptSale.items.reduce((sum, item) => sum + item.subtotal, 0), currency)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Discount</span>
                  <span className="font-semibold text-red-500">-{formatCurrency(receiptSale.discount, currency)}</span>
                </div>
                {/* Tax Placeholder if needed, otherwise 0 */}
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Tax (0%)</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(0, currency)}</span>
                </div>
                
                <div className="flex justify-between items-baseline pt-2 border-t-2 border-slate-900 mt-2">
                  <span className="text-[10px] font-black uppercase tracking-tighter">Grand Total</span>
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatCurrency(receiptSale.totalAmount, currency)}
                  </span>
                </div>
              </div>

              {/* Footer Note */}
              <div className="mt-8 text-center border-t border-slate-100 pt-6">
                <p className="text-[10px] font-bold text-slate-800">Thank you for your business!</p>
                <p className="text-[9px] text-slate-400 mt-1 italic">Software by Offline Shop ERP</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmClear}
        title="Clear cart"
        description="Remove all items from the cart?"
        confirmText="Clear"
        cancelText="Keep cart"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setCart([]);
          setConfirmClear(false);
        }}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selectedSalesCount} sales records?`}
        description="This will permanently remove the selected sales records. This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={performBulkDeleteSales}
      />

      <ConfirmDialog
        open={confirmReturnSale}
        title="Return this sale?"
        description="Are you sure you want to return this sale and restore stock?"
        confirmText="Confirm Return"
        cancelText="Cancel"
        onCancel={() => {
          setConfirmReturnSale(false);
          setReturningSale(null);
        }}
        onConfirm={performReturnSale}
      />

      <ConfirmDialog
        open={!!returnAlreadyProcessedMessage}
        title="Sale Already Returned"
        description={returnAlreadyProcessedMessage}
        confirmText="OK"
        onConfirm={() => setReturnAlreadyProcessedMessage(null)}
      />

      <ConfirmDialog
        open={confirmFreeSale}
        title="Free Sale Confirmation"
        description="Total is Rs 0 after discount. Complete this as a free sale?"
        confirmText="Complete Sale"
        cancelText="Cancel"
        onCancel={() => setConfirmFreeSale(false)}
        onConfirm={handleConfirmFreeSale}
      />

      {returnSuccessMessage && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-green-50 border border-green-200 p-4 shadow-lg">
          <p className="text-sm text-green-800">{returnSuccessMessage}</p>
        </div>
      )}

      {/* Hidden Sales Report for Printing */}
      <div ref={salesReportRef} className="print-source">
        <style dangerouslySetInnerHTML={{ __html:
          "@media print { " +
          "@page { size: A4 portrait; margin: 20mm; } " +
          "body { font-family: Arial, sans-serif; font-size: 13px; color: #000; background: #fff; } " +
          "table { width: 100%; border-collapse: collapse; margin-bottom: 20px; } " +
          "th, td { border: 1px solid #ccc; padding: 8px; text-align: left; } " +
          "th { background-color: #f2f2f2 !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; } " +
          "tr:nth-child(even) { background-color: #f9f9f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } " +
          ".text-right { text-align: right; } " +
          ".report-header { text-align: center; margin-bottom: 20px; } " +
          ".report-header h2 { font-size: 20px; margin-bottom: 4px; } " +
          ".report-header p { margin: 2px 0; color: #333; font-size: 12px; } " +
          ".summary-row td { border-top: 2px solid #333; font-weight: bold; font-size: 14px; } " +
          "}"
        }} />
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px' }}>
          <div className="report-header">
            <h2>{settings?.shopName || 'Sales Report'}</h2>
            {settings?.address && <p>{settings.address}</p>}
            {settings?.phone && <p>Ph: {settings.phone}</p>}
            <p style={{ marginTop: '10px', fontWeight: 'bold' }}>Sales Report</p>
            <p>Period: {fromDate} to {toDate}</p>
            <p>Printed: {new Date().toLocaleString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Items</th>
                <th>Customer</th>
                <th>Payment</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleData?.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px' }}>{formatDate(s.date)}</td>
                  <td style={{ padding: '8px' }}>{s.customerName || 'Walk-in'}</td>
                  <td style={{ padding: '8px' }}>{s.items?.reduce((sum, item) => sum + item.qty, 0)}</td>
                  <td style={{ padding: '8px' }} className="text-right">{formatCurrency(s.totalAmount, currency)}</td>
                  <td style={{ padding: '8px' }}>{s.paymentMethod}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3" style={{ padding: '8px', fontWeight: 'bold' }} className="text-right">Total:</td>
                <td className="text-right">{formatCurrency(visibleData?.reduce((s, x) => s + x.totalAmount, 0) ?? 0, currency)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '12px', color: '#666' }}>Total Sales: {visibleData?.length ?? 0} transactions</p>
            <p style={{ fontSize: '12px', color: '#666' }}>Total Items Sold: {visibleData?.reduce((acc, s) => acc + (s.items?.reduce((sum, item) => sum + item.qty, 0) || 0), 0) ?? 0}</p>
          </div>
        </div>
      </div>

      <BulkDeleteBar
        selectedCount={selectedSalesCount}
        onDelete={deleteSelectedSales}
        onCancel={clearSalesSelection}
        itemLabel="sale"
        isDeleting={isDeleting}
      />
    </div>
  );
}
