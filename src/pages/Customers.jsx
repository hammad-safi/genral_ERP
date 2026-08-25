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
import { useDexiePagination } from '@/hooks/useDexiePagination';
import { useDebounce } from '@/hooks/useDebounce';
import VirtualTable from '@/components/VirtualTable';
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
      const allLedgers = await currentDB.customerLedger.toArray();
      let totalP = 0;
      const balances = {};
      
      allLedgers.forEach(e => {
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

  const { data: visibleData, loadMoreRef, hasMore, totalCount, refresh: refreshCustomers } = useDexiePagination(queryBuilder, [debouncedSearchQuery], 20, transformChunk, 'customers');

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

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Manage customer accounts and credit tracking" />

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Total Customers"
          value={totalCustomers.toString()}
          description="Active customer accounts"
        />
        <StatsCard
          title="Total Owed"
          value={formatCurrency(totalOwed, currency)}
          description="Outstanding balances"
        />
        <StatsCard
          title="Total Paid"
          value={formatCurrency(totalPaid, currency)}
          description="Payments received"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
            />
          </div>
          <button
            onClick={() => {
              setEditCustomer(null);
              setAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <VirtualTable
          data={visibleData}
          columns={[
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
            { header: "Phone" },
            { header: "Email" },
            { header: "Balance" },
            { header: "Actions" },
          ]}
          hasMore={hasMore}
          loadMoreRef={loadMoreRef}
          emptyState={
            <div className="p-8 text-center text-slate-500">
              No customers found matching "{searchQuery}"
            </div>
          }
          renderRow={(customer, virtualIndex, measureRef) => (
            <tr
              key={customer.id}
              ref={measureRef}
              data-index={virtualIndex}
              className={selectedIds.includes(customer.id) ? 'bg-red-50 hover:bg-red-100 transition-colors' : 'hover:bg-slate-50 transition-colors'}
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
              <td className="px-4 py-3 text-sm text-slate-700">{customer.phone}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{customer.email || '-'}</td>
              <td className={`px-4 py-3 text-sm font-bold ${getBalanceColor(customer.balance)}`}>
                {formatCurrency(customer.balance, currency)}
              </td>
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
          )}
        />
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
