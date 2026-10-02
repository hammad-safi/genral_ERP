import { useApiPagination } from '@/hooks/useApiPagination';
import { api } from '@/lib/api';
import { useEffect, useMemo, useState, memo, forwardRef, useImperativeHandle, useRef } from 'react';
import { Plus, Edit, Trash2, X, CreditCard, DollarSign } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatsCard from '@/components/StatsCard';
import PrintWrapper from '@/components/PrintWrapper';
import ConfirmDialog from '@/components/ConfirmDialog';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import ColumnVisibilityDropdown from '@/components/ColumnVisibilityDropdown';
import { useSettings } from '@/hooks/useSettings';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useBusiness } from '@/contexts/BusinessContext';

import GlobalTable from '@/components/GlobalTable';
import GlobalFilter from '@/components/GlobalFilter';
import GlobalSearch from '@/components/GlobalSearch';
import GlobalButton from '@/components/GlobalButton';
import CustomSelect from '@/components/CustomSelect';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency, formatDate, removeLeadingZeros, forceRepaintAfterRender } from '@/lib/utils';

const categories = ['Rent', 'Utilities', 'Transport', 'Salary', 'Maintenance', 'Marketing', 'Supplies', 'Other'];
const optionalColumns = ['Category', 'Date', 'Note'];

const ExpenseFormModal = memo(forwardRef(({ currency, onSuccess }, ref) => {
  const [openForm, setOpenForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'Other',
    date: new Date().toISOString().slice(0, 10),
    note: ''
  });

  useImperativeHandle(ref, () => ({
    openNew: () => {
      setSelectedExpense(null);
      setForm({
        title: '',
        amount: '',
        category: 'Other',
        date: new Date().toISOString().slice(0, 10),
        note: ''
      });
      setValidationError(null);
      setOpenForm(true);
    },
    openEdit: (expense) => {
      setSelectedExpense(expense);
      setForm({
        title: expense.description || expense.title || '',
        amount: String(expense.amount || ''),
        category: expense.category || 'Other',
        date: expense.date ? new Date(expense.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        note: expense.note || ''
      });
      setValidationError(null);
      setOpenForm(true);
    },
    close: () => setOpenForm(false)
  }));

  const saveExpense = async (event) => {
    event.preventDefault();
    const amount = parseFloat(form.amount) || 0;
    if (Number.isNaN(amount) || amount <= 0) {
      setValidationError('Enter a valid expense amount greater than 0');
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    if (!form.title.trim()) {
      setValidationError('Please enter an expense title / description');
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    const expenseData = {
      title: form.title.trim(),
      description: form.title.trim(),
      amount,
      category: form.category,
      date: new Date(form.date).toISOString(),
      note: form.note.trim(),
    };

    try {
      if (selectedExpense) {
        await api.updateExpense(selectedExpense.id, expenseData);
        onSuccess('edit', { id: selectedExpense.id, ...expenseData });
      } else {
        const res = await api.createExpense(expenseData);
        onSuccess('add', res);
      }
      setOpenForm(false);
    } catch (err) {
      setValidationError(err.message || 'Failed to save expense');
      setTimeout(() => setValidationError(null), 3000);
    }
  };

  if (!openForm) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{selectedExpense ? 'Edit Expense' : 'Add Expense'}</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedExpense ? 'Update expense details' : 'Record a new store expense'}</p>
          </div>
          <button onClick={() => setOpenForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={saveExpense} className="p-6">
          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              <span>Title / Description *</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. Shop Electricity Bill"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                required
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                <span>Amount ({currency}) *</span>
                <input
                  type="text"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: removeLeadingZeros(event.target.value) }))}
                  onFocus={e => e.target.select()}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                  required
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                <span>Category</span>
                <CustomSelect
                  value={form.category}
                  onChange={(val) => setForm((current) => ({ ...current, category: val }))}
                  options={categories}
                  placeholder="Select category..."
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                <span>Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                  required
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                <span>Note (optional)</span>
                <input
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Additional remarks..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                />
              </label>
            </div>
          </div>
          
          {validationError && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
              {validationError}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setOpenForm(false)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">
              {selectedExpense ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}));

export default function Expenses() {
  const { businessColor } = useBusiness();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');
  const modalRef = useRef(null);
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';
  const [stats, setStats] = useState({ totalCount: 0, totalAmount: 0 });

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const [limit, setLimit] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [filterCategory, debouncedSearch, limit]);

  const { data: visibleData, totalItems: totalCount, loading: isLoading, refresh: refreshExpenses, setPageIndex } = useApiPagination({
    endpoint: '/api/expenses',
    pageSize: limit,
    search: debouncedSearch,
    additionalParams: { category: filterCategory !== 'All' ? filterCategory : '' }
  });

  const { selectedIds, isSelected, toggleOne, toggleAll, clearSelection, isAllSelected, selectedCount } = useMultiSelect(visibleData);

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('expenses_visible_columns');
      return saved ? JSON.parse(saved) : optionalColumns;
    } catch {
      return optionalColumns;
    }
  });

  const toggleColumn = (col) => {
    setVisibleCols(prev => {
      const next = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem('expenses_visible_columns', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.getExpenses({ limit: 1 });
        if (res?.summary) {
          setStats({
            totalCount: res.summary.totalCount || 0,
            totalAmount: res.summary.totalAmount || 0
          });
        }
      } catch (err) {
        console.error('Failed to load expense stats:', err);
      }
    };
    fetchStats();
  }, [totalCount]);

  const openNewExpense = () => modalRef.current?.openNew();
  const openEditExpense = (expense) => modalRef.current?.openEdit(expense);

  const deleteExpense = async () => {
    if (!confirmDeleteExpense?.id) return;
    try {
      await api.deleteExpense(confirmDeleteExpense.id);
      refreshExpenses();
      setConfirmDeleteExpense(null);
      forceRepaintAfterRender();
    } catch (err) {
      console.error('Delete expense error:', err);
    }
  };

  const deleteSelected = () => {
    if (selectedCount === 0) return;
    setConfirmBulkDelete(true);
  };

  const performBulkDelete = async () => {
    setConfirmBulkDelete(false);
    setIsDeleting(true);
    try {
      await api.deleteExpensesBulk(selectedIds);
      refreshExpenses();
      clearSelection();
      forceRepaintAfterRender();
    } catch (error) {
      console.error('Bulk delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const dynamicColumns = [
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
    ...(visibleCols.includes('Date') ? [{ header: "Date" }] : []),
    { header: "Title / Description" },
    ...(visibleCols.includes('Category') ? [{ header: "Category" }] : []),
    { header: "Amount" },
    ...(visibleCols.includes('Note') ? [{ header: "Note" }] : []),
    { header: "Action" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        icon={CreditCard}
        title="Expense Management"
        description="Track, filter, and record store expenditures, overheads and operational costs."
        action={
          <button
            type="button"
            onClick={openNewExpense}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Record Expense
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <StatsCard 
          title="Total Expenses" 
          value={stats.totalCount.toString()} 
          description="Recorded expense transactions" 
          color="blue" 
          icon={CreditCard} 
          arrow="forward"
        />
        <StatsCard 
          title="Total Spent" 
          value={formatCurrency(stats.totalAmount, currency)} 
          description="Total store expenditures" 
          color="red" 
          icon={DollarSign} 
          arrow="forward"
        />
      </div>

      <PrintWrapper title="Expense Log" printLabel="Expense Log">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-4 flex-1">
                <div className="max-w-md w-full">
                  <GlobalSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search expenses by title, note, or category..."
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <GlobalFilter
                    value={filterCategory}
                    onChange={setFilterCategory}
                    options={[
                      { label: 'All Categories', value: 'All' },
                      ...categories.map(c => ({ label: c, value: c }))
                    ]}
                    variant="select"
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

          <div className="mt-2">
            <GlobalTable
              onLoadMore={() => setPageIndex(p => p + 1)}
              hasMore={visibleData.length < totalCount}
              data={visibleData}
              columns={dynamicColumns}
              renderRow={(expense, virtualIndex, measureRef) => {
                const rowBg = virtualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                return (
                  <tr
                    key={expense.id}
                    ref={measureRef}
                    data-index={virtualIndex}
                    className={`border-b border-slate-200 transition-colors ${isSelected(expense.id) ? 'bg-red-50 hover:bg-red-100' : `hover:bg-slate-100 ${rowBg}`}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected(expense.id)}
                        onChange={() => toggleOne(expense.id)}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                    </td>
                    {visibleCols.includes('Date') && (
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(expense.date)}</td>
                    )}
                    <td className="px-4 py-3 font-semibold text-slate-900 text-sm">{expense.description || expense.title}</td>
                    {visibleCols.includes('Category') && (
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          {expense.category || 'Other'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 font-bold text-slate-900 text-sm">{formatCurrency(expense.amount, currency)}</td>
                    {visibleCols.includes('Note') && (
                      <td className="px-4 py-3 text-sm text-slate-500">{expense.note || '—'}</td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2 pr-4">
                        <button
                          onClick={() => openEditExpense(expense)}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                          title="Edit expense"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {!isSelected(expense.id) && (
                          <button
                            onClick={() => setConfirmDeleteExpense(expense)}
                            className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition-colors"
                            title="Delete expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }}
              emptyState={
                <div className="p-8 text-center text-slate-500">
                  {isLoading ? 'Loading expenses...' : `No expenses found matching "${searchQuery}"`}
                </div>
              }
            />
          </div>
        </div>
      </PrintWrapper>

      <ExpenseFormModal
        ref={modalRef}
        currency={currency}
        onSuccess={() => {
          refreshExpenses();
          forceRepaintAfterRender();
        }}
      />

      <ConfirmDialog
        open={!!confirmDeleteExpense}
        title="Delete Expense?"
        description="Are you sure you want to delete this expense record? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setConfirmDeleteExpense(null)}
        onConfirm={deleteExpense}
        isDestructive={true}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selectedCount} expenses?`}
        description="This will permanently remove the selected expenses. This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={performBulkDelete}
        isDestructive={true}
      />

      <BulkDeleteBar
        selectedCount={selectedCount}
        onDelete={deleteSelected}
        onCancel={clearSelection}
        itemLabel="expense"
        isDeleting={isDeleting}
      />
    </div>
  );
}
