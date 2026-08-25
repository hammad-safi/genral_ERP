import { useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle, memo, useCallback } from 'react';
import { Plus, Edit3, Trash2, Search, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import PageHeader from '@/components/PageHeader';
import ImageUpload from '@/components/ImageUpload';
import ConfirmDialog from '@/components/ConfirmDialog';
import PrintWrapper from '@/components/PrintWrapper';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import { initDB, getDB } from '@/lib/db';
import { DEFAULT_IMAGE, formatCurrency, forceRepaintAfterRender, removeLeadingZeros } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { useBusiness } from '@/contexts/BusinessContext';
import { useDexiePagination, clearPaginationCache } from '@/hooks/useDexiePagination';
import { useDebounce } from '@/hooks/useDebounce';
import VirtualTable from '@/components/VirtualTable';

const units = ['pcs', 'kg', 'litre', 'bottle', 'pack'];
const DEFAULT_CATEGORIES = ['Antibiotics', 'Vitamins', 'Painkillers', 'Syrup', 'Injections', 'Tablets', 'Creams', 'Other'];

const ProductFormModal = memo(forwardRef(({ currency, categories = [], onSuccess }, ref) => {
  const [openForm, setOpenForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [tempPreviewBarcode, setTempPreviewBarcode] = useState('');
  const [scanFeedback, setScanFeedback] = useState(null);
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [qrHtmlContent, setQrHtmlContent] = useState('');
  const [qrPrintQuantity, setQrPrintQuantity] = useState(1);
  const settings = useSettings();
  const [form, setForm] = useState({
    name: '',
    barcode: '',
    price: '',
    costPrice: 0,
    unit: 'pcs',
    expiryDate: '',
    image: DEFAULT_IMAGE,
    description: '',
    createdAt: new Date().toISOString(),
  });

  useImperativeHandle(ref, () => ({
    openNew: () => {
      setSelectedProduct(null);
      setTempPreviewBarcode(`SHOP-TEMP-${Date.now()}`);
      setForm({
        name: '', barcode: '', price: '', costPrice: 0, unit: 'pcs',
        expiryDate: '', image: DEFAULT_IMAGE, description: '', createdAt: new Date().toISOString(),
      });
      setOpenForm(true);
    },
    openEdit: (product) => {
      setSelectedProduct(product);
      setTempPreviewBarcode(product.barcode?.trim() || `SHOP-TEMP-${Date.now()}`);
      setForm({ ...product, expiryDate: product.expiryDate || '' });
      setOpenForm(true);
    },
    close: () => setOpenForm(false)
  }));

  const saveProduct = async (event) => {
    event.preventDefault();
    if (!form.name) return;

    const currentDB = getDB();
    const barcodeValue = form.barcode?.trim() ?? '';
    const shouldGenerateBarcode = !barcodeValue && !selectedProduct?.barcode;
    let finalBarcode = barcodeValue || selectedProduct?.barcode || '';
    
    // Exclude costPrice from productData as it's managed by purchase WAC calculation
    const { costPrice, ...formDataWithoutCost } = form;
    const productData = { 
      ...formDataWithoutCost, 
      barcode: finalBarcode,
      costPrice: selectedProduct?.id ? selectedProduct.costPrice : 0 // Preserve existing cost or set 0 for new
    };

    if (selectedProduct?.id) {
      await currentDB.products.update(selectedProduct.id, productData);
      if (shouldGenerateBarcode) {
        finalBarcode = `SHOP-${selectedProduct.id}-${Date.now()}`;
        await currentDB.products.update(selectedProduct.id, { barcode: finalBarcode });
      }
      onSuccess('update', { ...productData, barcode: finalBarcode, id: selectedProduct.id });
    } else {
      const id = await currentDB.products.add({ ...productData, createdAt: new Date().toISOString() });
      let savedBarcode = finalBarcode;
      if (shouldGenerateBarcode) {
        savedBarcode = `SHOP-${id}-${Date.now()}`;
        await currentDB.products.update(id, { barcode: savedBarcode });
      }
      await currentDB.inventory.add({
        productId: id, quantity: 0, lowStockThreshold: 10, lastUpdated: new Date().toISOString()
      });
      onSuccess('add', { ...productData, id, barcode: savedBarcode });
    }
    setOpenForm(false);
  };

  const updateBarcode = (value) => setForm((current) => ({ ...current, barcode: value }));

  if (!openForm) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0 bg-white z-10 sticky top-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {selectedProduct ? selectedProduct.name : 'New product'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedProduct ? 'Edit product details' : 'Add a new product'}
            </p>
          </div>
          <button
            onClick={() => setOpenForm(false)}
            type="button"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <form onSubmit={saveProduct} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-900">Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-900">
                  Barcode <span className="text-slate-600 font-normal">(optional)</span>
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Scan or type barcode"
                    value={form.barcode}
                    onChange={(event) => updateBarcode(event.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                    autoComplete="off"
                  />
                  {form.barcode && (
                    <span className="flex items-center text-sm font-medium text-emerald-600">✓</span>
                  )}
                </div>
                <p className="text-xs text-slate-600">Scan with USB scanner or type the barcode number</p>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-900">Unit</span>
                <select
                  value={form.unit}
                  onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                >
                  {units.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-900">Sale Price</span>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: Number(removeLeadingZeros(event.target.value)) }))}
                  onFocus={e => e.target.select()}
                  className="w-full rounded-xl border border-light-outline bg-light-surface-lowest px-4 py-2.5 text-sm text-light-on-surface outline-none transition-colors focus:border-blue-500 focus:bg-light-bg"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-900">Purchase Price</span>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  value={form.costPrice}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-500 outline-none cursor-not-allowed"
                />
                <p className="text-xs text-slate-500">Auto-calculated from purchases</p>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Expiry Date (optional)</span>
                <input
                  type="date"
                  value={form.expiryDate || ''}
                  onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
              />
            </label>

            </div>

          <div className="space-y-5">
            <ImageUpload value={form.image} onChange={(value) => setForm((current) => ({ ...current, image: value }))} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-900 mb-3">QR Code Preview</p>

              <div className="flex flex-col items-center gap-3 bg-white rounded-lg border border-slate-200 p-4">
                <div id="product-qr" className="rounded-lg overflow-hidden">
                  <QRCodeSVG 
                    value={"NAME:" + (form.name || 'Product') + "|PRICE:" + (typeof form.price === 'number' ? form.price : parseFloat(form.price) || 0).toFixed(2) + "|SKU:" + (form.barcode?.trim() || tempPreviewBarcode)}
                    size={160} 
                    includeMargin={true} 
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">{form.name || 'Product Name'}</p>
                  <p className="text-xs text-slate-500">{currency} {(typeof form.price === 'number' ? form.price : parseFloat(form.price) || 0).toFixed(2)}</p>
                  <p className="text-xs text-slate-600 font-mono mt-1">{form.barcode?.trim() || tempPreviewBarcode}</p>
                </div>
              </div>

              {!form.barcode?.trim() && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs text-amber-700">
                    ⚠️ No barcode entered. A unique QR will be auto-generated when you save.
                  </p>
                </div>
              )}

              {scanFeedback && (
                <div className={"mt-3 px-4 py-2 rounded-xl text-sm font-medium " + (
                  scanFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                )}>
                  {scanFeedback.msg}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const svg = document.getElementById('product-qr')?.querySelector('svg');
                      if (!svg) return;
                      const svgData = new XMLSerializer().serializeToString(svg);
                      const blob = new Blob([svgData], { type: 'image/svg+xml' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${form.name || 'product'}-qr.svg`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex-1 rounded-xl border border-blue-600 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    ↓ Save SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const price = typeof form.price === 'number' ? form.price.toFixed(2) : parseFloat(form.price || 0).toFixed(2);
                      const barcode = form.barcode?.trim() || tempPreviewBarcode;
                      const shopName = settings?.shopName || 'Shop ERP';
                      
                      const htmlContent = 
                        '<div class="product-name">' + (form.name || 'Product') + '</div>' +
                        '<div class="product-price">' + currency + ' ' + price + '</div>' +
                        '<div class="product-sku">' + barcode + '</div>' +
                        '<div class="shop-name">' + shopName + '</div>';

                      setQrHtmlContent(htmlContent);
                      setQrPrintQuantity(1);
                      setQrPreviewOpen(true);
                    }}
                    className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    🖨 Print QR
                  </button>
                </div>
              </div>
            </div>
            
          <div className="col-span-full mt-6 flex justify-end gap-3 border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={() => setOpenForm(false)}
              className="rounded-2xl px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              {selectedProduct ? 'Update Product' : 'Save Product'}
            </button>
          </div>

        </form>
      </div>
    </div>

      {qrPreviewOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/60 backdrop-blur-sm px-4 py-10 flex items-center justify-center">
          <div className="mx-auto w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between gap-3 border-b pb-4">
              <h2 className="text-lg font-bold text-slate-900">Print Labels: {form.name || 'Product'}</h2>
              <button 
                onClick={() => setQrPreviewOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-center mb-6">
              <div 
                className="border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center bg-white"
                style={{ width: '220px', textAlign: 'center' }}
                dangerouslySetInnerHTML={{ __html: qrHtmlContent }} 
              />
              <style>{`
                .qr-wrapper { margin-bottom: 2px; }
                .qr-wrapper svg { width: 140px; height: 140px; }
                .product-name { font-weight: bold; font-size: 14px; line-height: 1.2; margin: 4px 0; }
                .product-price { font-size: 14px; font-weight: bold; color: #333; margin: 2px 0; }
                .product-sku { font-family: monospace; font-size: 11px; color: #666; margin: 2px 0; }
                .shop-name { font-size: 10px; margin-top: 8px; color: #333; border-top: 1px solid #eee; padding-top: 4px; width: 100%; }
              `}</style>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 block mb-2">Quantity to Print</label>
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => setQrPrintQuantity(Math.max(1, qrPrintQuantity - 1))}
                  className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                >
                  -
                </button>
                <input 
                  type="number" 
                  value={qrPrintQuantity} 
                  onChange={(e) => setQrPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 h-10 rounded-xl border border-slate-200 text-center text-lg font-semibold outline-none focus:border-brand-500"
                />
                <button 
                  type="button" 
                  onClick={() => setQrPrintQuantity(qrPrintQuantity + 1)}
                  className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                >
                  +
                </button>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (window.electronAPI && window.electronAPI.printQrLabel) {
                    try {
                      const printerName = settings?.labelPrinter || settings?.reportsPrinter;
                      const result = await window.electronAPI.printQrLabel(qrHtmlContent, printerName, qrPrintQuantity);
                      if (result.success) {
                        setScanFeedback({ msg: '✓ QR Label sent to printer.', type: 'success' });
                      } else {
                        setScanFeedback({ msg: '✗ Print failed: ' + result.errorType, type: 'error' });
                      }
                      setTimeout(() => setScanFeedback(null), 3000);
                    } catch (err) {
                      setScanFeedback({ msg: '✗ Print error occurred.', type: 'error' });
                      setTimeout(() => setScanFeedback(null), 3000);
                    }
                  } else {
                    const w = window.open('', '_blank');
                    if (w) {
                      const labelsHtml = Array(qrPrintQuantity).fill('<div class="label">' + qrHtmlContent + '</div>').join('');
                      w.document.write(
                        '<html><head><title>QR Label</title>' +
                        '<style>' +
                        'body { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; padding: 20px; font-family: sans-serif; }' +
                        '.label { border: 1px solid #ccc; padding: 15px; text-align: center; width: 220px; border-radius: 8px; }' +
                        'svg { width: 160px; height: 160px; }' +
                        '.product-name { font-weight: bold; font-size: 14px; margin: 8px 0 4px; }' +
                        '.product-price { font-size: 12px; color: #666; margin: 0; }' +
                        '.product-sku { font-size: 10px; color: #999; margin-top: 4px; font-family: monospace; }' +
                        '.shop-name { font-size: 10px; margin-top: 10px; border-top: 1px solid #eee; padding-top: 5px; }' +
                        '@media print { body { margin: 0; } .label { page-break-inside: avoid; } }' +
                        '</style></head><body>' + labelsHtml +
                        '<script>window.onload = () => { window.print(); window.close(); }</script></body></html>'
                      );
                    }
                  }
                  setQrPreviewOpen(false);
                }}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-md active:scale-95"
              >
                🖨 Print {qrPrintQuantity} Labels
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}));

export default function Products() {
  const modalRef = useRef(null);
  const { businessColor } = useBusiness();
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';

  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [showPrintLabels, setShowPrintLabels] = useState(false);

  useEffect(() => {
    const load = async () => {
      await initDB();
      const currentDB = getDB();
      const inventoryData = await currentDB.inventory.toArray();
      setInventory(inventoryData);
      setCategories(DEFAULT_CATEGORIES);
    };
    load();
  }, []);

  const queryBuilder = useCallback((db) => {
    let query = db.products;
    
    if (debouncedSearch) {
      return query
        .where('name').startsWithIgnoreCase(debouncedSearch)
        .or('barcode').startsWithIgnoreCase(debouncedSearch);
    }
    
    return query.reverse();
  }, [debouncedSearch]);

  const { data: visibleData, loadMoreRef, hasMore, totalCount, refresh } = useDexiePagination(queryBuilder, [debouncedSearch], 20, null, 'products');

  const openNewProduct = () => modalRef.current?.openNew();
  const openEditProduct = (product) => modalRef.current?.openEdit(product);

  const removeProduct = async () => {
    if (!selectedProduct?.id) return;
    const idToDelete = selectedProduct.id;
    const currentDB = getDB();

    try {
      await currentDB.products.delete(idToDelete);
      await currentDB.inventory.where('productId').equals(idToDelete).delete();
    } catch (error) {
      console.error('Error deleting product:', error);
      return;
    }

    // Update state via refresh
    refresh();
    setConfirmDelete(false);
    setSelectedProduct(null);
    modalRef.current?.close();

    // Force repaint after React DOM updates complete
    forceRepaintAfterRender();
  };

  const productInventory = (productId) => inventory.find((item) => item.productId === productId);

  // Toggle single product selection
  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Toggle select all (selects current visible data)
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
      setSelectAll(false);
    } else {
      setSelectedIds(visibleData.map(p => p.id));
      setSelectAll(true);
    }
  };

  // Memoize the entire table rendering block separately so typing in the form doesn't cause a massive React re-render of thousands of nodes
  const tableContent = useMemo(() => {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or barcode"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="rounded-lg bg-slate-100 px-3 py-1 font-medium">{totalCount} products</span>
          </div>
        </div>
      </div>
    );
  }, [search, totalCount]);

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
    { header: "Product" },
    { header: "Barcode" },
    { header: "Sale Price" },
    { header: "Purchase Price" },
    { header: "Unit" },
    { header: "Expiry" },
    { header: "Stock" },
    { header: "Actions" },
  ];

  const renderProductRow = (product, virtualIndex, measureRef) => (
    <tr
      key={product.id}
      ref={measureRef}
      data-index={virtualIndex}
      className={selectedIds.includes(product.id) ? 'bg-red-50' : 'hover:bg-slate-50 transition-colors'}
    >
      <td className="px-4 py-4">
        <input
          type="checkbox"
          checked={selectedIds.includes(product.id)}
          onChange={() => toggleSelect(product.id)}
          className="w-4 h-4 rounded cursor-pointer"
        />
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <img src={product.image} alt={product.name} className="h-12 w-12 rounded-xl object-cover" />
          <div>
            <p className="font-semibold text-slate-900">{product.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  product.barcode ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {product.barcode ? '✓ Has Barcode' : '○ Name Only'}
              </span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-slate-700 font-mono text-xs">{product.barcode || '-'}</td>
      <td className="px-4 py-4 font-semibold text-slate-900">{formatCurrency(product.price, currency)}</td>
      <td className="px-4 py-4 text-slate-600">{formatCurrency(product.costPrice, currency)}</td>
      <td className="px-4 py-4 text-slate-600 text-xs">{product.unit}</td>
      <td className="px-4 py-4 text-slate-600 text-xs">
        {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : '-'}
      </td>
      <td className="px-4 py-4">
        <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
          (productInventory(product.id)?.quantity ?? 0) <= 0
            ? 'bg-red-100 text-red-700'
            : (productInventory(product.id)?.quantity ?? 0) <= (product.lowStockThreshold || 10)
            ? 'bg-amber-100 text-amber-700'
            : 'bg-emerald-100 text-emerald-700'
        }`}>
          {productInventory(product.id)?.quantity ?? 0}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditProduct(product)}
            className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setSelectedProduct(product);
              setConfirmDelete(true);
            }}
            className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );

  const memoizedTable = useMemo(() => {
    return (
      <div className="mt-6">
        <VirtualTable
          data={visibleData}
          columns={tableColumns}
          renderRow={renderProductRow}
          hasMore={hasMore}
          loadMoreRef={loadMoreRef}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <svg className="h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm">No products found</p>
            </div>
          }
        />
      </div>
    );
  }, [visibleData, selectedIds, selectAll, debouncedSearch, currency, inventory, totalCount, hasMore]);


  // Step 1: user clicks delete bar → show React confirm dialog (NOT window.confirm)
  // window.confirm() is a native OS dialog in Electron — when it closes, Electron's render
  // process loses paint ownership and freezes until minimized. React dialog avoids this entirely.
  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    setConfirmBulkDelete(true);
  };

  // Step 2: user confirms inside the React dialog → do the actual deletion
  const performBulkDelete = async () => {
    setConfirmBulkDelete(false);
    setIsDeleting(true);
    try {
      const currentDB = getDB();
      await currentDB.inventory.where('productId').anyOf(selectedIds).delete();
      await currentDB.products.bulkDelete(selectedIds);
      refresh();
      setSelectedIds([]);
      setSelectAll(false);
      // Force repaint after React DOM updates complete
      forceRepaintAfterRender();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Update selectAll when visibleData or selectedIds change
  useEffect(() => {
    const allSelected = visibleData.length > 0 && visibleData.every(p => selectedIds.includes(p.id));
    setSelectAll(allSelected);
  }, [visibleData, selectedIds]);

  const productQRCodes = useMemo(() => {
    if (!showPrintLabels) return [];

    const itemsToPrint = selectedIds.length > 0 
      ? visibleData.filter(p => selectedIds.includes(p.id)) 
      : visibleData.slice(0, 300);

    return itemsToPrint.map((product) => (
      <div key={product.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center break-inside-avoid">
        <div className="mb-3 grid place-items-center">
          <QRCodeSVG 
            value={"NAME:" + (product.name || 'Product') + "|PRICE:" + (typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0).toFixed(2) + "|SKU:" + (product.barcode || '')} 
            size={120} 
            includeMargin 
          />
        </div>
        <p className="font-semibold text-slate-900">{product.name}</p>
        <p className="text-sm text-slate-600">{formatCurrency(product.price, currency)}</p>
        <p className="text-xs text-slate-500 mt-2">{product.barcode}</p>
      </div>
    ));
  }, [visibleData, selectedIds, currency, showPrintLabels]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Add, edit, and print product QR labels"
        action={
          <button
            type="button"
            onClick={openNewProduct}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        }
      />

      {tableContent}
      {memoizedTable}

      <ProductFormModal 
        ref={modalRef} 
        currency={currency} 
        categories={categories}
        onSuccess={async (mode, productData) => {
          refresh(true);
          clearPaginationCache('inventory'); // Clear inventory cache so it reloads fresh
          const currentDB = getDB();
          const inventoryData = await currentDB.inventory.toArray();
          setInventory(inventoryData);
          forceRepaintAfterRender();
        }} 
      />

      <PrintWrapper title="Print QR Labels" printLabel="QR Labels">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowPrintLabels(prev => !prev)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {showPrintLabels ? '▲ Hide QR Labels' : '▼ Load QR Labels'}
          </button>
          {!showPrintLabels && (
            <p className="mt-2 text-xs text-slate-500">Click to generate QR codes for printing.</p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {productQRCodes}
        </div>
      </PrintWrapper>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete product"
        description="This will remove the product and its inventory record. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => {
          setConfirmDelete(false);
          setSelectedProduct(null);
        }}
        onConfirm={removeProduct}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selectedIds.length} products?`}
        description="This will permanently remove the selected products and their inventory records. This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={performBulkDelete}
      />

      <BulkDeleteBar
        selectedCount={selectedIds.length}
        onDelete={deleteSelected}
        onCancel={() => { setSelectedIds([]); setSelectAll(false); }}
        itemLabel="product"
        isDeleting={isDeleting}
      />
    </div>
  );
}
