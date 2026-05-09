import { useEffect, useMemo, useState } from 'react';
import { Plus, Filter, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PrintWrapper from '@/components/PrintWrapper';
import ConfirmDialog from '@/components/ConfirmDialog';
import { initDB, getDB } from '@/lib/db';
import { formatDate, forceRepaintAfterRender, removeLeadingZeros } from '@/lib/utils';
import { useBusiness } from '@/contexts/BusinessContext';

export default function Inventory() {
  const { businessColor } = useBusiness();
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ quantity: '', note: '', type: 'add' });
  const [adjustmentError, setAdjustmentError] = useState('');
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);

  // Get unique categories from products
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    return cats.sort();
  }, [products]);

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

  useEffect(() => {
    const load = async () => {
      await initDB();
      const currentDB = getDB();
      const [productsData, inventoryData] = await Promise.all([
        currentDB.products.toArray(),
        currentDB.inventory.toArray()
      ]);
      setProducts(productsData);
      setInventory(inventoryData);
    };
    load();
  }, []);

  const inventoryView = useMemo(() => {
    const today = new Date();
    const warningDate = new Date();
    warningDate.setDate(today.getDate() + 30);
    
    return inventory
      .map((item) => {
        const product = products.find((product) => product.id === item.productId);
        const expDate = product?.expiryDate ? new Date(product.expiryDate) : null;
        let expiryStatus = 'ok';
        if (expDate) {
          if (expDate < today) expiryStatus = 'expired';
          else if (expDate <= warningDate) expiryStatus = 'warning';
        }
        return {
          ...item,
          productName: product?.name ?? 'Unknown',
          category: product?.category ?? '',
          unit: product?.unit ?? '',
          expiryDate: product?.expiryDate || '',
          expiryStatus,
        };
      })
      .filter((item) => {
        if (item.productName === 'Unknown') return false;
        if (filter === 'low') return item.quantity > 0 && item.quantity <= item.lowStockThreshold;
        if (filter === 'out') return item.quantity <= 0;
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        return true;
      });
  }, [filter, categoryFilter, inventory, products]);

  const handleAdjust = (item) => {
    setSelectedItem(item);
    setAdjustForm({ quantity: '', note: '', type: 'add' });
    setAdjustOpen(true);
  };

  const saveAdjustment = async () => {
    if (!selectedItem) return;
    setAdjustmentError(''); // Clear previous error
    
    const currentDB = getDB();
    
    // Check if trying to subtract more than available
    if (adjustForm.type === 'subtract' && adjustForm.quantity > selectedItem.quantity) {
      setAdjustmentError(`Cannot subtract more than current stock of ${selectedItem.quantity}`);
      return;
    }
    
    const quantityChange = adjustForm.type === 'add' ? adjustForm.quantity : -adjustForm.quantity;
    const updatedQuantity = Math.max(0, selectedItem.quantity + quantityChange);
    
    await currentDB.inventory.update(selectedItem.id, {
      quantity: updatedQuantity,
      lastUpdated: new Date().toISOString(),
    });
    setInventory((current) =>
      current.map((item) =>
        item.id === selectedItem.id
          ? { ...item, quantity: updatedQuantity, lastUpdated: new Date().toISOString() }
          : item
      )
    );
    setAdjustOpen(false);
    setAdjustmentError('');
  };

  // Delete single inventory item
  const deleteInventoryItem = async () => {
    if (!deleteItemId) return;
    const idToDelete = deleteItemId;
    const currentDB = getDB();
    try {
      await currentDB.inventory.delete(idToDelete);
      setInventory((current) => current.filter((item) => item.id !== idToDelete));
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      return;
    }
    // Reset selectedItem if it matches the deleted item to prevent stale state
    if (selectedItem && selectedItem.id === idToDelete) {
      setSelectedItem(null);
    }
    // Reset state in order to prevent UI issues
    setConfirmDelete(false);
    setDeleteItemId(null);
    // Reset adjust form to prevent stale data
    setAdjustForm({ quantity: '', note: '', type: 'add' });
    
    // Force repaint after React DOM updates complete
    forceRepaintAfterRender();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Track stock levels, adjust inventory, and print reports" />

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
              <Filter className="h-4 w-4" />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="bg-transparent outline-none text-slate-900"
              >
                <option value="all">All stock</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="bg-transparent outline-none text-slate-900"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{inventoryView.length} items displayed</span>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[58vh] rounded-xl border border-slate-200">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 bg-white">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Low Threshold</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
               {inventoryView.map((item) => {
                 const status = item.quantity <= 0 ? 'Out' : item.quantity <= item.lowStockThreshold ? 'Low' : 'OK';
                 const statusClass = status === 'Out' ? 'bg-red-100 text-red-700' : status === 'Low' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                 
                 // Expiry status styling
                 const expiryClass = item.expiryStatus === 'expired' ? 'bg-red-100 text-red-700 font-semibold' : 
                                     item.expiryStatus === 'warning' ? 'bg-amber-100 text-amber-700 font-semibold' : 
                                     'text-slate-700';
                 const expiryText = item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '-';

                 return (
                   <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                     <td className="px-4 py-4 font-semibold text-slate-900">{item.productName}</td>
                    <td className="px-4 py-4 text-slate-700">{item.category}</td>
                    <td className="px-4 py-4 text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-4 text-slate-700">{item.unit}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${expiryClass}`}>
                        {expiryText}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{item.lowStockThreshold}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{status}</span>
                    </td>
                    <td className="px-4 py-4">
                       <div className="flex items-center gap-2">
                         <button
                           type="button"
                           onClick={() => handleAdjust(item)}
                           className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
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
                           className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition-colors"
                           title="Delete Inventory Record"
                         >
                           <Trash2 className="h-4 w-4" />
                         </button>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PrintWrapper title="Inventory Report" printLabel="Inventory Report">
        <div className="overflow-x-auto overflow-y-auto max-h-[58vh] rounded-xl border border-slate-200">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Low Threshold</th>
                <th className="px-4 py-3">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {inventoryView.map((item) => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="px-4 py-3 text-slate-900">{item.productName}</td>
                  <td className="px-4 py-3 text-slate-700">{item.category}</td>
                  <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-slate-700">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{item.lowStockThreshold}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(item.lastUpdated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PrintWrapper>

      {adjustOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
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
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Type</span>
                  <select
                    value={adjustForm.type}
                    onChange={(event) => setAdjustForm((current) => ({ ...current, type: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                  >
                    <option value="add">Add stock</option>
                    <option value="subtract">Subtract stock</option>
                  </select>
                </label>
              </div>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Note</span>
                <textarea
                  value={adjustForm.note}
                  onChange={(event) => setAdjustForm((current) => ({ ...current, note: event.target.value }))}
                  rows={3}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
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
                <button onClick={saveAdjustment} className="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  Save adjustment
                </button>
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
