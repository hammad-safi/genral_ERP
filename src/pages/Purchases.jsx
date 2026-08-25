import { useEffect, useMemo, useState, useCallback, memo, forwardRef, useImperativeHandle, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Printer, X, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PrintWrapper from '@/components/PrintWrapper';
import ConfirmDialog from '@/components/ConfirmDialog';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import { useSettings } from '@/hooks/useSettings';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useBusiness } from '@/contexts/BusinessContext';
import { useDexiePagination } from '@/hooks/useDexiePagination';
import VirtualTable from '@/components/VirtualTable';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency, formatDate, removeLeadingZeros, forceRepaintAfterRender } from '@/lib/utils';
import { initDB, getDB } from '@/lib/db';

const PurchaseFormModal = memo(forwardRef(({ currency, onSuccess }, ref) => {
  const [openForm, setOpenForm] = useState(false);
  const [formError, setFormError] = useState(null);
  
  const [productSearch, setProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);

  const [form, setForm] = useState({
    productId: 0,
    supplierId: 0,
    quantity: '',
    costPrice: '',
    date: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    note: '',
  });

  useImperativeHandle(ref, () => ({
    openNew: () => {
      setForm({
        productId: 0,
        supplierId: 0,
        quantity: '',
        costPrice: '',
        date: new Date().toISOString().slice(0, 10),
        expiryDate: '',
        note: '',
      });
      setProductSearch('');
      setSupplierSearch('');
      setFormError(null);
      setOpenForm(true);
    },
    close: () => setOpenForm(false)
  }));

  const debouncedProductSearch = useDebounce(productSearch, 300);
  const debouncedSupplierSearch = useDebounce(supplierSearch, 300);

  const productResults = useLiveQuery(async () => {
    if (!debouncedProductSearch || !openForm) return [];
    const db = getDB();
    const term = debouncedProductSearch.toLowerCase();
    return await db.products.where('name').startsWithIgnoreCase(term).or('barcode').startsWithIgnoreCase(term).limit(10).toArray();
  }, [debouncedProductSearch, openForm], []);

  const supplierResults = useLiveQuery(async () => {
    if (!debouncedSupplierSearch || !openForm) return [];
    const db = getDB();
    const term = debouncedSupplierSearch.toLowerCase();
    return await db.suppliers.where('name').startsWithIgnoreCase(term).limit(10).toArray();
  }, [debouncedSupplierSearch, openForm], []);

  const selectedProduct = useLiveQuery(() => form.productId && openForm ? getDB().products.get(form.productId) : Promise.resolve(null), [form.productId, openForm]);
  const selectedSupplier = useLiveQuery(() => form.supplierId && openForm ? getDB().suppliers.get(form.supplierId) : Promise.resolve(null), [form.supplierId, openForm]);
  const totalCost = (parseFloat(form.quantity) || 0) * (parseFloat(form.costPrice) || 0);

  const savePurchase = async (event) => {
    event.preventDefault();
    setFormError(null);
    
    const qty = parseFloat(form.quantity) || 0;
    const cost = parseFloat(form.costPrice) || 0;
    
    if (!qty || qty <= 0) {
      setFormError('Quantity must be greater than 0');
      return;
    }
    if (!cost || cost <= 0) {
      setFormError('Purchase price must be greater than 0');
      return;
    }
    if (!selectedProduct) {
      setFormError('Please select a product');
      return;
    }

    const currentDB = getDB();
    const purchase = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: qty,
      costPrice: cost,
      totalCost: qty * cost,
      supplier: selectedSupplier?.name,
      date: new Date(form.date).toISOString(),
      expiryDate: form.expiryDate || null,
      note: form.note,
    };
    const id = await currentDB.purchases.add(purchase);
    
    // Calculate WAC (Weighted Average Cost) and update product
    const allPurchases = await currentDB.purchases.where('productId').equals(selectedProduct.id).toArray();
    const totalCostAmount = allPurchases.reduce((sum, p) => sum + (p.totalCost ?? 0), 0);
    const totalQty = allPurchases.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
    const wac = totalQty > 0 ? totalCostAmount / totalQty : 0;
    await currentDB.products.update(selectedProduct.id, { costPrice: wac });
    
    // Record price change in price history
    await currentDB.priceHistory.add({
      productId: selectedProduct.id,
      type: 'purchase',
      purchasePrice: cost,
      wac: wac,
      date: new Date(form.date).toISOString(),
      quantity: qty,
      supplier: selectedSupplier?.name,
    });
    
    const inventoryItem = await currentDB.inventory.where('productId').equals(selectedProduct.id).first();
    if (form.expiryDate) {
      await currentDB.products.update(selectedProduct.id, { expiryDate: form.expiryDate });
    }

    if (inventoryItem && inventoryItem.id) {
      const updatedQuantity = inventoryItem.quantity + qty;
      await currentDB.inventory.update(inventoryItem.id, {
        quantity: updatedQuantity,
        lastUpdated: new Date().toISOString(),
        expiryDate: form.expiryDate || inventoryItem.expiryDate || null,
      });

    } else {
      await currentDB.inventory.add({
        productId: selectedProduct.id,
        quantity: qty,
        lowStockThreshold: 5,
        lastUpdated: new Date().toISOString(),
        expiryDate: form.expiryDate || null,
      });
    }

    setOpenForm(false);
    onSuccess('add', purchase);
  };

  if (!openForm) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Record Purchase</h2>
            <p className="mt-1 text-sm text-slate-500">Add stock and record a supplier invoice</p>
          </div>
          <button onClick={() => setOpenForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={savePurchase} className="p-6">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700 relative">
                <span>Product</span>
                <div className="relative">
                  <input
                    type="text"
                    value={isProductDropdownOpen ? productSearch : selectedProduct?.name || ''}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onFocus={() => { setIsProductDropdownOpen(true); setProductSearch(''); }}
                    onBlur={() => setTimeout(() => setIsProductDropdownOpen(false), 200)}
                    placeholder="Search product..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-500"
                  />
                  {isProductDropdownOpen && productSearch && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {productResults.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => { setForm({ ...form, productId: product.id }); setIsProductDropdownOpen(false); }}
                          className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                        >
                          <p className="font-medium text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">Barcode: {product.barcode || 'N/A'}</p>
                        </div>
                      ))}
                      {productResults.length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-500">No products found</div>
                      )}
                    </div>
                  )}
                </div>
              </label>

              <label className="space-y-2 text-sm text-slate-700 relative">
                <span>Supplier (Optional)</span>
                <div className="relative">
                  <input
                    type="text"
                    value={isSupplierDropdownOpen ? supplierSearch : selectedSupplier?.name || ''}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    onFocus={() => { setIsSupplierDropdownOpen(true); setSupplierSearch(''); }}
                    onBlur={() => setTimeout(() => setIsSupplierDropdownOpen(false), 200)}
                    placeholder="Search supplier..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-500"
                  />
                  {isSupplierDropdownOpen && supplierSearch && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {supplierResults.map((supplier) => (
                        <div
                          key={supplier.id}
                          onClick={() => { setForm({ ...form, supplierId: supplier.id }); setIsSupplierDropdownOpen(false); }}
                          className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                        >
                          <p className="font-medium text-slate-900">{supplier.name}</p>
                        </div>
                      ))}
                      {supplierResults.length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-500">No suppliers found</div>
                      )}
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Quantity</span>
                <input
                  type="text"
                  inputMode="decimal"
                  min={1}
                  step="0.01"
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: removeLeadingZeros(event.target.value) }))}
                  onFocus={e => e.target.select()}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                  required
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Purchase Price / Unit ({currency})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={form.costPrice}
                  onChange={(event) => setForm((current) => ({ ...current, costPrice: removeLeadingZeros(event.target.value) }))}
                  onFocus={e => e.target.select()}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                  required
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
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                  required
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Expiry Date (Optional)</span>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
                />
              </label>
            </div>
          </div>
          
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Total Cost:</span>
            <span className="text-2xl font-bold text-brand-600">{formatCurrency(totalCost, currency)}</span>
          </div>

          {formError && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="mt-8 flex justify-end gap-3">
            <button type="button" onClick={() => setOpenForm(false)} className="rounded-2xl px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" className="rounded-2xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
              Record Purchase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}));

export default function Purchases() {
  const { businessColor } = useBusiness();

  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeletePurchase, setConfirmDeletePurchase] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      await initDB();
    };
    load();
  }, []);

  const queryBuilder = useCallback((db) => {
    return db.purchases.reverse();
  }, []);

  const { data: visibleData, loadMoreRef, hasMore, refresh: refreshPurchases } = useDexiePagination(queryBuilder, [], 20, null, 'purchases');
  
  const { selectedIds, isSelected, toggleOne, toggleAll, clearSelection, isAllSelected, selectedCount } = useMultiSelect(visibleData);

  const openNewPurchase = () => modalRef.current?.openNew();

  const deletePurchase = async (purchase) => {
    if (!purchase.id) return;

    const currentDB = getDB();
    await currentDB.purchases.delete(purchase.id);
    
    const inventoryItem = await currentDB.inventory.where('productId').equals(purchase.productId).first();
    if (inventoryItem && inventoryItem.id) {
      const updatedQuantity = Math.max(0, inventoryItem.quantity - purchase.quantity);
      await currentDB.inventory.update(inventoryItem.id, { quantity: updatedQuantity, lastUpdated: new Date().toISOString() });
    }

    // Recalculate WAC after deletion using remaining purchase records
    const remainingPurchases = await currentDB.purchases
      .where('productId').equals(purchase.productId).toArray();
    
    if (remainingPurchases.length > 0) {
      const totalCostAmt = remainingPurchases.reduce((s, p) => s + (p.totalCost ?? 0), 0);
      const totalQtyAmt = remainingPurchases.reduce((s, p) => s + (p.quantity ?? 0), 0);
      const newWac = totalQtyAmt > 0 ? totalCostAmt / totalQtyAmt : 0;
      await currentDB.products.update(purchase.productId, { costPrice: newWac });
    } else {
      await currentDB.products.update(purchase.productId, { costPrice: 0 });
    }

    refreshPurchases();
    setConfirmDeletePurchase(null);
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
      const purchasesToDelete = visibleData.filter((p) => selectedIds.includes(p.id));
      
      for (const purchase of purchasesToDelete) {
        if (purchase.productId) {
          const inventoryItem = await currentDB.inventory.where('productId').equals(purchase.productId).first();
          if (inventoryItem && inventoryItem.id) {
            const updatedQuantity = Math.max(0, inventoryItem.quantity - purchase.quantity);
            await currentDB.inventory.update(inventoryItem.id, { quantity: updatedQuantity, lastUpdated: new Date().toISOString() });

          }
        }
      }
      
      await currentDB.purchases.bulkDelete(selectedIds);
      
      refreshPurchases();
      clearSelection();
      
      const affectedProductIds = [...new Set(
        purchasesToDelete.map(p => p.productId)
      )];
      
      await Promise.all(affectedProductIds.map(async (productId) => {
        const remaining = await currentDB.purchases
          .where('productId').equals(productId).toArray();
        if (remaining.length > 0) {
          const totalC = remaining.reduce((s, p) => s + (p.totalCost ?? 0), 0);
          const totalQ = remaining.reduce((s, p) => s + (p.quantity ?? 0), 0);
          const wac = totalQ > 0 ? totalC / totalQ : 0;
          await currentDB.products.update(productId, { costPrice: wac });
        } else {
          await currentDB.products.update(productId, { costPrice: 0 });
        }
      }));
      

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
      <PageHeader title="Purchases" description="Record restocks and print purchase reports" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Purchases</h2>
          <p className="mt-1 text-sm text-slate-500">Record restocks and print purchase reports</p>
        </div>
        <button
          type="button"
          onClick={openNewPurchase}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <Plus className="h-5 w-5" />
          Record Purchase
        </button>
      </div>

      <PrintWrapper title="Purchase Report" printLabel="Purchase Report">
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
            { header: "Date" },
            { header: "Product" },
            { header: "Supplier" },
            { header: "Qty" },
            { header: "Unit Cost" },
            { header: "Total" },
            { header: "Action" },
          ]}
          hasMore={hasMore}
          loadMoreRef={loadMoreRef}
          emptyState={null}
          renderRow={(purchase, virtualIndex, measureRef) => (
            <tr
              key={purchase.id}
              ref={measureRef}
              data-index={virtualIndex}
              className={isSelected(purchase.id) ? 'bg-red-50' : 'border-b border-slate-200'}
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={isSelected(purchase.id)}
                  onChange={() => toggleOne(purchase.id)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
              </td>
              <td className="px-4 py-3">{formatDate(purchase.date)}</td>
              <td className="px-4 py-3">{purchase.productName}</td>
              <td className="px-4 py-3">{purchase.supplier || 'N/A'}</td>
              <td className="px-4 py-3">{purchase.quantity}</td>
              <td className="px-4 py-3">{formatCurrency(purchase.costPrice, currency)}</td>
              <td className="px-4 py-3">{formatCurrency(purchase.totalCost, currency)}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => setConfirmDeletePurchase(purchase)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  Delete
                </button>
              </td>
            </tr>
          )}
        />
      </PrintWrapper>

      <ConfirmDialog
        open={!!confirmDeletePurchase}
        title="Delete purchase"
        description="This will remove this purchase record. Inventory will be adjusted. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setConfirmDeletePurchase(null)}
        onConfirm={() => deletePurchase(confirmDeletePurchase)}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selectedCount} purchases?`}
        description="This will permanently remove the selected purchase records. Inventory quantities will be reversed. This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={performBulkDelete}
      />

      <PurchaseFormModal 
        ref={modalRef}
        currency={currency}
        onSuccess={() => {
          refreshPurchases();
          forceRepaintAfterRender();
        }}
      />

      <BulkDeleteBar
        selectedCount={selectedCount}
        onDelete={deleteSelected}
        onCancel={clearSelection}
        itemLabel="purchase"
        isDeleting={isDeleting}
      />
    </div>
  );
}
