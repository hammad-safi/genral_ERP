import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Search, Trash2, Printer, CheckCircle, ShoppingCart, X, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
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
import RowsDropdown from '@/components/RowsDropdown';
import CustomSelect from '@/components/CustomSelect';
import Barcode from 'react-barcode';
import CustomerA4Invoice from '@/components/CustomerA4Invoice';

const paymentMethods = ['Cash', 'Card', 'Other'];

const ScrollableTabs = ({ children }) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, children]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative flex items-center group mb-2 w-full min-w-0">
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 p-1 bg-white/90 shadow-sm border border-slate-200 rounded-full text-slate-600 hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100"
          style={{ transform: 'translateX(-30%)' }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      
      <div 
        ref={scrollRef} 
        onScroll={checkScroll}
        className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-1 min-w-0 py-1"
      >
        {children}
      </div>

      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 z-10 p-1 bg-white/90 shadow-sm border border-slate-200 rounded-full text-slate-600 hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100"
          style={{ transform: 'translateX(30%)' }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default function POS() {
  const { businessColor } = useBusiness();
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [pricingMode, setPricingMode] = useState('Retail');
  const [discount, setDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [showCheckout, setShowCheckout] = useState(false);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splits, setSplits] = useState([{ method: 'Cash', amount: '' }, { method: 'Card', amount: '' }]);
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '', openingBalance: '' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [amountPaying, setAmountPaying] = useState('');
  const [customerBalance, setCustomerBalance] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);
  const [receiptCustomer, setReceiptCustomer] = useState(null);
  const [receiptAmountPaid, setReceiptAmountPaid] = useState('');
  const [receiptFormat, setReceiptFormat] = useState('thermal');
  const [fromDate, setFromDate] = useState(() => new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().substring(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const debouncedHistorySearchQuery = useDebounce(historySearchQuery, 300);
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

  const { data: visibleData, loadMoreRef, hasMore, refresh: refreshSales } = useDexiePagination(queryBuilder, [fromDate, toDate, debouncedHistorySearchQuery], 20, transformChunk, 'sales-history');

  const { selectedIds: selectedSalesIds, isSelected: isSalesSelected, toggleOne: toggleSaleOne, toggleAll: toggleSalesAll, clearSelection: clearSalesSelection, isAllSelected: isAllSalesSelected, selectedCount: selectedSalesCount } = useMultiSelect(visibleData);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const debouncedCustomerSearch = useDebounce(customerSearch, 300);

  const [activeCategory, setActiveCategory] = useState(null);

  const categoriesList = useLiveQuery(() => getDB().categories.toArray(), []) || [];

  const searchResults = useLiveQuery(
    async () => {
      const currentDB = getDB();
      let results = [];
      
      if (!debouncedSearchQuery) {
        results = await currentDB.products.limit(100).toArray();
      } else {
        const term = debouncedSearchQuery.toLowerCase();
        results = await currentDB.products
          .where('name').startsWithIgnoreCase(term)
          .or('barcode').startsWithIgnoreCase(term)
          .limit(100)
          .toArray();
      }

      if (activeCategory) {
        // Collect active category and all its descendants
        const validIds = new Set([activeCategory, Number(activeCategory)]);
        let added = true;
        while (added) {
          added = false;
          for (const cat of categoriesList) {
            if ((validIds.has(cat.parentId) || validIds.has(Number(cat.parentId))) && !validIds.has(cat.id)) {
              validIds.add(cat.id);
              validIds.add(Number(cat.id));
              added = true;
            }
          }
        }
        results = results.filter(p => validIds.has(p.category) || validIds.has(Number(p.category)));
      }
      return results;
    },
    [debouncedSearchQuery, activeCategory, categoriesList],
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
    const effectivePrice = pricingMode === 'Wholesale' && product.wholesalePrice && product.wholesalePrice > 0 
      ? product.wholesalePrice 
      : product.price;

    const inventoryItem = inventory.find((item) => item.productId === product.id);
    if (!inventoryItem || inventoryItem.quantity <= 0) {
      setScanFeedback({ msg: `Î“Â£Ã¹ ${product.name} is out of stock!`, type: 'error' });
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    const existing = cart.find((item) => item.productId === product.id);
    const nextQty = existing ? existing.qty + 1 : 1;
    if (nextQty > inventoryItem.quantity) {
      setScanFeedback({ msg: `Î“Â£Ã¹ Only ${inventoryItem.quantity} in stock for ${product.name}.`, type: 'error' });
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
          unitPrice: effectivePrice,
          costPrice: product.costPrice ?? 0,
          subtotal: effectivePrice,
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
      setScanFeedback({ msg: `Î“Â£Ã¹ No product found for barcode: ${barcode}`, type: 'error' });
      setBarcodeValue('');
      barcodeRef.current?.focus();
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    const inventoryItem = await currentDB.inventory.where('productId').equals(product.id).first();
    if (inventoryItem && inventoryItem.quantity <= 0) {
      setScanFeedback({ msg: `Î“Â£Ã¹ ${product.name} is out of stock!`, type: 'error' });
      setBarcodeValue('');
      barcodeRef.current?.focus();
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    addToCart(product);
    setScanFeedback({ msg: `Î“Â£Ã´ ${product.name} added to cart!`, type: 'success' });
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
      setScanFeedback({ msg: `Î“Â£Ã¹ Cannot exceed stock of ${inventoryItem.quantity}.`, type: 'error' });
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
    const finalPaymentMethod = isSplitPayment ? 'Split' : (selectedCustomer ? 'customer_account' : paymentMethod);
    const totalPaid = isSplitPayment 
      ? splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
      : parseFloat(amountPaying) || 0;

    const sale = {
      items: cart,
      totalAmount,
      discount: Number(discount) || 0,
      paymentMethod: finalPaymentMethod,
      splits: isSplitPayment ? splits : [],
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

      if (totalPaid > 0) {
        await currentDB.customerLedger.add({
          customerId: selectedCustomer.id,
          type: 'payment',
          amount: totalPaid,
          description: `Payment at sale #${id}`,
          date: saleDate,
        });
      }
    }

    const updatedInventory = await currentDB.inventory.toArray();
    setInventory(updatedInventory);

    const prevBal = customerBalance?.balance || 0;
    const newBal = prevBal + totalAmount - totalPaid;

    setReceiptSale({ 
      ...sale, 
      id,
      previousBalance: prevBal,
      newBalance: newBal
    });
    setReceiptCustomer(selectedCustomer);
    setReceiptAmountPaid(totalPaid);
    setReceiptOpen(true);
    setCart([]);
    setSelectedCustomer(null);
    setAmountPaying('');
    setCustomerSearch('');
    setCustomerBalance(null);
    setDiscount('');
    setPaymentMethod('Cash');
    setIsSplitPayment(false);
    setSplits([{ method: 'Cash', amount: '' }, { method: 'Card', amount: '' }]);

    refreshSales();
  };

  const completeSale = async () => {
    if (totalAmount === 0 && cart.length > 0) {
      setConfirmFreeSale(true);
      return;
    }
    await completeSaleLogic();
  };

  const handleSaveNewCustomer = async () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      alert("Name and Phone are required.");
      return;
    }
    const currentDB = getDB();
    const customerObj = {
      name: newCustomer.name,
      phone: newCustomer.phone,
      email: newCustomer.email || '',
      address: newCustomer.address || '',
      createdAt: new Date().toISOString()
    };
    const id = await currentDB.customers.add(customerObj);
    
    const openingBalance = parseFloat(newCustomer.openingBalance) || 0;
    if (openingBalance > 0) {
      await currentDB.customerLedger.add({
        customerId: id,
        type: 'charge',
        amount: openingBalance,
        description: 'Opening Balance',
        date: new Date().toISOString()
      });
    }

    const c = await currentDB.customers.get(id);
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setShowAddCustomerForm(false);
    setNewCustomer({ name: '', phone: '', email: '', address: '', openingBalance: '' });
  };

  function returnSale(sale) {
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
          setScanFeedback({ msg: 'Î“Â£Ã´ Receipt sent to printer.', type: 'success' });
        } else {
          setScanFeedback({ msg: `Î“Â£Ã¹ Print failed: ${result.errorType}`, type: 'error' });
        }
        setTimeout(() => setScanFeedback(null), 3000);
      } catch (err) {
        setScanFeedback({ msg: 'Î“Â£Ã¹ Print error occurred.', type: 'error' });
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
      
      <div className="flex bg-slate-100 rounded-xl overflow-hidden shadow-sm border border-slate-200 mb-6" style={{ height: 'calc(100vh - 80px)', minHeight: '600px' }}>
        {/* Left Side: Product Grid */}
        <div className="flex-1 flex flex-col border-r border-slate-200 bg-slate-50 min-w-0">
          <div className="p-4 bg-white border-b border-slate-200 flex flex-col gap-3 min-w-0">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  ref={barcodeRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={handleBarcodeInput}
                  placeholder="Search products or scan barcode..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 outline-none transition-colors"
                />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPricingMode('Retail')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    pricingMode === 'Retail'
                      ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Retail
                </button>
                <button
                  type="button"
                  onClick={() => setPricingMode('Wholesale')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    pricingMode === 'Wholesale'
                      ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Wholesale
                </button>
              </div>
            </div>
            {/* Category Tabs */}
            {(() => {
              const chain = [];
              let currId = activeCategory;
              let safeCount = 0;
              while (currId && safeCount < 20) {
                chain.unshift(currId);
                const cat = categoriesList.find(c => c.id === currId || c.id === Number(currId));
                if (!cat) break;
                currId = cat.parentId ? Number(cat.parentId) : null;
                safeCount++;
              }
              
              const levels = [];
              let currentParentId = null;
              let i = 0;
              
              while (i <= chain.length) {
                const targetParentId = currentParentId !== null ? Number(currentParentId) : null;
                const opts = categoriesList.filter(c => {
                  const cParentId = c.parentId ? Number(c.parentId) : null;
                  return cParentId === targetParentId;
                });
                
                if (opts.length === 0) break;
                
                const selectedVal = chain[i] || null;
                const loopParentId = currentParentId; // Block-scoped capture for closure
                
                levels.push(
                  <ScrollableTabs key={`pos-cat-level-${i}`}>
                    <button
                      onClick={() => setActiveCategory(loopParentId)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                        selectedVal === null
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {i === 0 ? 'All Items' : 'All'}
                    </button>
                    {opts.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                          Number(selectedVal) === Number(cat.id)
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </ScrollableTabs>
                );
                
                if (selectedVal === null) break;
                currentParentId = selectedVal;
                i++;
              }
              
              return levels.length > 0 ? (
                <div className="flex flex-col gap-2 w-full min-w-0">
                  {levels}
                </div>
              ) : null;
            })()}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))' }}>
              {(searchResults || []).map(product => {
                const stockItem = inventory.find(i => i.productId === product.id);
                const stock = stockItem?.quantity || 0;
                return (
                  <button 
                    key={product.id}
                    onClick={() => stock > 0 && addToCart({ ...product, price: product.price || stockItem?.unitPrice || 0 })}
                    className={`bg-white rounded-xl border ${stock > 0 ? 'border-slate-200 hover:border-blue-500 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95' : 'border-slate-100 opacity-50 cursor-not-allowed'} flex flex-col overflow-hidden text-left transition-all`}
                  >
                    <div className="h-32 w-full bg-slate-100 flex items-center justify-center shrink-0 relative">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-slate-300">
                           <ShoppingCart className="h-8 w-8 opacity-20" />
                        </div>
                      )}
                      {stock <= 0 && <div className="absolute inset-0 bg-white/50 flex items-center justify-center"><span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">Out of Stock</span></div>}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold text-slate-900 leading-tight mb-1 truncate" title={product.name}>{product.name || stockItem?.productName}</p>
                      <div className="flex flex-col gap-0.5">
                        {pricingMode === 'Wholesale' && product.wholesalePrice > 0 ? (
                          <p className="text-sm font-bold text-emerald-600">{formatCurrency(product.wholesalePrice, currency)} <span className="text-[10px] text-emerald-600/60 font-medium ml-1">Wholesale</span></p>
                        ) : (
                          <p className="text-sm font-bold text-[#0056d6]">{formatCurrency(product.price || stockItem?.unitPrice || 0, currency)} <span className="text-[10px] text-slate-400 font-medium ml-1">Retail</span></p>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Cart Panel */}
        <div className="w-full md:w-[20%] lg:w-[25%] xl:w-[30%] bg-white flex flex-col shrink-0">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-slate-800" />
              <h2 className="text-xl font-bold text-slate-900">Current Order</h2>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">#1042</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 no-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                 <ShoppingCart className="h-12 w-12 opacity-20" />
                 <p className="text-sm font-medium">Cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden flex flex-col gap-3">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0056d6]"></div>
                  <div className="flex justify-between items-start pl-2">
                    <p className="font-bold text-slate-900 text-sm leading-snug pr-4">{item.productName}</p>
                    <p className="font-bold text-slate-900 text-sm shrink-0">{formatCurrency(item.subtotal, currency)}</p>
                  </div>
                  <div className="flex items-center justify-between pl-2">
                    <div className="flex items-center bg-slate-100 rounded border border-slate-200 overflow-hidden h-8">
                      <button onClick={() => updateQty(item.productId, Math.max(1, item.qty - 1))} className="w-8 h-full flex items-center justify-center hover:bg-slate-200 text-slate-600 font-bold transition-colors">-</button>
                      <input 
                        type="text" 
                        value={item.qty} 
                        onChange={e => updateQty(item.productId, removeLeadingZeros(e.target.value))}
                        onFocus={e => e.target.select()}
                        className="w-10 h-full text-center bg-transparent text-sm font-bold outline-none border-x border-slate-200"
                      />
                      <button onClick={() => updateQty(item.productId, item.qty + 1)} className="w-8 h-full flex items-center justify-center hover:bg-slate-200 text-slate-600 font-bold transition-colors">+</button>
                    </div>
                    <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600 p-1.5 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 border-t border-slate-200 bg-white">
            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Subtotal</span>
                <span className="text-slate-900 font-bold">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-slate-500 font-medium">Tax (0%) <button className="text-slate-400 hover:text-slate-600 ml-1">âœŽ</button></span>
                <span className="text-slate-900 font-bold">{formatCurrency(0, currency)}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-[#0056d6] font-medium">Discount</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-medium">{currency}</span>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                    className="w-20 text-right bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 text-sm font-bold text-[#0056d6] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-end mb-5 pt-5 border-t border-slate-100">
              <span className="text-xl font-bold text-slate-900">Total</span>
              <span className="text-[2.5rem] font-black text-slate-900 tracking-tight leading-none">{formatCurrency(totalAmount, currency)}</span>
            </div>
            
            <button
              onClick={() => {
                if (cart.length > 0) {
                  setAmountPaying(totalAmount);
                  setShowCheckout(true);
                }
              }}
              disabled={cart.length === 0}
              className="w-full bg-[#0056d6] hover:bg-[#0047b3] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
            >
              PAY NOW
              <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </div>
        </div>
      </div>

      {showCheckout && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4 py-8">
            <div className="bg-white rounded-2xl w-full max-w-4xl flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Checkout</h2>
              <button onClick={() => setShowCheckout(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row p-6 gap-8 bg-slate-50/50">
              {/* Left Side: Customer */}
              <div className="flex-1 space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer (Optional)</h3>
                
                {showAddCustomerForm ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
                      <input type="text" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="e.g. Ahmad Khan" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-[#0056d6] focus:ring-1 focus:ring-[#0056d6] outline-none transition-colors" />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                        <input type="text" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} placeholder="0312-1234567" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-[#0056d6] focus:ring-1 focus:ring-[#0056d6] outline-none transition-colors" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Email <span className="text-slate-400 font-normal">(optional)</span></label>
                        <input type="email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} placeholder="Optional" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-[#0056d6] focus:ring-1 focus:ring-[#0056d6] outline-none transition-colors" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Address <span className="text-slate-400 font-normal">(optional)</span></label>
                      <input type="text" value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} placeholder="Home or business address" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-[#0056d6] focus:ring-1 focus:ring-[#0056d6] outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Opening Balance (Rs)</label>
                      <input type="number" value={newCustomer.openingBalance} onChange={e => setNewCustomer({...newCustomer, openingBalance: e.target.value})} placeholder="0" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-[#0056d6] focus:ring-1 focus:ring-[#0056d6] outline-none transition-colors" />
                      <p className="text-[9px] text-slate-500 mt-1">Initial debt balance before current transaction</p>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button onClick={() => setShowAddCustomerForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-700 text-sm hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleSaveNewCustomer} className="flex-1 py-2.5 rounded-xl bg-[#0056d6] text-white font-bold text-sm hover:bg-[#0047b3] transition-colors shadow-sm">
                        Save Customer
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Customer Search Dropdown */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Search customer name or phone..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setShowCustomerDropdown(true);
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:border-[#0056d6] focus:ring-1 focus:ring-[#0056d6] outline-none"
                      />
                      {showCustomerDropdown && customerSearch.length > 0 && customerResults && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                          {customerResults.length > 0 ? (
                            customerResults.map(c => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setSelectedCustomer(c);
                                  setCustomerSearch(c.name);
                                  setShowCustomerDropdown(false);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex flex-col"
                              >
                                <span className="font-bold text-slate-800 text-sm">{c.name}</span>
                                <span className="text-xs text-slate-500">{c.phone}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-slate-500 text-center">No customers found</div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {selectedCustomer ? (
                      (() => {
                        const prevBal = customerBalance?.balance || 0;
                        const currentTotal = totalAmount;
                        const totalOwed = prevBal + currentTotal;
                        const currentPaid = isSplitPayment 
                          ? splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
                          : parseFloat(amountPaying) || 0;
                        const newBal = totalOwed - currentPaid;
                      
                        return (
                          <div className="bg-white border border-[#0056d6] rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                              <div>
                                <p className="font-bold text-slate-900 text-lg">{selectedCustomer.name}</p>
                                <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>
                              </div>
                              <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50">
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between text-slate-600">
                                <span>Previous Balance:</span>
                                <span className="font-bold">{formatCurrency(Math.abs(prevBal), currency)} {prevBal > 0 ? 'Dr' : (prevBal < 0 ? 'Cr' : '')}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>Current Bill:</span>
                                <span className="font-bold">{formatCurrency(currentTotal, currency)}</span>
                              </div>
                              <div className="flex justify-between text-slate-900 border-t border-slate-100 pt-2">
                                <span className="font-bold">Total Owed:</span>
                                <span className="font-bold">{formatCurrency(totalOwed, currency)}</span>
                              </div>
                              <div className="flex justify-between text-emerald-600">
                                <span>Amount Paying:</span>
                                <span className="font-bold">-{formatCurrency(currentPaid, currency)}</span>
                              </div>
                              <div className="flex justify-between text-[#0056d6] border-t border-slate-100 pt-2 font-bold">
                                <span>New Balance:</span>
                                <span>{formatCurrency(Math.abs(newBal), currency)} {newBal > 0 ? 'Due' : (newBal < 0 ? 'Advance' : '')}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <button onClick={() => setShowAddCustomerForm(true)} className="w-full py-3 border border-dashed border-[#0056d6] text-[#0056d6] rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                        <Plus className="h-4 w-4" /> Add New Customer
                      </button>
                    )}
                  </>
                )}

              </div>

              {/* Right Side: Payment Details */}
              <div className="flex-1 space-y-6">
                {isSplitPayment ? (
                  <div className="space-y-4">
                    <button onClick={() => setIsSplitPayment(false)} className="w-full py-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 flex items-center justify-center gap-2 shadow-sm transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                      Cancel Split Payment
                    </button>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                        <h3 className="text-sm font-bold text-slate-700">Split Allocation</h3>
                        <span className="text-sm font-bold text-slate-500">Target: {formatCurrency(totalAmount, currency)}</span>
                      </div>
                      
                      <div className="space-y-3">
                        {splits.map((split, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <select 
                              value={split.method} 
                              onChange={e => {
                                const newSplits = [...splits];
                                newSplits[idx].method = e.target.value;
                                setSplits(newSplits);
                              }}
                              className="w-[100px] p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:border-[#0056d6] focus:ring-1 focus:ring-[#0056d6] outline-none"
                            >
                              <option value="Cash">Cash</option>
                              <option value="Card">Card</option>
                              <option value="Wallet">Wallet</option>
                              <option value="Credit">Credit</option>
                            </select>
                            <div className="flex-1 relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-900">{currency}</span>
                              <input 
                                type="number" 
                                value={split.amount}
                                onChange={e => {
                                  const newSplits = [...splits];
                                  newSplits[idx].amount = e.target.value;
                                  setSplits(newSplits);
                                }}
                                className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:border-[#0056d6] focus:ring-1 focus:ring-[#0056d6] outline-none"
                              />
                            </div>
                            <button 
                              onClick={() => {
                                if (splits.length > 1) {
                                  setSplits(splits.filter((_, i) => i !== idx));
                                }
                              }} 
                              className={`w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 transition-colors ${splits.length > 1 ? 'text-slate-500 hover:text-red-500 hover:bg-red-50' : 'text-slate-300 cursor-not-allowed opacity-50'}`}
                              disabled={splits.length <= 1}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      <button 
                        onClick={() => setSplits([...splits, { method: 'Cash', amount: '' }])} 
                        className="w-full mt-4 py-2 border border-dashed border-slate-300 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="h-4 w-4" /> Add Payment Method
                      </button>

                      {/* Footer Calculation */}
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-600">Total Allocated:</span>
                          <span className="text-sm font-bold text-slate-900">{formatCurrency(splits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0), currency)}</span>
                        </div>
                        
                        {(() => {
                          const sum = splits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
                          if (sum === totalAmount) {
                            return (
                              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <span className="text-xs font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Split Complete</span>
                                <span className="text-xs font-bold">Allocated perfectly</span>
                              </div>
                            );
                          } else if (sum > totalAmount) {
                            return (
                              <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">
                                <span className="text-xs font-bold flex items-center gap-1"><X className="h-3 w-3" /> Over Allocated</span>
                                <span className="text-xs font-bold">{formatCurrency(sum - totalAmount, currency)} excess</span>
                              </div>
                            );
                          } else {
                            return (
                              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="text-xs font-bold">Remaining to allocate</span>
                                <span className="text-xs font-bold">{formatCurrency(Math.max(0, totalAmount - sum), currency)}</span>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Payment Method</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {['Cash', 'Card', 'Wallet', 'Credit'].map(method => (
                          <button
                            key={method}
                            onClick={() => setPaymentMethod(method)}
                            className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all ${
                              paymentMethod === method 
                              ? 'border-[#0056d6] bg-blue-50 text-[#0056d6] ring-1 ring-[#0056d6]' 
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {method === 'Cash' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                            {method === 'Card' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                            {method === 'Wallet' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                            {method === 'Credit' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                            {method}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setIsSplitPayment(true)} className="w-full mt-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        Split Across Multiple Methods
                      </button>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cash Tendered</h3>
                      <input 
                        type="number"
                        value={amountPaying}
                        onChange={(e) => setAmountPaying(e.target.value)}
                        placeholder={totalAmount.toString()}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-lg font-bold focus:border-[#0056d6] focus:ring-1 focus:ring-[#0056d6] outline-none"
                      />
                      
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => setAmountPaying(totalAmount)} className="flex-1 py-2 rounded-lg bg-[#0056d6] text-white font-bold text-xs hover:bg-[#0047b3] transition-colors">
                          Exact ({formatCurrency(totalAmount, currency)})
                        </button>
                        <button onClick={() => setAmountPaying(5000)} className="flex-1 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors">
                          {formatCurrency(5000, currency)}
                        </button>
                      </div>
                      
                      <div className="mt-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-between">
                        <span className="font-bold text-emerald-800">Change Due:</span>
                        <span className="text-xl font-bold text-emerald-700">
                          {formatCurrency(Math.max(0, (Number(amountPaying) || 0) - totalAmount), currency)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
                
                <div className="pt-4 border-t border-dashed border-slate-300 flex items-center justify-between">
                  <span className="font-bold text-slate-600">Total Due</span>
                  <span className="text-2xl font-black text-slate-900">{formatCurrency(totalAmount, currency)}</span>
                </div>

              </div>
            </div>

            <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-end gap-3">
              <button onClick={() => setShowCheckout(false)} className="px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => { setShowCheckout(false); completeSaleLogic(); }} className="px-6 py-3 rounded-xl bg-[#0056d6] text-white font-bold hover:bg-[#0047b3] shadow-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5" /> Confirm & Print Receipt
              </button>
            </div>

            </div>
          </div>
        </div>
      )}

      {receiptOpen && receiptSale ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4 py-10">
            <div className={`mx-auto w-full ${receiptFormat === 'a4' ? 'max-w-5xl' : 'max-w-lg'} rounded-2xl bg-white p-6 shadow-2xl transition-all duration-300`}>
            <div className="mb-6 flex flex-col gap-4 border-b pb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Receipt Preview</h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setReceiptFormat('thermal')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${receiptFormat === 'thermal' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Thermal (80mm)</button>
                  <button onClick={() => setReceiptFormat('a4')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${receiptFormat === 'a4' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>A4 Invoice</button>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setReceiptOpen(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-all"
                >
                  Close
                </button>
                <button
                  onClick={printReceipt}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-md active:scale-95"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
              </div>
            </div>

            {/* THE RECEIPT CONTENT */}
            <div 
              ref={receiptRef} 
              className={`receipt-container bg-white text-slate-900 ${receiptFormat === 'a4' ? 'overflow-x-auto flex justify-center bg-slate-50 p-4 sm:p-6 border border-slate-200 shadow-inner rounded-xl' : ''}`}
              style={{ 
                fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                lineHeight: '1.4'
              }}
            >
              {receiptFormat === 'thermal' ? (
                <>
                  <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                      @page { size: 80mm auto; margin: 0; }
                      body { margin: 0; padding: 0; background: #fff !important; }
                      .receipt-container { width: 80mm; padding: 5mm; margin: 0 auto; color: #000 !important; border: none !important; }
                      .no-print { display: none !important; }
                      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                      .badge { border: 1px solid #000 !important; color: #000 !important; background: transparent !important; }
                    }
                    .receipt-container { padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; }
                  `}} />
                  <div className="text-center mb-6">
                    {settings?.logo ? (
                      <img src={settings.logo} alt="Logo" className="w-12 h-12 mx-auto object-contain mb-2 rounded-full" style={{ width: '48px', height: '48px' }} />
                    ) : (
                      <div className="mb-2 inline-flex items-center justify-center w-12 h-12 bg-slate-900 text-white rounded-xl font-bold text-xl">{settings?.shopName?.charAt(0) || 'S'}</div>
                    )}
                    <h1 className="text-xl font-extrabold uppercase tracking-tight">{settings?.shopName || 'Shop ERP'}</h1>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-relaxed">
                      {settings?.address && <span>{settings.address}<br /></span>}
                      {settings?.phone && <span>Ph: {settings.phone}</span>}
                    </p>
                    <div className="mt-3">
                      <span className="badge inline-block px-3 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-bold uppercase tracking-widest">PAID</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 mb-6 border-t border-b border-slate-100 py-4 text-[11px]">
                    <div>
                      <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-0.5">Order Number</p>
                      <p className="font-bold text-slate-800">INV-{receiptSale.id?.toString().padStart(5, '0')}</p>
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
                  {receiptCustomer && receiptSale.previousBalance !== undefined && (
                    <div className="mb-4 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                      <span className="text-slate-500">Prev Bal: </span>
                      <span className="font-bold text-slate-800">{formatCurrency(Math.abs(receiptSale.previousBalance), currency)} {(receiptSale.previousBalance||0) > 0 ? 'Dr' : ((receiptSale.previousBalance||0) < 0 ? 'Cr' : '')}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    <span>Description</span>
                    <span>Amount</span>
                  </div>
                  <div className="space-y-4 mb-6">
                    {receiptSale.items.map((item) => (
                      <div key={item.productId} className="flex justify-between items-start group">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-900 mb-0.5">{item.productName}</p>
                          <div className="flex flex-col text-[10px] text-slate-500">
                            <span>{item.qty} x {formatCurrency(item.unitPrice, currency)}</span>
                          </div>
                        </div>
                        <p className="text-xs font-bold text-slate-900">{formatCurrency(item.subtotal, currency)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 border-t border-slate-100 pt-4 mb-4">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(receiptSale.items.reduce((sum, item) => sum + item.subtotal, 0), currency)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Discount</span>
                      <span className="font-semibold text-red-500">-{formatCurrency(receiptSale.discount, currency)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 border-t-2 border-slate-900 mt-2">
                      <span className="text-[10px] font-black uppercase tracking-tighter">Grand Total</span>
                      <span className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(receiptSale.totalAmount, currency)}</span>
                    </div>
                    {receiptCustomer && (
                      <div className="flex justify-between text-[11px] mt-2 text-[#0056d6] font-bold">
                        <span>New Balance</span>
                        <span>{formatCurrency(Math.abs(receiptSale.newBalance || 0), currency)} {(receiptSale.newBalance||0) > 0 ? 'Due' : ((receiptSale.newBalance||0) < 0 ? 'Advance' : '')}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-8 text-center border-t border-slate-100 pt-6">
                    <p className="text-[10px] font-bold text-slate-800">Thank you for your business!</p>
                    <p className="text-[9px] text-slate-400 mt-1 italic mb-4">Software by Offline Shop ERP</p>
                    <div className="flex justify-center w-full overflow-hidden">
                      <Barcode value={`INV-${receiptSale.id?.toString().padStart(5, '0')}`} width={1.5} height={40} displayValue={true} fontSize={12} margin={0} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                      @page { size: A4; margin: 15mm; }
                      body { margin: 0; padding: 0; background: #fff !important; }
                      .receipt-container { width: 100% !important; max-width: none !important; padding: 0 !important; border: none !important; color: #000 !important; background: #fff !important; box-shadow: none !important; display: block !important; }
                      .no-print { display: none !important; }
                      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                  `}} />
                  <div className="bg-white shadow-md shrink-0 border border-slate-200">
                    <CustomerA4Invoice
                      sale={receiptSale}
                      customer={receiptCustomer}
                      amountPaid={receiptAmountPaid}
                      settings={settings}
                      currency={currency}
                      businessColor={businessColor}
                    />
                  </div>
                </>
              )}
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
        open={confirmFreeSale}
        title="Free Sale Confirmation"
        description="Total is Rs 0 after discount. Complete this as a free sale?"
        confirmText="Complete Sale"
        cancelText="Cancel"
        onCancel={() => setConfirmFreeSale(false)}
        onConfirm={handleConfirmFreeSale}
      />

      

      

      
    </div>
  );
}

