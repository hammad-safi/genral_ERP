import { useEffect, useState, useCallback, memo, forwardRef, useImperativeHandle, useRef } from 'react';
import { Plus, Edit3, Trash2, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import { initDB, getDB } from '@/lib/db';
import { useDexiePagination } from '@/hooks/useDexiePagination';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import VirtualTable from '@/components/VirtualTable';
import { forceRepaintAfterRender } from '@/lib/utils';
import { useBusiness } from '@/contexts/BusinessContext';

const SupplierFormModal = memo(forwardRef(({ onSuccess }, ref) => {
  const [openForm, setOpenForm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
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
    const currentDB = getDB();
    if (selectedSupplier) {
      await currentDB.suppliers.update(selectedSupplier.id, form);
      onSuccess('edit', { id: selectedSupplier.id, ...form });
    } else {
      const id = await currentDB.suppliers.add({ ...form, createdAt: new Date().toISOString() });
      onSuccess('add', { id, ...form });
    }
    setOpenForm(false);
  };

  if (!openForm) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{selectedSupplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedSupplier ? 'Update supplier information' : 'Create a new supplier profile'}</p>
          </div>
          <button onClick={() => setOpenForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={saveSupplier} className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                required
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Phone</span>
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
              <span>Address</span>
              <input
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
              />
            </label>
          </div>
          <div className="mt-8 flex justify-end gap-3">
            <button type="button" onClick={() => setOpenForm(false)} className="rounded-2xl px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" className="rounded-2xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
              {selectedSupplier ? 'Update supplier' : 'Save supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}));

export default function Suppliers() {
  const { businessColor } = useBusiness();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const modalRef = useRef(null);
  const [editId, setEditId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const queryBuilder = useCallback((db) => {
    return db.suppliers.reverse();
  }, []);

  const { data: visibleData, loadMoreRef, hasMore, totalCount, refresh: loadSuppliers } = useDexiePagination(queryBuilder, [], 20, null, 'suppliers');
  const { selectedIds, isSelected, toggleOne, toggleAll, clearSelection, isAllSelected, selectedCount } = useMultiSelect(visibleData);

  const openNewSupplier = () => modalRef.current?.openNew();
  const openEditSupplier = (supplier) => modalRef.current?.openEdit(supplier);

  const deleteSupplier = async () => {
    if (!editId) return;
    const currentDB = getDB();
    await currentDB.suppliers.delete(editId);
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
      const currentDB = getDB();
      await currentDB.suppliers.bulkDelete(selectedIds);
      loadSuppliers();
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
      <PageHeader title="Suppliers" description="Manage supplier contacts and details" />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Supplier Directory</h2>
          <p className="mt-1 text-sm text-slate-500">Manage your wholesale and vendor contacts</p>
        </div>
        <button
          type="button"
          onClick={openNewSupplier}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <Plus className="h-5 w-5" />
          Add Supplier
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Supplier list</h2>
          <p className="text-sm text-slate-500">{totalCount} suppliers</p>
        </div>
        <VirtualTable
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
            { header: "Name" },
            { header: "Phone" },
            { header: "Email" },
            { header: "Address" },
            { header: "Actions" },
          ]}
          hasMore={hasMore}
          loadMoreRef={loadMoreRef}
          emptyState={null}
          renderRow={(supplier, virtualIndex, measureRef) => (
            <tr
              key={supplier.id}
              ref={measureRef}
              data-index={virtualIndex}
              className={isSelected(supplier.id) ? 'bg-red-50' : 'border-b border-slate-200 hover:bg-slate-50'}
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
              <td className="px-4 py-4 text-slate-700">{supplier.phone}</td>
              <td className="px-4 py-4 text-slate-700">{supplier.email}</td>
              <td className="px-4 py-4 text-slate-700">{supplier.address}</td>
              <td className="px-4 py-4">
                <div className="flex justify-end gap-2 pr-4">
                  <button
                    onClick={() => openEditSupplier(supplier)}
                    className="rounded-xl p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                    title="Edit supplier"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditId(supplier.id);
                      setConfirmDelete(true);
                    }}
                    className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Delete supplier"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
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
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={performBulkDelete}
        title="Delete Selected Suppliers"
        message={`Are you sure you want to delete ${selectedCount} selected suppliers? This action cannot be undone.`}
        isDestructive={true}
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
