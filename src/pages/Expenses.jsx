import { useEffect, useMemo, useState, useCallback, memo, forwardRef, useImperativeHandle, useRef } from 'react';
import { Plus, Edit3, Trash2, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PrintWrapper from '@/components/PrintWrapper';
import ConfirmDialog from '@/components/ConfirmDialog';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import { useSettings } from '@/hooks/useSettings';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useBusiness } from '@/contexts/BusinessContext';
import { useDexiePagination } from '@/hooks/useDexiePagination';
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
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
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
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                  required
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Category</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                  required
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Note (optional)</span>
                <input
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
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
            <button type="submit" className="rounded-2xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
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

  useEffect(() => {
    const calcStats = async () => {
      const currentDB = getDB();
      const allExpenses = await currentDB.expenses.toArray();
      const allTotal = allExpenses.reduce((sum, e) => sum + e.amount, 0);
      const filteredTotal = allExpenses
        .filter(e => filterCategory === 'All' ? true : e.category === filterCategory)
        .reduce((sum, e) => sum + e.amount, 0);
      
      setStats({ totalExpenses: filteredTotal, allExpensesTotal: allTotal });
    };
    calcStats();
  }, [filterCategory]);

  const queryBuilder = useCallback((db) => {
    return db.expenses.reverse().filter(e => filterCategory === 'All' ? true : e.category === filterCategory);
  }, [filterCategory]);

  const { data: visibleData, loadMoreRef, hasMore, totalCount, refresh: refreshExpenses } = useDexiePagination(queryBuilder, [filterCategory], 20, null, 'expenses');
  
  const { selectedIds, isSelected, toggleOne, toggleAll, clearSelection, isAllSelected, selectedCount } = useMultiSelect(visibleData);

  const openNewExpense = () => modalRef.current?.openNew();
  const openEditExpense = (expense) => modalRef.current?.openEdit(expense);

  const totalExpenses = stats.totalExpenses;
  const allExpensesTotal = stats.allExpensesTotal;

  const deleteExpense = async (expense) => {
    if (!expense.id) return;
    const currentDB = getDB();
    await currentDB.expenses.delete(expense.id);
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
      <PageHeader title="Expenses" description="Track every shop expense and print monthly totals" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Expenses</h2>
          <p className="mt-1 text-sm text-slate-500">Track and manage your shop expenditures</p>
        </div>
        <button
          type="button"
          onClick={openNewExpense}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <Plus className="h-5 w-5" />
          Record Expense
        </button>
      </div>


      <PrintWrapper title="Expense Log" printLabel="Expense Log">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-4">
              <p className="text-sm font-medium text-slate-900">Filter</p>
              <select
                value={filterCategory}
                onChange={(event) => setFilterCategory(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-brand-500"
              >
                <option value="All">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-slate-600">
              <span className="rounded-lg bg-slate-200 px-3 py-1 font-medium">{totalCount} expenses displayed</span>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[58vh] rounded-xl border border-slate-200">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleData.map((expense) => (
                  <tr key={expense.id} className={isSelected(expense.id) ? 'bg-red-50' : 'border-b border-slate-200 hover:bg-slate-50'}>
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
                          className="rounded-xl p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
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
                ))}
                {hasMore && (
                  <tr ref={loadMoreRef}>
                    <td colSpan="7" className="p-4 text-center text-sm text-slate-500">
                      Loading more...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
