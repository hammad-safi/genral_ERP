import { useEffect, useMemo, useState } from 'react';
import { Plus, Printer } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PrintWrapper from '@/components/PrintWrapper';
import ConfirmDialog from '@/components/ConfirmDialog';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import { initDB, getDB } from '@/lib/db';
import { formatCurrency, formatDate, forceRepaintAfterRender, removeLeadingZeros } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useBusiness } from '@/contexts/BusinessContext';

export default function Purchases() {
  const { businessColor } = useBusiness();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';
  const { selectedIds, isSelected, toggleOne, toggleAll, clearSelection, isAllSelected, selectedCount } = useMultiSelect(purchases);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeletePurchase, setConfirmDeletePurchase] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({
    productId: 0,
    supplierId: 0,
    quantity: '',
    costPrice: '',
    date: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    note: '',
  });

  useEffect(() => {
    const load = async () => {
      await initDB();
      const currentDB = getDB();
      const [productsData, suppliersData, purchasesData, inventoryData] = await Promise.all([
        currentDB.products.toArray(),
        currentDB.suppliers.toArray(),
        currentDB.purchases.toArray(),
        currentDB.inventory.toArray(),
      ]);
      setProducts(productsData);
      setSuppliers(suppliersData);
      setPurchases(purchasesData);
      setInventory(inventoryData);
      if (productsData[0]) setForm((current) => ({ ...current, productId: productsData[0].id }));
      if (suppliersData[0]) setForm((current) => ({ ...current, supplierId: suppliersData[0].id }));
    };
    load();
  }, []);

  const selectedProduct = useMemo(() => products.find((product) => product.id === form.productId), [products, form.productId]);
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === form.supplierId),
    [suppliers, form.supplierId]
  );
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
    if (!selectedProduct) return;
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
    setPurchases((current) => [{ ...purchase, id }, ...current]);
    
    // Calculate WAC (Weighted Average Cost) and update product
    const allPurchases = await currentDB.purchases.where('productId').equals(selectedProduct.id).toArray();
    const totalCostAmount = allPurchases.reduce((sum, p) => sum + (p.totalCost ?? 0), 0);
    const totalQty = allPurchases.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
    const wac = totalQty > 0 ? totalCostAmount / totalQty : 0;
    await currentDB.products.update(selectedProduct.id, { costPrice: wac });
    setProducts((current) =>
      current.map((product) =>
        product.id === selectedProduct.id ? { ...product, costPrice: wac } : product
      )
    );
    
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
      setInventory((current) =>
        current.map((item) =>
          item.id === inventoryItem.id
            ? { ...item, quantity: updatedQuantity, lastUpdated: new Date().toISOString(), expiryDate: form.expiryDate || inventoryItem.expiryDate || null }
            : item
        )
      );
    } else {
      const newInventoryId = await currentDB.inventory.add({
        productId: selectedProduct.id,
        quantity: qty,
        lowStockThreshold: 5,
        lastUpdated: new Date().toISOString(),
        expiryDate: form.expiryDate || null,
      });
      setInventory((current) => [
        ...current,
        {
          id: newInventoryId,
          productId: selectedProduct.id,
          quantity: qty,
          lowStockThreshold: 5,
          lastUpdated: new Date().toISOString(),
        },
      ]);
    }
    setForm((current) => ({ ...current, quantity: '', costPrice: '', note: '' }));
  };

  const deletePurchase = async (purchase) => {
    if (!purchase.id) return;

    const currentDB = getDB();
    await currentDB.purchases.delete(purchase.id);
    setPurchases((current) => current.filter((item) => item.id !== purchase.id));

    const inventoryItem = await currentDB.inventory.where('productId').equals(purchase.productId).first();
    if (inventoryItem && inventoryItem.id) {
      const updatedQuantity = Math.max(0, inventoryItem.quantity - purchase.quantity);
      await currentDB.inventory.update(inventoryItem.id, { quantity: updatedQuantity, lastUpdated: new Date().toISOString() });
      setInventory((current) =>
        current.map((item) =>
          item.id === inventoryItem.id ? { ...item, quantity: updatedQuantity, lastUpdated: new Date().toISOString() } : item
        )
      );
    }

    // Recalculate WAC after deletion using remaining purchase records
    const remainingPurchases = await currentDB.purchases
      .where('productId').equals(purchase.productId).toArray();
    
    if (remainingPurchases.length > 0) {
      const totalCostAmt = remainingPurchases.reduce((s, p) => s + (p.totalCost ?? 0), 0);
      const totalQtyAmt = remainingPurchases.reduce((s, p) => s + (p.quantity ?? 0), 0);
      const newWac = totalQtyAmt > 0 ? totalCostAmt / totalQtyAmt : 0;
      await currentDB.products.update(purchase.productId, { costPrice: newWac });
      setProducts((current) =>
        current.map((prod) =>
          prod.id === purchase.productId ? { ...prod, costPrice: newWac } : prod
        )
      );
    } else {
      // No purchases left — reset costPrice to 0
      await currentDB.products.update(purchase.productId, { costPrice: 0 });
      setProducts((current) =>
        current.map((prod) =>
          prod.id === purchase.productId ? { ...prod, costPrice: 0 } : prod
        )
      );
    }

    setConfirmDeletePurchase(null);
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
      
      // Reverse inventory for each purchase before deleting
      const purchasesToDelete = purchases.filter((p) => selectedIds.includes(p.id));
      
      for (const purchase of purchasesToDelete) {
        if (purchase.productId) {
          const inventoryItem = await currentDB.inventory.where('productId').equals(purchase.productId).first();
          if (inventoryItem && inventoryItem.id) {
            const updatedQuantity = Math.max(0, inventoryItem.quantity - purchase.quantity);
            await currentDB.inventory.update(inventoryItem.id, { quantity: updatedQuantity, lastUpdated: new Date().toISOString() });
            setInventory((current) =>
              current.map((item) =>
                item.id === inventoryItem.id ? { ...item, quantity: updatedQuantity, lastUpdated: new Date().toISOString() } : item
              )
            );
          }
        }
      }
      
      // Now bulk delete the purchases
      await currentDB.purchases.bulkDelete(selectedIds);
      setPurchases((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      
      // Get unique productIds from deleted purchases and recalculate WAC for each
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
      
      // Reload products to reflect updated costPrice values
      const updatedProducts = await currentDB.products.toArray();
      setProducts(updatedProducts);
      
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
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
        <form onSubmit={savePurchase} className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-light-on-surface">
                <span>Product</span>
                <select
                  value={form.productId}
                  onChange={(event) => setForm((current) => ({ ...current, productId: Number(event.target.value) }))}
                  className="w-full rounded-2xl border border-light-outline bg-light-surface-lowest px-4 py-3 outline-none focus:border-brand-500"
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-light-on-surface">
                <span>Supplier</span>
                <select
                  value={form.supplierId}
                  onChange={(event) => setForm((current) => ({ ...current, supplierId: Number(event.target.value) }))}
                  className="w-full rounded-2xl border border-light-outline bg-light-surface-lowest px-4 py-3 outline-none focus:border-brand-500"
                >
                  <option value={0}>No supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-light-on-surface">
                <span>Quantity</span>
                <input
                  type="text"
                  inputMode="decimal"
                  min={1}
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: removeLeadingZeros(event.target.value) }))}
                  onFocus={e => e.target.select()}
                  className="w-full rounded-2xl border border-light-outline bg-light-surface-lowest px-4 py-3 outline-none focus:border-brand-500"
                  required
                />
              </label>
              <label className="space-y-2 text-sm text-light-on-surface">
                <span>Purchase Price</span>
                <input
                  type="text"
                  inputMode="decimal"
                  min={0.01}
                  step="0.01"
                  value={form.costPrice}
                  onChange={(event) => setForm((current) => ({ ...current, costPrice: removeLeadingZeros(event.target.value) }))}
                  onFocus={e => e.target.select()}
                  className="w-full rounded-2xl border border-light-outline bg-light-surface-lowest px-4 py-3 outline-none focus:border-brand-500"
                  required
                />
              </label>
            </div>
            <label className="space-y-2 text-sm text-light-on-surface">
              <span>Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                className="w-full rounded-2xl border border-light-outline bg-light-surface-lowest px-4 py-3 outline-none focus:border-brand-500"
                required
              />
            </label>
            <label className="space-y-2 text-sm text-light-on-surface">
              <span>Expiry Date (optional)</span>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))}
                className="w-full rounded-2xl border border-light-outline bg-light-surface-lowest px-4 py-3 outline-none focus:border-brand-500"
              />
            </label>
            <label className="space-y-2 text-sm text-light-on-surface">
              <span>Note</span>
              <textarea
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                className="w-full rounded-3xl border border-light-outline bg-light-surface-lowest px-4 py-3 outline-none focus:border-brand-500"
              />
            </label>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600">Total cost</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{formatCurrency(totalCost, currency)}</p>
              </div>
              {formError && (
                <p className="text-sm text-red-600 font-medium">{formError}</p>
              )}
              <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700">
                <Plus className="h-4 w-4" />
                Record Purchase
              </button>
            </div>
          </div>
        </form>
      </div>

      <PrintWrapper title="Purchase Report" printLabel="Purchase Report">
        <div className="overflow-x-auto overflow-y-auto max-h-[58vh] rounded-xl border border-slate-200">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Unit Cost</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id} className={isSelected(purchase.id) ? 'bg-red-50' : 'border-b border-slate-200'}>
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
              ))}
            </tbody>
          </table>
        </div>
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
