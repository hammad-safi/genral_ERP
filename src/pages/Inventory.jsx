import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Filter, Trash2, BookOpen, X, Package, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatsCard from '@/components/StatsCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDate, removeLeadingZeros, formatCurrency } from '@/lib/utils';
import { useBusiness } from '@/contexts/BusinessContext';
import { useApiPagination } from '@/hooks/useApiPagination';
import GlobalFilter from '@/components/GlobalFilter';
import GlobalSearch from '@/components/GlobalSearch';
import GlobalTable from '@/components/GlobalTable';
import RowsDropdown from '@/components/RowsDropdown';
import { useDebounce } from '@/hooks/useDebounce';
import { useSettings } from '@/hooks/useSettings';
import CustomSelect from '@/components/CustomSelect';
import ColumnVisibilityDropdown from '@/components/ColumnVisibilityDropdown';
import { clearPaginationCache } from '@/hooks/useApiPagination';

export default function Inventory() {
  const { businessColor } = useBusiness();
  const settings = useSettings();
  
  const [categoriesList, setCategoriesList] = useState([]);
  
  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategoriesList(d || []));
  }, []);

  const [selectedItem, setSelectedItem] = useState(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ quantity: '', note: '', type: 'add', batchId: '' });
  const [adjustmentError, setAdjustmentError] = useState('');
  
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expiryFilter, setExpiryFilter] = useState('all');
  
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);
  
  const [viewBatchesProduct, setViewBatchesProduct] = useState(null);
  const [productBatches, setProductBatches] = useState([]);

  const optionalColumns = ['Category', 'Subcategory', 'Sub-Subcategory', 'Current Stock', 'Unit', 'Expiry', 'Low Threshold', 'Status'];
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('inventory_visible_columns');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return optionalColumns;
  });

  useEffect(() => {
    localStorage.setItem('inventory_visible_columns', JSON.stringify(visibleCols));
  }, [visibleCols]);

  const toggleColumn = useCallback((col) => {
    setVisibleCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  }, []);

  useEffect(() => {
    return () => {
      setAdjustOpen(false);
      setConfirmDelete(false);
      setSelectedItem(null);
      setDeleteItemId(null);
      setAdjustForm({ quantity: '', note: '', type: 'add', batchId: '' });
      setAdjustmentError('');
    };
  }, []);

  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [inventoryStats, setInventoryStats] = useState({ total: 0, healthy: 0, low: 0, out: 0 });

  // Fetch aggregate stats
  useEffect(() => {
    let isMounted = true;
    fetch('/api/inventory/stats')
      .then(r => r.json())
      .then(d => {
        if (isMounted && d && !d.error) setInventoryStats(d);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [adjustOpen, confirmDelete]); // Refresh stats when modal closes

  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set('search', debouncedSearch);
  if (categoryFilter !== 'All') queryParams.set('category', categoryFilter);
  if (filter !== 'all') queryParams.set('filter', filter);
  if (expiryFilter !== 'all') queryParams.set('expiry', expiryFilter);
  
  const { data: visibleData, totalItems: totalCount, setPageIndex, pageSize, refresh, loading: tableLoading } = useApiPagination({
    endpoint: `/api/inventory?${queryParams.toString()}`,
    pageSize: limit,
   mode: 'infinite' });

  const handleAdjust = async (item) => {
    setSelectedItem(item);
    setAdjustForm({ quantity: '', note: '', type: 'add', batchId: '' });
    try {
      const res = await fetch(`/api/inventory/${item.productId}/batches`);
      const batches = await res.json();
      setProductBatches(batches);
      setAdjustOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleViewBatches = async (item) => {
    try {
      const res = await fetch(`/api/inventory/${item.productId}/batches`);
      const batches = await res.json();
      setProductBatches(batches);
      setViewBatchesProduct(item);
    } catch (e) {
      console.error(e);
    }
  };

  const saveAdjustment = async () => {
    if (!selectedItem) return;
    setAdjustmentError('');
    
    if (adjustForm.type === 'subtract' && !adjustForm.batchId) {
      setAdjustmentError('Please select a batch to subtract from.');
      return;
    }

    if (adjustForm.type === 'subtract') {
      const selectedBatch = productBatches.find(b => b.id === Number(adjustForm.batchId));
      if (!selectedBatch) {
        setAdjustmentError('Batch not found.');
        return;
      }
      if (selectedBatch.quantity < adjustForm.quantity) {
        setAdjustmentError(`Cannot subtract ${adjustForm.quantity}. Batch only has ${selectedBatch.quantity}.`);
        return;
      }
    }

    try {
      const payload = {
        productId: selectedItem.productId,
        type: adjustForm.type,
        quantity: Number(adjustForm.quantity),
        note: adjustForm.note,
        batchId: adjustForm.batchId ? Number(adjustForm.batchId) : null
      };

      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setAdjustOpen(false);
      clearPaginationCache('inventory');
      refresh();
    } catch (error) {
      setAdjustmentError(error.message || 'Failed to adjust stock');
    }
  };

  const deleteInventoryItem = async () => {
    if (!deleteItemId) return;
    try {
      await fetch(`/api/inventory/${deleteItemId}`, { method: 'DELETE' });
      setConfirmDelete(false);
      setDeleteItemId(null);
      clearPaginationCache('inventory');
      refresh();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const columns = useMemo(() => {
    const cols = [
      { key: 'productName', header: 'Product Name', sortable: false,
        render: (val, item) => (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900">{val || '-'}</span>
            {item.barcode && <span className="text-xs text-slate-500 font-mono mt-0.5">{item.barcode}</span>}
          </div>
        )
      },
    ];

    if (visibleCols.includes('Category')) {
      cols.push({
        key: 'category', header: 'Category', sortable: false,
        render: (val) => {
          if (!val) return <span className="text-slate-400 italic">None</span>;
          const cat = categoriesList.find(c => String(c.id) === String(val));
          return cat ? <span className="text-slate-700">{cat.name}</span> : <span className="text-slate-400 italic">Unknown</span>;
        }
      });
    }

    if (visibleCols.includes('Subcategory')) {
      cols.push({
        key: 'subcategory', header: 'Subcategory', sortable: false,
        render: (val) => {
          if (!val) return '-';
          const cat = categoriesList.find(c => String(c.id) === String(val));
          if (cat && cat.parentId) {
            const parent = categoriesList.find(c => String(c.id) === String(cat.parentId));
            return parent ? <span className="text-slate-700">{parent.name}</span> : '-';
          }
          return '-';
        }
      });
    }

    if (visibleCols.includes('Current Stock')) {
      cols.push({
        key: 'quantity', header: 'Current Stock', sortable: false,
        render: (val) => <span className="font-bold text-slate-900">{val}</span>
      });
    }
    
    if (visibleCols.includes('Unit')) {
      cols.push({ key: 'unit', header: 'Unit', sortable: false });
    }

    if (visibleCols.includes('Expiry')) {
      cols.push({
        key: 'expiryDate', header: 'Expiry', sortable: false,
        render: (val, item) => {
          if (!val) return <span className="text-slate-400 italic">None</span>;
          const statusColors = {
            'ok': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
            'warning': 'bg-amber-50 text-amber-700 ring-amber-600/20',
            'expired': 'bg-red-50 text-red-700 ring-red-600/20'
          };
          const color = statusColors[item.expiryStatus] || statusColors.ok;
          return (
            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${color}`}>
              {new Date(val).toLocaleDateString()}
            </span>
          );
        }
      });
    }

    if (visibleCols.includes('Low Threshold')) {
      cols.push({
        key: 'lowStockThreshold', header: 'Low Threshold', sortable: false,
        render: (val) => <span className="text-slate-600">{val || 10}</span>
      });
    }

    if (visibleCols.includes('Status')) {
      cols.push({
        key: 'status', header: 'Status', sortable: false,
        render: (val) => {
          const colors = {
            'OK': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
            'Low': 'bg-amber-50 text-amber-700 ring-amber-600/20',
            'Out': 'bg-red-50 text-red-700 ring-red-600/20'
          };
          const badgeColor = colors[val] || 'bg-slate-50 text-slate-700 ring-slate-600/20';
          return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${badgeColor}`}>
              {val === 'Low' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />}
              {val === 'Out' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />}
              {val === 'OK' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />}
              {val}
            </span>
          );
        }
      });
    }

    cols.push({
      key: 'actions', header: 'Actions', sortable: false, align: 'right',
      render: (_, item) => (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => handleViewBatches(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="View Batches">
            <BookOpen className="w-4 h-4" />
          </button>
          <button onClick={() => handleAdjust(item)} className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            Adjust
          </button>
          <button onClick={() => { setDeleteItemId(item.id); setConfirmDelete(true); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    });

    return cols;
  }, [visibleCols, categoriesList, handleViewBatches, handleAdjust]);

  const renderRow = useCallback((item, index, measureElement) => {
    if (!item) return <tr key={index} ref={measureElement} data-index={index}><td colSpan={columns.length} className="px-4 py-4 text-slate-400 italic">Loading...</td></tr>;
    return (
      <tr key={item.id || index} ref={measureElement} data-index={index} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
        {columns.map((col, idx) => (
          <td key={idx} className={`px-4 py-4 align-top ${col.align === 'right' ? 'text-right' : ''}`}>
            {col.render ? col.render(item[col.key], item) : item[col.key]}
          </td>
        ))}
      </tr>
    );
  }, [columns]);

    const tableContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
          <div className="flex items-center gap-6 flex-1">
            <GlobalSearch
              value={search}
              onChange={setSearch}
              placeholder="Search inventory..."
              className="w-full"
            />
          </div>
          
          <div className="flex items-center gap-2 pr-1">
            <GlobalFilter
              icon={Filter}
              label="Category"
              options={[
                { label: 'All Categories', value: 'All' },
                ...categoriesList.filter(c => !c.parentId).map(c => ({ label: c.name, value: c.id }))
              ]}
              value={categoryFilter}
              onChange={setCategoryFilter}
              variant="select"
            />
            <GlobalFilter
              icon={Filter}
              label="Stock Status"
              options={[
                { label: 'All Items', value: 'all' },
                { label: 'Low Stock', value: 'low' },
                { label: 'Out of Stock', value: 'out' }
              ]}
              value={filter}
              onChange={setFilter}
              variant="select"
            />
            <GlobalFilter
              icon={Filter}
              label="Expiry Status"
              options={[
                { label: 'All Items', value: 'all' },
                { label: 'Expired', value: 'expired' },
                { label: 'Expiring Soon (< 30 days)', value: 'near' }
              ]}
              value={expiryFilter}
              onChange={setExpiryFilter}
              variant="select"
            />
            
            
            <ColumnVisibilityDropdown
              columns={optionalColumns}
              visibleCols={visibleCols}
              toggleColumn={toggleColumn}
            />
          </div>
        </div>

        <GlobalTable onLoadMore={() => setPageIndex(p => p + 1)} hasMore={visibleData.length < totalCount}
          columns={columns}
          data={visibleData}
          
          renderRow={renderRow}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm">No inventory records found</p>
            </div>
          }
        />
      </div>
    );
  }, [
    search, categoryFilter, filter, expiryFilter, limit, visibleCols,
    categoriesList, columns, visibleData, renderRow, toggleColumn
  ]);

  return (
    <div className="space-y-6 pb-20">
      <PageHeader 
        icon={Package}
        title="Inventory Management"
        description="Monitor warehouse stock, adjust inventory levels, and track reorder thresholds."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Total Items" 
          value={inventoryStats.total.toLocaleString()} 
          description="Products in catalog" 
          color="blue" 
          icon={Package} 
          arrow="forward"
        />
        <StatsCard 
          title="Healthy Stock" 
          value={inventoryStats.healthy.toLocaleString()} 
          description="Above low threshold" 
          color="emerald" 
          icon={CheckCircle} 
          arrow="forward"
        />
        <StatsCard 
          title="Low Stock" 
          value={inventoryStats.low.toLocaleString()} 
          description="Below threshold" 
          color="amber" 
          icon={AlertTriangle} 
          arrow="forward"
        />
        <StatsCard 
          title="Out of Stock" 
          value={inventoryStats.out.toLocaleString()} 
          description="Needs restock" 
          color="red" 
          icon={AlertCircle} 
          arrow="forward"
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        {tableContent}
        
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

