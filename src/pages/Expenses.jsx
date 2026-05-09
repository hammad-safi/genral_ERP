import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PrintWrapper from '@/components/PrintWrapper';
import ConfirmDialog from '@/components/ConfirmDialog';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import { initDB, getDB } from '@/lib/db';
import { formatCurrency, formatDate, forceRepaintAfterRender, removeLeadingZeros } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useBusiness } from '@/contexts/BusinessContext';

const categories = ['Rent', 'Utilities', 'Transport', 'Other'];

export default function Expenses() {
  const { businessColor } = useBusiness();
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({ title: '', amount: '', category: 'Other', date: new Date().toISOString().slice(0, 10), note: '' });
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';
  const { selectedIds, isSelected, toggleOne, toggleAll, clearSelection, isAllSelected, selectedCount } = useMultiSelect(expenses);
  const [filterCategory, setFilterCategory] = useState('All');
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    const load = async () => {
      await initDB();
      const currentDB = getDB();
      const data = await currentDB.expenses.toArray();
      setExpenses(data);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return expenses.filter((item) => filterCategory === 'All' || item.category === filterCategory);
  }, [expenses, filterCategory]);

  const saveExpense = async (event) => {
    event.preventDefault();
    const amount = parseFloat(form.amount) || 0;
    if (Number.isNaN(amount) || amount <= 0) {
      setValidationError('Enter a valid expense amount greater than 0');
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    const currentDB = getDB();
    const expense = {
      title: form.title,
      amount,
      category: form.category,
      date: new Date(form.date).toISOString(),
      note: form.note,
    };
    const id = await currentDB.expenses.add(expense);
    setExpenses((current) => [{ ...expense, id }, ...current]);
    setForm({ title: '', amount: '', category: 'Other', date: new Date().toISOString().slice(0, 10), note: '' });
  };

  const totalExpenses = filtered.reduce((acc, item) => acc + item.amount, 0);
  const allExpensesTotal = expenses.reduce((acc, item) => acc + item.amount, 0);

  const deleteExpense = async (expense) => {
    if (!expense.id) return;
    const currentDB = getDB();
    await currentDB.expenses.delete(expense.id);
    setExpenses((current) => current.filter((item) => item.id !== expense.id));
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
      setExpenses((prev) => prev.filter((e) => !selectedIds.includes(e.id)));
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
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
        <form onSubmit={saveExpense} className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
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
                <span>Amount</span>
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
                <span>Note</span>
                <input
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                />
              </label>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">Grand Total</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{formatCurrency(allExpensesTotal, currency)}</p>
              </div>
              {filterCategory !== 'All' && (
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-sm text-slate-500">Filtered Total ({filterCategory})</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-700">{formatCurrency(totalExpenses, currency)}</p>
                </div>
              )}
              <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700">
                <Plus className="h-4 w-4" />
                Add Expense
              </button>
            </div>
          </div>
        </form>
      </div>

      <PrintWrapper title="Expense Log" printLabel="Expense Log">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 p-4">
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
                {filtered.map((expense) => (
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
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteExpense(expense)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
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

      {validationError && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-red-50 border border-red-200 p-4 shadow-lg">
          <p className="text-sm text-red-800">{validationError}</p>
        </div>
      )}

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
