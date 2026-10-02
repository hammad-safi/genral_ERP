import { api } from '@/lib/api';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useApiPagination } from '@/hooks/useApiPagination';
import { Search, Trash2, Printer, CheckCircle, ShoppingCart, Plus, BookOpen } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import PageHeader from '@/components/PageHeader';
import StatsCard from '@/components/StatsCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import BulkDeleteBar from '@/components/BulkDeleteBar';

import { formatCurrency, formatDate, removeLeadingZeros, forceRepaintAfterRender } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useDebounce } from '@/hooks/useDebounce';
import { useBusiness } from '@/contexts/BusinessContext';

import GlobalTable from '@/components/GlobalTable';
import GlobalSearch from '@/components/GlobalSearch';
import GlobalButton from '@/components/GlobalButton';
import RowsDropdown from '@/components/RowsDropdown';
import ColumnVisibilityDropdown from '@/components/ColumnVisibilityDropdown';

import Barcode from 'react-barcode';
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
  
  const [matchingCustomerIds, setMatchingCustomerIds] = useState([]);

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!debouncedHistorySearchQuery) {
        setMatchingCustomerIds([]);
        return;
      }
      
      const term = debouncedHistorySearchQuery.toLowerCase();
      const customers = await db.customers.filter(c => c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term))).toArray();
      setMatchingCustomerIds(customers.map(c => c.id));
    };
    fetchCustomers();
  }, [debouncedHistorySearchQuery]);

  

  

  const [limit, setLimit] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [fromDate, toDate, debouncedHistorySearchQuery, limit]);

  const { data: visibleData, totalItems: totalCount, loading: isLoading, refresh: refreshSales, setPageIndex } = useApiPagination({
    endpoint: '/api/sales',
    pageSize: limit,
    search: debouncedHistorySearchQuery,
    fromDate,
    toDate
  });

  const [stats, setStats] = useState({ totalSales: 0, totalRevenue: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.getSales();
        const summary = res.summary || {};
        setStats({ totalSales: summary.totalCount || 0, totalRevenue: summary.totalAmount || 0 });
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();
  }, [totalCount]);

  const { selectedIds: selectedSalesIds, isSelected: isSalesSelected, toggleOne: toggleSaleOne, toggleAll: toggleSalesAll, clearSelection: clearSalesSelection, isAllSelected: isAllSalesSelected, selectedCount: selectedSalesCount } = useMultiSelect(visibleData);

  const performBulkDeleteSales = async () => {
    if (selectedSalesIds.length === 0) return;
    setIsDeleting(true);
    try {
      await api.deleteSalesBulk(selectedSalesIds);
      clearSalesSelection();
      refreshSales();
      onSuccess('Sales deleted successfully');
    } catch (error) {
      console.error('Error deleting sales:', error);
      onSuccess('Failed to delete sales');
    } finally {
      setIsDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const debouncedCustomerSearch = useDebounce(customerSearch, 300);

    
  const [searchResults, setSearchResults] = useState([]);
  useEffect(() => {
    const fetchSearch = async () => {
      try {
        const query = debouncedSearchQuery ? `?search=${encodeURIComponent(debouncedSearchQuery)}` : '';
        const res = await api.getProducts({ search: debouncedSearchQuery });
        if (res?.data?.data) {
          setSearchResults(res.data.data.slice(0, 20));
        } else {
          setSearchResults([]);
        }
      } catch (e) {
        console.error(e);
        setSearchResults([]);
      }
    };
    fetchSearch();
  }, [debouncedSearchQuery]);


  
  const [customerResults, setCustomerResults] = useState([]);
  useEffect(() => {
    const fetchCustomers = async () => {
      if (!debouncedCustomerSearch || debouncedCustomerSearch.length < 1) {
        setCustomerResults([]);
        return;
      }
      try {
        const query = debouncedCustomerSearch ? `?search=${encodeURIComponent(debouncedCustomerSearch)}` : '';
        const res = await api.getCustomers({ search: debouncedCustomerSearch });
        if (res?.data?.data) {
          setCustomerResults(res.data.data.slice(0, 10));
        } else {
          setCustomerResults([]);
        }
      } catch (e) {
        console.error(e);
        setCustomerResults([]);
      }
    };
    fetchCustomers();
  }, [debouncedCustomerSearch]);


  useEffect(() => {
    
    const loadInitialData = async () => {
      try {
        const inventoryData = await api.getInventory();
        setInventory(inventoryData || []);
      } catch (e) {
        setInventory([]);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    const loadBalance = async () => {
      if (!selectedCustomer?.id) {
        setCustomerBalance(null);
        return;
      }
      
      
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

    
    
    let product = null;
    try {
      const res = await api.getProducts({ search: barcode });
      if (res?.data?.data?.length > 0) {
        product = res.data.data.find(p => p.barcode === barcode);
      }
    } catch(e) {}

    if (!product) {
      setScanFeedback({ msg: `Î“Â£Ã¹ No product found for barcode: ${barcode}`, type: 'error' });
      setBarcodeValue('');
      barcodeRef.current?.focus();
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }


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
    try {
      const saleDate = new Date().toISOString();
      const sale = {
        businessId: business?.id,
        date: saleDate,
        customerId: selectedCustomer?.id ?? null,
        subtotal: Number(cartSubtotal.toFixed(2)),
        discount: Number(discount) || 0,
        total: Number(totalAmount.toFixed(2)),
        paid: Number(parseFloat(amountPaying) || 0),
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: item.qty || item.cartQuantity || 1,
          price: item.price,
          subtotal: item.price * (item.qty || item.cartQuantity || 1)
        }))
      };

      const res = await api.createSale(sale);
      const newSaleId = res?.data?.id || res?.id || crypto.randomUUID();
      
      setReceiptSale({ ...sale, id: newSaleId });
      setReceiptCustomer(selectedCustomer);
      setReceiptAmountPaid(parseFloat(amountPaying) || 0);
      setReceiptOpen(true);
      
      setCart([]);
      setDiscount('');
      setAmountPaying('');
      setSelectedCustomer(null);
      setCustomerSearch('');
      setCustomerBalance(null);
      setPaymentMethod('Cash');
      
      onSuccess('Sale completed successfully');
      refreshSales();
    } catch (e) {
      console.error(e);
      onSuccess('Failed to complete sale');
    }
  };

  const completeSale = async () => {
    if (totalAmount === 0 && cart.length > 0) {
      setConfirmFreeSale(true);
      return;
    }
    await completeSaleLogic();
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
    if (!saleToReturn) return;
    try {
      await api.deleteSale(saleToReturn.id);
      
      setReturnModalOpen(false);
      setSaleToReturn(null);
      setReturnReason('');
      
      onSuccess('Sale returned successfully');
      refreshSales();
    } catch (e) {
      console.error(e);
      onSuccess('Failed to return sale');
    }
  };

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

  const optionalColumns = ['Invoice No.', 'Barcode', 'Items', 'Customer'];
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('sales_visible_columns');
      return saved ? JSON.parse(saved) : optionalColumns;
    } catch {
      return optionalColumns;
    }
  });

  const toggleColumn = (col) => {
    setVisibleCols(prev => {
      const next = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem('sales_visible_columns', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        icon={ShoppingCart}
        title="Sales Management"
        description="Review transaction history, print receipts, and manage customer sales."
        action={
          <GlobalButton
            icon={Printer}
            onClick={printSalesReport}
            variant="outline"
          >
            Print Sales Report
          </GlobalButton>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <StatsCard 
          title="Total Sales" 
          value={stats.totalSales.toString()} 
          description="Recorded sale transactions" 
          color="blue" 
          icon={ShoppingCart} 
          arrow="forward"
        />
        <StatsCard 
          title="Total Revenue" 
          value={formatCurrency(stats.totalRevenue, currency)} 
          description="Total value of all sales" 
          color="emerald" 
          icon={CheckCircle} 
          arrow="forward"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              <div className="max-w-md w-full">
                <GlobalSearch
                  value={historySearchQuery}
                  onChange={setHistorySearchQuery}
                  placeholder="Search sales history..."
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm transition-all hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">From</span>
                <input 
                  type="date" 
                  value={fromDate} 
                  onChange={e => setFromDate(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-700 outline-none border-none focus:ring-0 p-0 w-[115px] cursor-pointer" 
                />
              </div>
              <span className="text-slate-300 font-bold hidden sm:inline">-</span>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm transition-all hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">To</span>
                <input 
                  type="date" 
                  value={toDate} 
                  onChange={e => setToDate(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-700 outline-none border-none focus:ring-0 p-0 w-[115px] cursor-pointer" 
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0 justify-end pr-1">
              <ColumnVisibilityDropdown
                columns={optionalColumns}
                visibleCols={visibleCols}
                toggleColumn={toggleColumn}
              />
            </div>
          </div>
        </div>

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
                  checked={isAllSalesSelected}
                  onChange={toggleSalesAll}
                  className="w-4 h-4 rounded cursor-pointer"
                />
              ),
              className: "w-10",
            },
            { header: "Date" },
            ...(visibleCols.includes('Invoice No.') ? [{ header: "Invoice No." }] : []),
            ...(visibleCols.includes('Barcode') ? [{ header: "Barcode" }] : []),
            ...(visibleCols.includes('Items') ? [{ header: "Items" }] : []),
            ...(visibleCols.includes('Customer') ? [{ header: "Customer" }] : []),
            { header: "Total" },
            { header: "Actions" },
          ];

          return (
            <div className="mt-2">
              <GlobalTable onLoadMore={() => setPageIndex(p => p + 1)} hasMore={visibleData.length < totalCount}
                data={visibleData}
                columns={tableColumns}
                renderRow={(sale, virtualIndex, measureRef) => {
                  const rowBg = virtualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                  return (
                    <tr
                      key={sale.id}
                      ref={measureRef}
                      data-index={virtualIndex}
                      className={`border-b border-slate-200 transition-colors ${isSalesSelected(sale.id) ? 'bg-red-50 hover:bg-red-50/80' : `hover:bg-slate-100 ${rowBg}`}`}
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
                      {visibleCols.includes('Invoice No.') && (
                        <td className="py-3 px-4 text-sm font-medium">
                          INV-{sale.id?.toString().padStart(5, '0')}
                        </td>
                      )}
                      {visibleCols.includes('Barcode') && (
                        <td className="py-3 px-4 text-sm font-medium">
                          {sale.id?.toString().padStart(8, '0')}
                        </td>
                      )}
                      {visibleCols.includes('Items') && (
                        <td className="py-3 px-4 text-sm">
                          {sale.items?.length ?? 0} item(s)
                          <br />
                          <span className="text-xs text-slate-400">
                            {sale.items?.map((item) => item.productName).join(', ')}
                          </span>
                        </td>
                      )}
                      {visibleCols.includes('Customer') && (
                        <td className="py-3 px-4 text-sm">{sale.customerName}</td>
                      )}
                      <td className="py-3 px-4 text-sm font-medium">{formatCurrency(sale.totalAmount, currency)}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setViewSale(sale)}
                            className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 hover:bg-blue-100 transition-colors"
                            title="View"
                          >
                            <BookOpen className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => returnSale(sale)}
                            className={`rounded-lg border p-2 transition-colors ${sale.returned ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'}`}
                            disabled={sale.returned}
                            title={sale.returned ? 'Returned' : 'Return'}
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
                    No sales found
                  </div>
                }
              />
              
              
            </div>
          );
        }, [visibleData, currentPage, limit, totalCount, isLoading, isAllSalesSelected, selectedSalesIds])}
      </section>

      {viewSale && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md my-8 shadow-xl">
            <h3 className="font-bold text-lg mb-4">Sale Details</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date:</span>
                <span>{new Date(viewSale.date).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Return status:</span>
                <span className={viewSale.returned ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                  {viewSale.returned ? 'Returned' : 'Active'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Customer:</span>
                <span>{viewSale.customerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Payment:</span>
                <span>{viewSale.paymentMethod}</span>
              </div>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[40vh] rounded-xl border border-slate-200 mb-4">
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="bg-slate-50">
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
                Print Receipt
              </button>
              <button
                onClick={() => {
                  if (!viewSale.returned) returnSale(viewSale);
                }}
                className={`flex-1 py-2 rounded-lg text-sm ${viewSale.returned ? 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200' : 'bg-red-500 text-white hover:bg-red-600'}`}
                disabled={viewSale.returned}
              >
                {viewSale.returned ? 'Already Returned' : 'Make Return'}
              </button>
              <button onClick={() => setViewSale(null)}
                className="flex-1 border py-2 rounded-lg text-sm">
                Close
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {receiptOpen && receiptSale ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4 py-10">
            <div className="mx-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
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
                        <span>{item.qty} x {formatCurrency(item.unitPrice, currency)}</span>
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
                <p className="text-[9px] text-slate-400 mt-1 italic mb-4">Software by Offline Shop ERP</p>
                <div className="flex justify-center w-full overflow-hidden">
                  <Barcode value={`INV-${receiptSale.id?.toString().padStart(5, '0')}`} width={1.5} height={40} displayValue={true} fontSize={12} margin={0} />
                </div>
              </div>
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
        onDelete={() => setConfirmBulkDelete(true)}
        onCancel={clearSalesSelection}
        itemLabel="sale"
        isDeleting={isDeleting}
      />
    </div>
  );
}

