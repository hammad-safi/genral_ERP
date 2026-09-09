import { useEffect, useMemo, useState, useCallback, memo, forwardRef, useImperativeHandle, useRef } from 'react';
import { Plus, Edit3, Trash2, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PrintWrapper from '@/components/PrintWrapper';
import ConfirmDialog from '@/components/ConfirmDialog';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import { useSettings } from '@/hooks/useSettings';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useBusiness } from '@/contexts/BusinessContext';
import { useDexieOffsetPagination, clearPaginationCache } from '@/hooks/useDexiePagination';
import GlobalTable from '@/components/GlobalTable';
import GlobalFilter from '@/components/GlobalFilter';
import GlobalSearch from '@/components/GlobalSearch';
import GlobalButton from '@/components/GlobalButton';
import RowsDropdown from '@/components/RowsDropdown';
import CustomSelect from '@/components/CustomSelect';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency, formatDate, removeLeadingZeros, forceRepaintAfterRender } from '@/lib/utils';
import { getDB } from '@/lib/db';

const categories = ['Rent', 'Utilities', 'Transport', 'Other'];

const ExpenseFormModal = memo(forwardRef(({ currency, onSuccess }, ref) => {
  const [openForm, setOpenForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [form, setForm] = useState({ title: '', amount: '', category: 'Other', date: new Date().toISOString().slice(0, 10), note: '' });

  useImperativeHandle(ref, () => ({
    openNew: () => {
      setSelectedExpense(null);
      setForm({ title: '', amount: '', category: 'Other', date: new Date().toISOString().slice(0, 10), note: '' });
      setOpenForm(true);
    },
    openEdit: (expense) => {
      setSelectedExpense(expense);
      setForm({
        ...expense,
        amount: String(expense.amount),
        date: expense.date ? new Date(expense.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
      });
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

    const currentDB = getDB();
    const expenseData = {
      title: form.title,
      amount,
      category: form.category,
      date: new Date(form.date).toISOString(),
      note: form.note,
    };

    if (selectedExpense) {
      await currentDB.expenses.update(selectedExpense.id, expenseData);
      onSuccess('edit', { id: selectedExpense.id, ...expenseData });
    } else {
      const id = await currentDB.expenses.add(expenseData);
      onSuccess('add', { id, ...expenseData });
    }
    
    setOpenForm(false);
  };

  if (!openForm) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{selectedExpense ? 'Edit Expense' : 'Add Expense'}</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedExpense ? 'Update expense information' : 'Record a new shop expense'}</p>
          </div>
          <button onClick={() => setOpenForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={saveExpense} className="p-6">
          <div className="space-y-4">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
                required
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Amount ({currency})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  min={1}
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: removeLeadingZeros(event.target.value) }))}
                  onFocus={e => e.target.select()}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
                  required
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Category</span>
                <CustomSelect
                  value={form.category}
                  onChange={(val) => setForm((current) => ({ ...current, category: val }))}
                  options={categories}
                  placeholder="Select a category..."
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
                  required
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Note (optional)</span>
                <input
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
                />
              </label>
            </div>
          </div>
          
          {validationError && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {validationError}
            </div>
          )}

          <div className="mt-8 flex justify-end gap-3">
            <button type="button" onClick={() => setOpenForm(false)} className="rounded-2xl px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
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
  const [stats, setStats] = useState({ totalExpenses: 0, allExpensesTotal: 0 });

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    const calcStats = async () => {
      const currentDB = getDB();
      const allExpenses = await currentDB.expenses.toArray();
      const allTotal = allExpenses.reduce((sum, e) => sum + e.amount, 0);
      const filteredTotal = allExpenses
        .filter(e => filterCategory === 'All' ? true : e.category === filterCategory)
        .filter(e => {
          if (!debouncedSearch) return true;
          const searchLower = debouncedSearch.toLowerCase();
          return (e.title?.toLowerCase().includes(searchLower)) || (e.note?.toLowerCase().includes(searchLower));
        })
        .reduce((sum, e) => sum + e.amount, 0);
      
      setStats({ totalExpenses: filteredTotal, allExpensesTotal: allTotal });
    };
    calcStats();
  }, [filterCategory, debouncedSearch]);

  const queryBuilder = useCallback((db) => {
    let query = db.expenses.reverse().filter(e => filterCategory === 'All' ? true : e.category === filterCategory);
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      query = query.filter(e => 
        (e.title?.toLowerCase().includes(searchLower)) || (e.note?.toLowerCase().includes(searchLower))
      );
    }
    return query;
  }, [filterCategory, debouncedSearch]);

  const [limit, setLimit] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [filterCategory, debouncedSearch, limit]);

  const { data: visibleData, totalCount, isLoading, refresh: refreshExpenses } = useDexieOffsetPagination(
    queryBuilder, 
    [filterCategory, debouncedSearch], 
    currentPage, 
    limit, 
    null, 
    'expenses'
  );
  
  const { selectedIds, isSelected, toggleOne, toggleAll, clearSelection, isAllSelected, selectedCount } = useMultiSelect(visibleData);

  const openNewExpense = () => modalRef.current?.openNew();
  const openEditExpense = (expense) => modalRef.current?.openEdit(expense);

  const totalExpenses = stats.totalExpenses;
  const allExpensesTotal = stats.allExpensesTotal;

  const deleteExpense = async (expense) => {
    if (!expense.id) return;
    const currentDB = getDB();
    await currentDB.expenses.delete(expense.id);
    clearPaginationCache('expenses');
    refreshExpenses();
    setConfirmDeleteExpense(null);
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
      const currentDB = getDB();
      await currentDB.expenses.bulkDelete(selectedIds);
      clearPaginationCache('expenses');
      refreshExpenses();
      clearSelection();
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
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Expense Management</h1>
        <div className="flex items-center gap-3 shrink-0 mt-2 md:mt-0">
          <GlobalButton
            icon={Plus}
            onClick={openNewExpense}
          >
            Record Expense
          </GlobalButton>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Expenses</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{totalExpenses}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Recorded expense transactions</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Value</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(allExpensesTotal, currency)}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Total amount spent</p>
          </div>
        </div>
      </div>
      <PrintWrapper title="Expense Log" printLabel="Expense Log">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-6 flex-1 max-w-md">
                <GlobalSearch
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search expenses by title or note..."
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-2 pr-1">
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

            return (
              <div className="mt-2">
                <GlobalTable
                  data={visibleData}
                  columns={[
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
                    { header: "Date" },
                    { header: "Title" },
                    { header: "Category" },
                    { header: "Amount" },
                    { header: "Note" },
                    { header: "Action" },
                  ]}
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
                      <td className="px-4 py-3">{formatDate(expense.date)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{expense.title}</td>
                      <td className="px-4 py-3 text-slate-700">{expense.category}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(expense.amount, currency)}</td>
                      <td className="px-4 py-3 text-slate-700">{expense.note || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2 pr-4">
                          <button
                            onClick={() => openEditExpense(expense)}
                            className="rounded-xl p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            title="Edit expense"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteExpense(expense)}
                            className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete expense"
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
                      No expenses found.
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
          }, [visibleData, currentPage, limit, totalCount, isLoading, isAllSelected, selectedIds, filterCategory])}
        </div>
      </PrintWrapper>

      <ConfirmDialog
        open={!!confirmDeleteExpense}
        title="Delete expense"
        description="This will permanently remove this expense record. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setConfirmDeleteExpense(null)}
        onConfirm={() => deleteExpense(confirmDeleteExpense)}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selectedCount} expenses?`}
        description="This will permanently remove the selected expenses. This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={performBulkDelete}
      />

      <ExpenseFormModal 
        ref={modalRef}
        currency={currency}
        onSuccess={() => {
          refreshExpenses();
          forceRepaintAfterRender();
        }}
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
