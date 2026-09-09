import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Filter, Trash2, BookOpen, X } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { initDB, getDB } from '@/lib/db';
import { formatDate, forceRepaintAfterRender, removeLeadingZeros, formatCurrency } from '@/lib/utils';
import { useBusiness } from '@/contexts/BusinessContext';
import { useDexieOffsetPagination } from '@/hooks/useDexiePagination';
import GlobalFilter from '@/components/GlobalFilter';
import GlobalSearch from '@/components/GlobalSearch';
import GlobalTable from '@/components/GlobalTable';
import RowsDropdown from '@/components/RowsDropdown';
import { useDebounce } from '@/hooks/useDebounce';
import { useSettings } from '@/hooks/useSettings';
import CustomSelect from '@/components/CustomSelect';
import ColumnVisibilityDropdown from '@/components/ColumnVisibilityDropdown';
import { useLiveQuery } from 'dexie-react-hooks';

export default function Inventory() {
  const { businessColor } = useBusiness();
  const settings = useSettings();
  const categoriesList = useLiveQuery(() => getDB().categories.toArray(), []) || [];
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ quantity: '', note: '', type: 'add' });
  const [adjustmentError, setAdjustmentError] = useState('');
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);
  const [viewBatchesProduct, setViewBatchesProduct] = useState(null);
  const [productBatches, setProductBatches] = useState([]);

  // Column visibility state persisted in localStorage
  const optionalColumns = ['Category', 'Subcategory', 'Sub-Subcategory', 'Current Stock', 'Unit', 'Expiry', 'Low Threshold', 'Status'];
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('inventory_visible_columns');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return optionalColumns; // all visible by default
  });

  useEffect(() => {
    localStorage.setItem('inventory_visible_columns', JSON.stringify(visibleCols));
  }, [visibleCols]);

  const toggleColumn = useCallback((col) => {
    setVisibleCols(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  }, []);

  // Reset modal state when business changes (prevents stale state in Electron)
  useEffect(() => {
    return () => {
      setAdjustOpen(false);
      setConfirmDelete(false);
      setSelectedItem(null);
      setDeleteItemId(null);
      setAdjustForm({ quantity: '', note: '', type: 'add' });
      setAdjustmentError('');
    };
  }, []);

  const [limit, setLimit] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [searchProductIds, setSearchProductIds] = useState(null);
  const [inventoryStats, setInventoryStats] = useState({ total: 0, healthy: 0, low: 0, out: 0 });


  // Fetch search product IDs based on search, category, and expiry
  useEffect(() => {
    let isMounted = true;
    const fetchSearch = async () => {
      const hasSearch = !!debouncedSearch;
      const hasCat = categoryFilter !== 'All';
      const hasExp = expiryFilter !== 'all';
      
      if (!hasSearch && !hasCat && !hasExp) {
        if (isMounted) setSearchProductIds(null);
        return;
      }
      
      try {
        const db = getDB();
        const today = new Date();
        const warningDate = new Date();
        warningDate.setDate(today.getDate() + 30);
        
        const matchingProducts = await db.products.filter(p => {
          if (hasSearch) {
            const term = debouncedSearch.toLowerCase();
            const nameMatch = p.name?.toLowerCase().includes(term);
            const barcodeMatch = p.barcode?.toLowerCase().includes(term);
            if (!nameMatch && !barcodeMatch) return false;
          }
          if (hasCat) {
            let matches = p.category === categoryFilter || p.category === Number(categoryFilter);
            if (!matches) {
              let currId = p.category;
              let safeCount = 0;
              while (currId && safeCount < 20) {
                const cat = categoriesList.find(c => c.id === currId || c.id === Number(currId));
                if (!cat) break;
                if (cat.parentId === categoryFilter || cat.parentId === Number(categoryFilter) || Number(cat.parentId) === Number(categoryFilter)) {
                  matches = true;
                  break;
                }
                currId = cat.parentId ? Number(cat.parentId) : null;
                safeCount++;
              }
            }
            if (!matches) return false;
          }
          
          if (hasExp) {
            if (!p.expiryDate) return false;
            const expDate = new Date(p.expiryDate);
            if (expiryFilter === 'expired') {
              if (expDate >= today) return false;
            } else if (expiryFilter === 'near') {
              if (expDate < today || expDate > warningDate) return false;
            }
          }
          return true;
        }).toArray();
        
        if (isMounted) setSearchProductIds(matchingProducts.map(p => p.id));
      } catch (err) {}
    };
    fetchSearch();
    return () => { isMounted = false; };
  }, [debouncedSearch, categoryFilter, expiryFilter, categoriesList]);

  useEffect(() => { setCurrentPage(1); }, [filter, categoryFilter, expiryFilter, limit, debouncedSearch]);

  const queryBuilder = useCallback((db) => {
    // If search is active but no products matched, return empty filter
    if (searchProductIds !== null && searchProductIds.length === 0) {
      return db.inventory.filter(() => false);
    }
    
    return db.inventory.orderBy('id').reverse().filter((item) => {
      if (searchProductIds !== null && !searchProductIds.includes(item.productId)) return false;
      if (filter === 'out') return item.quantity <= 0;
      if (filter === 'low') return item.quantity <= item.lowStockThreshold || item.quantity <= 0;
      return true;
    });
  }, [filter, searchProductIds]);

  const transformChunk = useCallback(async (chunk) => {
    const currentDB = getDB();
    const productIds = chunk.map(i => i.productId);
    
    // Only fetch the products needed for this chunk, eliminating RAM bottleneck!
    const productsData = await currentDB.products.where('id').anyOf(productIds).toArray();
    
    const today = new Date();
    const warningDate = new Date();
    warningDate.setDate(today.getDate() + 30);

    return chunk.map((item) => {
      const product = productsData.find((p) => p.id === item.productId);
      const expDate = product?.expiryDate ? new Date(product.expiryDate) : null;
      let expiryStatus = 'ok';
      if (expDate) {
        if (expDate < today) expiryStatus = 'expired';
        else if (expDate <= warningDate) expiryStatus = 'warning';
      }
      return {
        ...item,
        productName: product?.name ?? 'Unknown',
        productCategory: product?.category ?? null,
        unit: product?.unit ?? '',
        expiryDate: product?.expiryDate || '',
        expiryStatus,
        status: item.quantity <= 0 ? 'Out' : item.quantity <= item.lowStockThreshold ? 'Low' : 'OK'
      };
    }).filter(item => item.productName !== 'Unknown');
  }, []);

  const { data: visibleData, totalCount, isLoading, refresh: refreshInventory } = useDexieOffsetPagination(
    queryBuilder, 
    [filter, searchProductIds], 
    currentPage, 
    limit, 
    transformChunk
  );

  // Compute stats
  useEffect(() => {
    let isMounted = true;
    const computeStats = async () => {
      try {
        const db = getDB();
        const allInventory = await db.inventory.toArray();
        let total = allInventory.length;
        let healthy = 0;
        let low = 0;
        let out = 0;

        allInventory.forEach(item => {
          if (item.quantity <= 0) out++;
          else if (item.quantity <= (item.lowStockThreshold || 10)) low++;
          else healthy++;
        });

        if (isMounted) setInventoryStats({ total, healthy, low, out });
      } catch (err) { }
    };
    computeStats();
    return () => { isMounted = false; };
  }, [visibleData]); // Refresh stats when inventory changes

  const handleAdjust = async (item) => {
    setSelectedItem(item);
    setAdjustForm({ quantity: '', note: '', type: 'add', batchId: '' });
    const currentDB = getDB();
    const batches = await currentDB.productBatches.where('productId').equals(item.productId).toArray();
    setProductBatches(batches);
    setAdjustOpen(true);
  };

  const handleViewBatches = async (item) => {
    const currentDB = getDB();
    const batches = await currentDB.productBatches.where('productId').equals(item.productId).toArray();
    
    // Sort batches nicely
    batches.sort((a, b) => {
        if (a.expiryDate && !b.expiryDate) return -1;
        if (!a.expiryDate && b.expiryDate) return 1;
        if (a.expiryDate && b.expiryDate) return new Date(a.expiryDate) - new Date(b.expiryDate);
        return new Date(a.createdAt) - new Date(b.createdAt);
    });

    setProductBatches(batches);
    setViewBatchesProduct(item);
  };

  const saveAdjustment = async () => {
    if (!selectedItem) return;
    setAdjustmentError(''); // Clear previous error
    
    if (adjustForm.type === 'subtract' && !adjustForm.batchId) {
      setAdjustmentError('Please select a batch to subtract from.');
      return;
    }

    const currentDB = getDB();
    
    // Check if trying to subtract more than available in the batch
    if (adjustForm.type === 'subtract') {
      const selectedBatch = await currentDB.productBatches.get(Number(adjustForm.batchId));
      if (!selectedBatch || adjustForm.quantity > selectedBatch.quantity) {
        setAdjustmentError(`Cannot subtract more than current stock in selected batch (${selectedBatch?.quantity || 0})`);
        return;
      }
    }

    const quantityChange = adjustForm.type === 'add' ? adjustForm.quantity : -adjustForm.quantity;
    const newQuantity = Math.max(0, selectedItem.quantity + quantityChange);
    
    // 1. Update master inventory
    await currentDB.inventory.update(selectedItem.id, {
      quantity: Number(newQuantity),
      lastUpdated: new Date().toISOString(),
    });

    // 2. Update Batches
    if (adjustForm.batchId) {
      const selectedBatch = await currentDB.productBatches.get(Number(adjustForm.batchId));
      if (selectedBatch) {
        await currentDB.productBatches.update(selectedBatch.id, {
          quantity: Math.max(0, selectedBatch.quantity + quantityChange)
        });
      }
    } else if (adjustForm.type === 'add') {
      // Create a generic manual batch
      await currentDB.productBatches.add({
        productId: selectedItem.productId,
        batchNumber: `ADJ-${new Date().getTime().toString().slice(-6)}`,
        quantity: adjustForm.quantity,
        costPrice: 0,
        expiryDate: null,
        createdAt: new Date().toISOString()
      });
    }
    
    refreshInventory();
    setAdjustOpen(false);
    setAdjustmentError('');
  };

  const deleteInventoryItem = async () => {
    if (!deleteItemId) return;
    const idToDelete = deleteItemId;
    const currentDB = getDB();
    try {
      await currentDB.inventory.delete(idToDelete);
      refreshInventory();
      setConfirmDelete(false);
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      return;
    }
    if (selectedItem && selectedItem.id === idToDelete) {
      setSelectedItem(null);
    }
    setDeleteItemId(null);
    setAdjustForm({ quantity: '', note: '', type: 'add' });
    forceRepaintAfterRender();
  };

  const tableColumns = [
    { header: "Product" },
    ...(visibleCols.includes('Category') ? [{ header: "Category" }] : []),
    ...(visibleCols.includes('Subcategory') ? [{ header: "Subcategory" }] : []),
    ...(visibleCols.includes('Sub-Subcategory') ? [{ header: "Sub-Subcategory" }] : []),
    ...(visibleCols.includes('Current Stock') ? [{ header: "Current Stock" }] : []),
    ...(visibleCols.includes('Unit') ? [{ header: "Unit" }] : []),
    ...(visibleCols.includes('Expiry') ? [{ header: "Expiry" }] : []),
    ...(visibleCols.includes('Low Threshold') ? [{ header: "Low Threshold" }] : []),
    ...(visibleCols.includes('Status') ? [{ header: "Status" }] : []),
    { header: "Actions" }
  ];

  const renderInventoryRow = (item, virtualIndex, measureRef) => {
    const status = item.quantity <= 0 ? 'Out' : item.quantity <= item.lowStockThreshold ? 'Low' : 'OK';
    const statusClass = status === 'Out' ? 'bg-red-100 text-red-700' : status === 'Low' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
    
    // Expiry status styling
    const expiryClass = item.expiryStatus === 'expired' ? 'bg-red-100 text-red-700 font-semibold' : 
                        item.expiryStatus === 'warning' ? 'bg-amber-100 text-amber-700 font-semibold' : 
                        'text-slate-700';
    const expiryText = item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '-';

    const rowBg = virtualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';

    let chain = [];
    let currId = item.productCategory;
    let safeCount = 0;
    while (currId && safeCount < 20) {
      const cat = categoriesList.find(c => c.id === currId || c.id === Number(currId));
      if (!cat) break;
      chain.unshift(cat.name);
      currId = cat.parentId ? Number(cat.parentId) : null;
      safeCount++;
    }
    
    if (chain.length === 0 && item.productCategory) {
      chain = [item.productCategory]; // Fallback
    }

    return (
      <tr key={item.id} ref={measureRef} data-index={virtualIndex} className={`border-b border-slate-200 hover:bg-slate-100 transition-colors ${rowBg}`}>
        <td className="px-4 py-4 font-semibold text-slate-900">{item.productName}</td>
        
        {visibleCols.includes('Category') && (
          <td className="px-4 py-4 font-medium text-slate-700">
            {chain.length > 0 ? chain[0] : (chain.length === 0 && item.productCategory ? item.productCategory : '-')}
          </td>
        )}
        
        {visibleCols.includes('Subcategory') && (
          <td className="px-4 py-4 text-slate-600">
            {chain.length > 1 ? chain[1] : '-'}
          </td>
        )}
        
        {visibleCols.includes('Sub-Subcategory') && (
          <td className="px-4 py-4 text-slate-500">
            {chain.length > 2 ? chain[2] : '-'}
          </td>
        )}
        
        {visibleCols.includes('Current Stock') && (
          <td className="px-4 py-4 text-slate-700">{item.quantity}</td>
        )}
        
        {visibleCols.includes('Unit') && (
          <td className="px-4 py-4 text-slate-700">{item.unit}</td>
        )}
        
        {visibleCols.includes('Expiry') && (
          <td className="px-4 py-4">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${expiryClass}`}>
              {expiryText}
            </span>
          </td>
        )}
        
        {visibleCols.includes('Low Threshold') && (
          <td className="px-4 py-4 text-slate-700">{item.lowStockThreshold}</td>
        )}
        
        {visibleCols.includes('Status') && (
          <td className="px-4 py-4">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>{status}</span>
          </td>
        )}
        
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleViewBatches(item)}
              className="inline-flex h-[34px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <BookOpen className="h-4 w-4" />
              Batches
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(item)}
              className="inline-flex h-[34px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Adjust
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteItemId(item.id);
                setConfirmDelete(true);
              }}
              className="inline-flex h-[34px] items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors"
              title="Delete Inventory Record"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const tableContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
          <div className="flex items-center gap-6 flex-1 max-w-md">
            <GlobalSearch
              value={search}
              onChange={setSearch}
              placeholder="Search product name or barcode..."
              className="w-full"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2 pr-1">
            {(() => {
              const chain = [];
              let currId = categoryFilter === 'All' ? null : categoryFilter;
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
              
              while (i <= chain.length) {
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
                  <GlobalFilter
                    key={`cat-filter-level-${levelIndex}`}
                    options={[
                      {label: levelIndex === 0 ? 'All Categories' : 'All Subcats', value: 'All'},
                      ...opts
                    ]}
                    value={selectedVal}
                    onChange={(val) => {
                      if (val === 'All') {
                        setCategoryFilter(levelIndex === 0 ? 'All' : loopParentId);
                      } else {
                        setCategoryFilter(val);
                      }
                    }}
                    variant="select"
                  />
                );
                
                if (selectedVal === 'All') break;
                currentParentId = selectedVal;
                i++;
              }
              return levels;
            })()}
            <GlobalFilter
              options={[{label: 'All Expiry', value: 'all'}, {label: 'Near Expiry', value: 'near'}, {label: 'Expired', value: 'expired'}]}
              value={expiryFilter}
              onChange={setExpiryFilter}
              variant="select"
            />
            <GlobalFilter
              options={[{label: 'All stock', value: 'all'}, {label: 'Low stock', value: 'low'}, {label: 'Out of stock', value: 'out'}]}
              value={filter}
              onChange={setFilter}
              variant="select"
            />
            <ColumnVisibilityDropdown
              columns={optionalColumns}
              visibleCols={visibleCols}
              toggleColumn={toggleColumn}
            />
          </div>
        </div>
      </div>
    );
  }, [search, visibleCols, filter, toggleColumn, categoriesList, categoryFilter, expiryFilter]);

  const memoizedTable = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    
    // Generate page numbers
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
    const endItem = Math.min(currentPage * limit, totalCount);

    return (
      <div className="mt-2">
        <GlobalTable
          data={visibleData}
          columns={tableColumns}
          renderRow={renderInventoryRow}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <svg className="h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm">No inventory records found</p>
            </div>
          }
        />
        
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div>
              Showing <span className="font-bold text-slate-700">{startItem}</span> to <span className="font-bold text-slate-700">{endItem}</span> of <span className="font-bold text-slate-700">{totalCount}</span> items
            </div>
            <div className="h-3 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2">
              <span>Rows:</span>
              <RowsDropdown limit={limit} setLimit={setLimit} />
            </div>
            {isLoading && <span className="ml-2 animate-pulse text-emerald-500">Loading...</span>}
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
                      ? 'bg-emerald-50 text-emerald-600' 
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
  }, [visibleData, currentPage, limit, totalCount, isLoading, visibleCols, categoriesList]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Inventory Management</h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Items</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{inventoryStats.total}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Active inventory records</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Healthy Stock</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{inventoryStats.healthy}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Sufficient quantity</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Low Stock</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{inventoryStats.low}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Below threshold</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Out of Stock</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{inventoryStats.out}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Needs restock</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {tableContent}
        {memoizedTable}
      </div>



      {adjustOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-slate-900">Adjust Stock</h3>
            <p className="mt-2 text-sm text-slate-600">Update stock for the selected product and add a note.</p>
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Quantity</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    min={1}
                    value={adjustForm.quantity}
                    onChange={(event) => setAdjustForm((current) => ({ ...current, quantity: Number(removeLeadingZeros(event.target.value)) }))}
                    onFocus={e => e.target.select()}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Type</span>
                  <CustomSelect
                    value={adjustForm.type}
                    onChange={(val) => setAdjustForm((current) => ({ ...current, type: val }))}
                    options={[{label: 'Add stock', value: 'add'}, {label: 'Subtract stock', value: 'subtract'}]}
                    placeholder="Select action..."
                  />
                </label>
              </div>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Batch <span className="text-slate-400 font-normal">{adjustForm.type === 'add' ? '(Optional)' : '(Required)'}</span></span>
                <CustomSelect
                  value={adjustForm.batchId}
                  onChange={(val) => setAdjustForm((current) => ({ ...current, batchId: val }))}
                  options={productBatches.map(b => ({label: `${b.batchNumber} (Stock: ${b.quantity})`, value: b.id}))}
                  placeholder={adjustForm.type === 'add' ? 'Create new manual batch' : 'Select a batch...'}
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Note</span>
                <textarea
                  value={adjustForm.note}
                  onChange={(event) => setAdjustForm((current) => ({ ...current, note: event.target.value }))}
                  rows={3}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
                />
              </label>
              {adjustmentError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {adjustmentError}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={() => setAdjustOpen(false)} className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                  Cancel
                </button>
                <button onClick={saveAdjustment} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Save adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batches Modal */}
      {viewBatchesProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Batches: {viewBatchesProduct.productName}</h2>
              <button onClick={() => setViewBatchesProduct(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">Total Inventory Quantity: <span className="text-slate-900">{viewBatchesProduct.quantity}</span></span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Batch Number</th>
                      <th className="px-4 py-3 font-semibold">Quantity</th>
                      <th className="px-4 py-3 font-semibold">Cost Price</th>
                      <th className="px-4 py-3 font-semibold">Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {productBatches.map(batch => (
                      <tr key={batch.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{batch.batchNumber}</td>
                        <td className="px-4 py-3 text-slate-700">{batch.quantity}</td>
                        <td className="px-4 py-3 text-slate-700">{formatCurrency(batch.costPrice)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            batch.expiryDate && new Date(batch.expiryDate) < new Date() ? 'bg-red-50 text-red-700' : 
                            batch.expiryDate ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-700'
                          }`}>
                            {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {productBatches.length === 0 && (
                      <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-500 italic">No batch records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete inventory record"
        description="This will remove the inventory record. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => { setConfirmDelete(false); setDeleteItemId(null); }}
        onConfirm={deleteInventoryItem}
      />

    </div>
  );
}
