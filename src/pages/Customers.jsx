import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Search, BookOpen, Edit, Trash2 } from 'lucide-react';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import StatsCard from '@/components/StatsCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import { initDB, getDB } from '@/lib/db';
import { formatCurrency, forceRepaintAfterRender, removeLeadingZeros } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { useDexieOffsetPagination, clearPaginationCache } from '@/hooks/useDexiePagination';
import { useDebounce } from '@/hooks/useDebounce';
import GlobalTable from '@/components/GlobalTable';
import ColumnVisibilityDropdown from '@/components/ColumnVisibilityDropdown';
import GlobalSearch from '@/components/GlobalSearch';
import GlobalButton from '@/components/GlobalButton';
import RowsDropdown from '@/components/RowsDropdown';
import { useBusiness } from '@/contexts/BusinessContext';

export default function Customers() {
  const navigate = useNavigate();
  const { businessColor } = useBusiness();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';

  const [stats, setStats] = useState({ totalCustomers: 0, totalOwed: 0, totalPaid: 0 });

  useEffect(() => {
    const calcStats = async () => {
      const currentDB = getDB();
      let totalP = 0;
      const balances = {};
      
      await currentDB.customerLedger.each(e => {
        if (!balances[e.customerId]) balances[e.customerId] = 0;
        if (e.type === 'charge' || e.type === 'purchase') balances[e.customerId] += e.amount;
        if (e.type === 'payment') {
          balances[e.customerId] -= e.amount;
          totalP += e.amount;
        }
      });
      
      let tOwed = 0;
      for (const bal of Object.values(balances)) {
        if (bal > 0) tOwed += bal;
      }
      
      const cCount = await currentDB.customers.count();
      setStats({ totalCustomers: cCount, totalOwed: tOwed, totalPaid: totalP });
    };
    calcStats();
  }, []); // Re-run when needed, or just on mount for now

  const queryBuilder = useCallback((db) => {
    let query = db.customers;
    
    if (debouncedSearchQuery) {
      return query
        .where('name').startsWithIgnoreCase(debouncedSearchQuery)
        .or('phone').startsWithIgnoreCase(debouncedSearchQuery);
    }
    
    return query.reverse();
  }, [debouncedSearchQuery]);

  const transformChunk = useCallback(async (chunk) => {
    const currentDB = getDB();
    const customersWithBalance = await Promise.all(
      chunk.map(async (customer) => {
        const ledger = await currentDB.customerLedger.where('customerId').equals(customer.id).toArray();
        const totalCharged = ledger
          .filter(e => e.type === 'charge' || e.type === 'purchase')
          .reduce((sum, e) => sum + e.amount, 0);
        const totalPaid = ledger
          .filter(e => e.type === 'payment')
          .reduce((sum, e) => sum + e.amount, 0);
        return {
          ...customer,
          balance: totalCharged - totalPaid,
          totalPaid
        };
      })
    );
    return customersWithBalance;
  }, []);

  const [limit, setLimit] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearchQuery, limit]);

  const { data: visibleData, totalCount, isLoading, refresh: refreshCustomers } = useDexieOffsetPagination(
    queryBuilder, 
    [debouncedSearchQuery], 
    currentPage, 
    limit, 
    transformChunk
  );

  const totalCustomers = stats.totalCustomers;
  const totalOwed = stats.totalOwed;
  const totalPaid = stats.totalPaid;

  const getBalanceColor = (balance) => {
    if (balance === 0) return 'text-green-600';
    if (balance <= 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleEditCustomer = (customer) => {
    setEditCustomer(customer);
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer?.id) return;
    const currentDB = getDB();
    await currentDB.customers.delete(selectedCustomer.id);
    await currentDB.customerLedger.where('customerId').equals(selectedCustomer.id).delete();
    
    clearPaginationCache('customers');
    refreshCustomers();
    setConfirmDelete(false);
    setSelectedCustomer(null);
    forceRepaintAfterRender();
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
      setSelectAll(false);
    } else {
      setSelectedIds(visibleData.map(c => c.id));
      setSelectAll(true);
    }
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    setConfirmBulkDelete(true);
  };

  const performBulkDelete = async () => {
    setConfirmBulkDelete(false);
    setIsDeleting(true);
    try {
      const currentDB = getDB();
      await currentDB.customerLedger.where('customerId').anyOf(selectedIds).delete();
      await currentDB.customers.bulkDelete(selectedIds);
      
      refreshCustomers();
      setSelectedIds([]);
      setSelectAll(false);
      forceRepaintAfterRender();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Update selectAll when visibleData or selectedIds change
  useEffect(() => {
    const allSelected = visibleData.length > 0 && visibleData.every(c => selectedIds.includes(c.id));
    setSelectAll(allSelected);
  }, [visibleData, selectedIds]);

  const handleSaveCustomer = async (formData, isEdit = false) => {
    const currentDB = getDB();
    
    if (isEdit && formData.id) {
      await currentDB.customers.update(formData.id, {
        name: formData.name,
        phone: formData.phone || '',
        email: formData.email || '',
        address: formData.address || '',
      });
      refreshCustomers();
    } else {
      const customerId = await currentDB.customers.add({
        name: formData.name,
        phone: formData.phone || '',
        email: formData.email || '',
        address: formData.address || '',
        createdAt: new Date().toISOString()
      });

      if (formData.openingBalance && formData.openingBalance > 0) {
        await currentDB.customerLedger.add({
          customerId,
          type: 'charge',
          amount: Number(formData.openingBalance),
          description: 'Opening balance',
          date: new Date().toISOString()
        });
      }
      
      refreshCustomers();
    }
  };

  const optionalColumns = ['Phone', 'Email', 'Balance'];
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('customers_visible_columns');
      return saved ? JSON.parse(saved) : optionalColumns;
    } catch {
      return optionalColumns;
    }
  });

  const toggleColumn = (col) => {
    setVisibleCols(prev => {
      const next = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem('customers_visible_columns', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Customer Management</h1>
        <div className="flex items-center gap-3 shrink-0 mt-2 md:mt-0">
          <GlobalButton
            icon={Plus}
            onClick={() => {
              setEditCustomer(null);
              setAddModalOpen(true);
            }}
          >
            Add Customer
          </GlobalButton>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Customers</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{totalCustomers.toString()}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Active customer accounts</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Owed</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalOwed, currency)}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Outstanding balances</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Paid</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalPaid, currency)}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Payments received</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-4 flex-1">
              <div className="max-w-md w-full">
                <GlobalSearch
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search by name, phone, email..."
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
                  checked={selectAll}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded cursor-pointer"
                />
              ),
              className: "w-10",
            },
            { header: "Name" },
            ...(visibleCols.includes('Phone') ? [{ header: "Phone" }] : []),
            ...(visibleCols.includes('Email') ? [{ header: "Email" }] : []),
            ...(visibleCols.includes('Balance') ? [{ header: "Balance" }] : []),
            { header: "Actions" },
          ];

          return (
            <div className="mt-2">
              <GlobalTable
                data={visibleData}
                columns={tableColumns}
                renderRow={(customer, virtualIndex, measureRef) => {
                  const rowBg = virtualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                  return (
                  <tr
                    key={customer.id}
                    ref={measureRef}
                    data-index={virtualIndex}
                    className={`border-b border-slate-200 transition-colors ${selectedIds.includes(customer.id) ? 'bg-red-50 hover:bg-red-100' : `hover:bg-slate-100 ${rowBg}`}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(customer.id)}
                        onChange={() => toggleSelect(customer.id)}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-slate-900">{customer.name}</span>
                    </td>
                    {visibleCols.includes('Phone') && <td className="px-4 py-3 text-sm text-slate-700">{customer.phone}</td>}
                    {visibleCols.includes('Email') && <td className="px-4 py-3 text-sm text-slate-700">{customer.email || '-'}</td>}
                    {visibleCols.includes('Balance') && (
                      <td className={`px-4 py-3 text-sm font-bold ${getBalanceColor(customer.balance)}`}>
                        {formatCurrency(customer.balance, currency)}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/customers/${customer.id}`)}
                          className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 hover:bg-blue-100 transition-colors"
                          title="View Khata"
                        >
                          <BookOpen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditCustomer(customer)}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                          title="Edit Customer"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {!selectedIds.includes(customer.id) ? (
                          <button
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setConfirmDelete(true);
                            }}
                            className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition-colors"
                            title="Delete Customer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
                }}
                emptyState={
                  <div className="p-8 text-center text-slate-500">
                    No customers found matching "{searchQuery}"
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
        }, [visibleData, currentPage, limit, totalCount, isLoading, selectAll, selectedIds])}
      </div>

      {(addModalOpen || editCustomer) && (
        <CustomerModal
          customer={editCustomer}
          onClose={() => {
            setAddModalOpen(false);
            setEditCustomer(null);
          }}
          onSave={(formData) => {
            handleSaveCustomer(formData, !!editCustomer);
            setAddModalOpen(false);
            setEditCustomer(null);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete customer"
        description="This will remove the customer and all their ledger entries. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDeleteCustomer}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selectedIds.length} customers?`}
        description="This will permanently remove the selected customers and all their ledger entries."
        confirmText="Delete All"
        cancelText="Cancel"
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={performBulkDelete}
      />

      <BulkDeleteBar
        selectedCount={selectedIds.length}
        onDelete={deleteSelected}
        onCancel={() => { setSelectedIds([]); setSelectAll(false); }}
        itemLabel="customer"
        isDeleting={isDeleting}
      />
    </div>
  );
}

function CustomerModal({ customer, onClose, onSave }) {
  const [formData, setFormData] = useState({
    id: customer?.id || null,
    name: customer?.name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    address: customer?.address || '',
    openingBalance: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">
            {customer ? 'Edit Customer' : 'Add New Customer'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {customer ? 'Update customer information' : 'Create a new customer account'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                placeholder="e.g. Ahmad Khan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                placeholder="e.g. 0312-1234567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                placeholder="Optional"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Address <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                placeholder="Home or business address"
              />
            </div>

            {!customer && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Opening Balance (Rs)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  min="1"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({...formData, openingBalance: Number(removeLeadingZeros(e.target.value))})}
                  onFocus={e => e.target.select()}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                  placeholder=""
                />
                <p className="mt-1 text-xs text-slate-500">
                  If customer already owes money, enter amount here
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              {customer ? 'Update Customer' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
