import { api } from '@/lib/api';
import { useEffect, useState, useCallback, memo, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { useApiPagination } from '@/hooks/useApiPagination';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, X, BookOpen, Search, Truck, Clock, CheckCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatsCard from '@/components/StatsCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import BulkDeleteBar from '@/components/BulkDeleteBar';

import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useDebounce } from '@/hooks/useDebounce';
import GlobalTable from '@/components/GlobalTable';
import ColumnVisibilityDropdown from '@/components/ColumnVisibilityDropdown';
import GlobalSearch from '@/components/GlobalSearch';
import GlobalButton from '@/components/GlobalButton';
import RowsDropdown from '@/components/RowsDropdown';
import { forceRepaintAfterRender, formatCurrency, removeLeadingZeros } from '@/lib/utils';
import { useBusiness } from '@/contexts/BusinessContext';
import { useSettings } from '@/hooks/useSettings';

const SupplierFormModal = memo(forwardRef(({ onSuccess }, ref) => {
  const [openForm, setOpenForm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    openingBalance: '',
    createdAt: new Date().toISOString(),
  });

  useImperativeHandle(ref, () => ({
    openNew: () => {
      setSelectedSupplier(null);
      setForm({
        name: '',
        phone: '',
        email: '',
        address: '',
        openingBalance: '',
        createdAt: new Date().toISOString(),
      });
      setOpenForm(true);
    },
    openEdit: (supplier) => {
      setSelectedSupplier(supplier);
      setForm({ ...supplier });
      setOpenForm(true);
    },
    close: () => setOpenForm(false)
  }));

  const saveSupplier = async (event) => {
    event.preventDefault();
    if (!form.name) return;
    
    if (selectedSupplier) {
      await api.updateSupplier(selectedSupplier.id, form);

      onSuccess('edit', { id: selectedSupplier.id, ...form });
    } else {
      
    const res = await api.createSupplier(form);
      onSuccess('add', res);
    }
    setOpenForm(false);
  };

  if (!openForm) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">
            {selectedSupplier ? 'Edit Supplier' : 'Add New Supplier'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {selectedSupplier ? 'Update supplier information' : 'Create a new supplier profile'}
          </p>
        </div>
        <form onSubmit={saveSupplier} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                placeholder="e.g. Ali Traders"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                placeholder="Optional"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                placeholder="Optional"
              />
            </div>
            {!selectedSupplier && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Opening Balance (Optional)</label>
                <input
                  type="number"
                  value={form.openingBalance}
                  onChange={(event) => setForm((current) => ({ ...current, openingBalance: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                  placeholder="Enter amount"
                />
                <p className="mt-1 text-xs text-slate-500">Positive amount means you owe them money (Purchase/Charge).</p>
              </div>
            )}
          </div>
          <div className="mt-8 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => setOpenForm(false)} 
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              {selectedSupplier ? 'Update Supplier' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}));

export default function Suppliers() {
  const { businessColor } = useBusiness();
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [stats, setStats] = useState({ totalSuppliers: 0, totalOwed: 0, totalPaid: 0 });

  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const modalRef = useRef(null);
  const [editId, setEditId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  const queryBuilder = useCallback((db) => {
    let query = db.suppliers;
    if (debouncedSearchQuery) {
      return query
        .where('name').startsWithIgnoreCase(debouncedSearchQuery)
        .or('phone').startsWithIgnoreCase(debouncedSearchQuery);
    }
    return query.reverse();
  }, [debouncedSearchQuery]);

  
    const transformChunk = useCallback(async (chunk) => {
      return chunk;
    }, []);

  const [limit, setLimit] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearchQuery, limit]);

  const { data: visibleData, totalItems: totalCount, loading: isLoading, refresh: loadSuppliers, setPageIndex } = useApiPagination({
    endpoint: '/api/suppliers',
    pageSize: limit,
    search: debouncedSearchQuery
  });
  const { selectedIds, isSelected, toggleOne, toggleAll, clearSelection, isAllSelected, selectedCount } = useMultiSelect(visibleData);

  useEffect(() => {
    const calcStats = async () => {
      try {
        const { summary } = await api.getSuppliers();
        if (summary) {
          setStats({ totalSuppliers: summary.totalCount || 0, totalOwed: summary.totalOwed || 0, totalPaid: summary.totalPaid || 0 });
        }
      } catch (err) { console.error(err); }
    };
    calcStats();
  }, [totalCount]);

  const openNewSupplier = () => modalRef.current?.openNew();
  const openEditSupplier = (supplier) => modalRef.current?.openEdit(supplier);

  
    const deleteSupplier = async () => {
      if (!editId) return;
      await api.deleteSupplier(editId);

    clearPaginationCache('suppliers');
    loadSuppliers();
    setEditId(null);
    setConfirmDelete(false);
    forceRepaintAfterRender();
  };

  const deleteSelected = () => {
    if (selectedCount === 0) return;
    setConfirmBulkDelete(true);
  };

  const performBulkDelete = async () => {
    setConfirmBulkDelete(false);
    setIsDeleting(true);
    try {
      await api.deleteSuppliersBulk(selectedRows || selectedIds);
      clearPaginationCache('suppliers');
      loadSuppliers();
      clearSelection();
      forceRepaintAfterRender();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const optionalColumns = ['Phone', 'Email', 'Address', 'Balance'];
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('suppliers_visible_columns');
      return saved ? JSON.parse(saved) : optionalColumns;
    } catch {
      return optionalColumns;
    }
  });

  const toggleColumn = (col) => {
    setVisibleCols(prev => {
      const next = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem('suppliers_visible_columns', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        icon={Truck}
        title="Supplier Management"
        description="Maintain vendor relationships, track procurement balances, and monitor payables."
        action={
          <button
            type="button"
            onClick={() => modalRef.current?.openNew()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Add Supplier
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard 
          title="Total Suppliers" 
          value={stats.totalSuppliers.toString()} 
          description="Active supplier accounts" 
          color="blue" 
          icon={Truck} 
          arrow="forward"
        />
        <StatsCard 
          title="Total Payable" 
          value={formatCurrency(stats.totalOwed, currency)} 
          description="Outstanding balances" 
          color="amber" 
          icon={Clock} 
          arrow="forward"
        />
        <StatsCard 
          title="Total Paid" 
          value={formatCurrency(stats.totalPaid, currency)} 
          description="Payments made" 
          color="emerald" 
          icon={CheckCircle} 
          arrow="forward"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-4 flex-1">
              <div className="max-w-md w-full">
                <GlobalSearch
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search suppliers by name or phone..."
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0 justify-end">
              <ColumnVisibilityDropdown
                columns={optionalColumns}
                visibleCols={visibleCols}
                toggleColumn={toggleColumn}
              />
            </div>
          </div>
        </div>

        {useMemo(() => {
          const totalPages = Math.max(1, Math.ceil(totalCount / limit));
          
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
            { header: "Name" },
            ...(visibleCols.includes('Phone') ? [{ header: "Phone" }] : []),
            ...(visibleCols.includes('Email') ? [{ header: "Email" }] : []),
            ...(visibleCols.includes('Address') ? [{ header: "Address" }] : []),
            ...(visibleCols.includes('Balance') ? [{ header: "Balance" }] : []),
            { header: "Actions" },
          ];

          return (
            <div className="mt-2">
              <GlobalTable onLoadMore={() => setPageIndex(p => p + 1)} hasMore={visibleData.length < totalCount}
                data={visibleData}
                columns={tableColumns}
                renderRow={(supplier, virtualIndex, measureRef) => {
                  const rowBg = virtualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                  return (
                  <tr
                    key={supplier.id}
                    ref={measureRef}
                    data-index={virtualIndex}
                    className={`border-b border-slate-200 transition-colors ${isSelected(supplier.id) ? 'bg-red-50 hover:bg-red-100' : `hover:bg-slate-100 ${rowBg}`}`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected(supplier.id)}
                        onChange={() => toggleOne(supplier.id)}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{supplier.name}</td>
                    {visibleCols.includes('Phone') && <td className="px-4 py-4 text-slate-700">{supplier.phone}</td>}
                    {visibleCols.includes('Email') && <td className="px-4 py-4 text-slate-700">{supplier.email}</td>}
                    {visibleCols.includes('Address') && <td className="px-4 py-4 text-slate-700">{supplier.address}</td>}
                    {visibleCols.includes('Balance') && (
                      <td className="px-4 py-4">
                        <span className={`font-bold ${supplier.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {formatCurrency(supplier.balance, currency)}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2 pr-4">
                        <button
                          onClick={() => navigate(`/suppliers/${supplier.id}`)}
                          className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 hover:bg-blue-100 transition-colors"
                          title="View Ledger"
                        >
                          <BookOpen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditSupplier(supplier)}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                          title="Edit Supplier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditId(supplier.id);
                            setConfirmDelete(true);
                          }}
                          className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition-colors"
                          title="Delete Supplier"
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
                    No suppliers found matching "{searchQuery}"
                  </div>
                }
              />
              
              
            </div>
          );
        }, [visibleData, currentPage, limit, totalCount, isLoading, isAllSelected, selectedIds])}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete supplier"
        description="This will remove the supplier record permanently."
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={deleteSupplier}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={performBulkDelete}
        title="Delete Selected Suppliers"
        description={`Are you sure you want to delete ${selectedCount} selected suppliers? This action cannot be undone.`}
        variant="danger"
        confirmText={isDeleting ? 'Deleting...' : 'Delete Selected'}
      />

      <SupplierFormModal 
        ref={modalRef} 
        onSuccess={() => {
          loadSuppliers();
          forceRepaintAfterRender();
        }} 
      />

      <BulkDeleteBar
        selectedCount={selectedCount}
        onDelete={deleteSelected}
        onCancel={clearSelection}
        itemLabel="supplier"
        isDeleting={isDeleting}
      />
    </div>
  );
}
