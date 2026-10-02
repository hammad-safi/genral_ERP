import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Package, Image as ImageIcon, Tag, Layers, Receipt, 
  TrendingUp, Calendar, FileText, AlertCircle, CheckCircle, 
  Download, Printer, Edit3, Info, Check, Plus, X, Pill 
} from 'lucide-react';
import Barcode from 'react-barcode';
import CustomSelect from '@/components/CustomSelect';
import { api } from '@/lib/api';
import { DEFAULT_IMAGE, removeLeadingZeros } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function ProductFormView({ 
  initialProduct = null, 
  categories = [], 
  currency = 'Rs', 
  onClose, 
  onSuccess 
}) {
  const settings = useSettings();
  const fileInputRef = useRef(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [tempPreviewBarcode, setTempPreviewBarcode] = useState('');
  const [addingCategoryState, setAddingCategoryState] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [qrHtmlContent, setQrHtmlContent] = useState('');
  const [qrPrintQuantity, setQrPrintQuantity] = useState(1);
  const [scanFeedback, setScanFeedback] = useState(null);

  const [selectedRootCatId, setSelectedRootCatId] = useState(null);
  const [selectedSubCatId, setSelectedSubCatId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    category: null,
    barcode: '',
    price: '',
    wholesalePrice: '',
    costPrice: 0,
    unit: 'pcs',
    expiryDate: '',
    image: DEFAULT_IMAGE,
    description: '',
    quickNotes: '',
    createdAt: new Date().toISOString(),
  });

  // Category hierarchy parsing
  useEffect(() => {
    if (initialProduct) {
      setTempPreviewBarcode(initialProduct.barcode?.trim() || `${Date.now()}`);
      setForm({
        ...initialProduct,
        price: initialProduct.price ?? '',
        wholesalePrice: initialProduct.wholesalePrice ?? '',
        costPrice: initialProduct.costPrice ?? 0,
        expiryDate: initialProduct.expiryDate || '',
        image: initialProduct.image || DEFAULT_IMAGE,
        description: initialProduct.description || '',
        quickNotes: initialProduct.quickNotes || initialProduct.attributes?.quickNotes || '',
        unit: initialProduct.unit || 'pcs',
      });

      const catMap = new Map(categories.map(c => [String(c.id), c]));
      let curr = catMap.get(String(initialProduct.category));
      if (curr) {
        if (curr.parentId) {
          setSelectedRootCatId(curr.parentId);
          setSelectedSubCatId(curr.id);
        } else {
          setSelectedRootCatId(curr.id);
          setSelectedSubCatId(null);
        }
      }
    } else {
      const defaultRoot = categories.find(c => !c.parentId);
      const defaultSub = defaultRoot ? categories.find(c => String(c.parentId) === String(defaultRoot.id)) : null;

      setSelectedRootCatId(defaultRoot?.id || null);
      setSelectedSubCatId(defaultSub?.id || null);
      setTempPreviewBarcode(`${Date.now()}`);
      setForm({
        name: '',
        category: defaultSub?.id || defaultRoot?.id || null,
        barcode: '',
        price: '',
        wholesalePrice: '',
        costPrice: 0,
        unit: 'pcs',
        expiryDate: '',
        image: DEFAULT_IMAGE,
        description: '',
        quickNotes: '',
        createdAt: new Date().toISOString(),
      });
    }
  }, [initialProduct, categories]);

  // Dropdown options
  const rootCategoryOptions = categories
    .filter(c => !c.parentId)
    .map(c => ({ label: c.name, value: c.id }));

  const subCategoryOptions = selectedRootCatId
    ? categories
        .filter(c => String(c.parentId) === String(selectedRootCatId))
        .map(c => ({ label: c.name, value: c.id }))
    : [];

  const handleRootCatChange = (newRootId) => {
    setSelectedRootCatId(newRootId);
    const subCats = categories.filter(c => String(c.parentId) === String(newRootId));
    if (subCats.length > 0) {
      setSelectedSubCatId(subCats[0].id);
      setForm(prev => ({ ...prev, category: subCats[0].id }));
    } else {
      setSelectedSubCatId(null);
      setForm(prev => ({ ...prev, category: newRootId }));
    }
  };

  const handleSubCatChange = (newSubId) => {
    setSelectedSubCatId(newSubId);
    setForm(prev => ({ ...prev, category: newSubId }));
  };

  // Profit Margins
  const saleP = typeof form.price === 'number' ? form.price : parseFloat(form.price || 0);
  const costP = typeof form.costPrice === 'number' ? form.costPrice : parseFloat(form.costPrice || 0);
  const retailProfit = saleP - costP;
  const retailMargin = saleP > 0 ? (retailProfit / saleP) * 100 : 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProduct(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [form, initialProduct]);

  // Image Upload helper
  const handleImageFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm(prev => ({ ...prev, image: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  // SVG Download
  const handleSaveSvg = () => {
    const svg = document.getElementById('product-qr')?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.name || 'product'}-barcode.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print Label Modal trigger
  const handlePrintLabel = () => {
    const price = typeof form.price === 'number' ? form.price.toFixed(2) : parseFloat(form.price || 0).toFixed(2);
    const barcode = form.barcode?.trim() || tempPreviewBarcode;
    const shopName = settings?.shopName || 'Shop ERP';
    
    const htmlContent = 
      '<div class="qr-wrapper">' + (document.getElementById('product-qr')?.querySelector('svg')?.outerHTML || '') + '</div>' + 
      '<div class="product-name">' + (form.name || 'Product') + '</div>' +
      '<div class="product-price">' + currency + ' ' + price + '</div>' +
      '<div class="product-sku">' + barcode + '</div>' +
      '<div class="shop-name">' + shopName + '</div>';

    setQrHtmlContent(htmlContent);
    setQrPrintQuantity(1);
    setQrPreviewOpen(true);
  };

  // Form Submit / Save
  const saveProduct = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!form.name) return;

    const barcodeValue = form.barcode?.trim() ?? '';
    const shouldGenerateBarcode = !barcodeValue && !initialProduct?.barcode;
    let finalBarcode = barcodeValue || initialProduct?.barcode || '';
    if (shouldGenerateBarcode) {
      finalBarcode = `${Date.now()}`;
    }
    
    const { costPrice, ...formDataWithoutCost } = form;
    const productData = { 
      ...formDataWithoutCost,
      category: form.category || selectedSubCatId || selectedRootCatId || null,
      unit: form.unit || 'pcs',
      quickNotes: form.quickNotes || '',
      attributes: {
        ...(initialProduct?.attributes || {}),
        quickNotes: form.quickNotes || ''
      },
      barcode: finalBarcode,
      costPrice: initialProduct?.id ? initialProduct.costPrice : 0
    };

    if (initialProduct?.id) {
      onSuccess('update', { ...productData, barcode: finalBarcode, id: initialProduct.id });
      api.updateProduct(initialProduct.id, productData).catch(err => {
        console.error('Error updating product:', err);
      });
    } else {
      const tempId = Date.now();
      const tempProduct = { ...productData, id: tempId, barcode: finalBarcode, stockQuantity: 0 };
      onSuccess('add', tempProduct);
      api.createProduct(productData).catch(err => {
        console.error('Error creating product:', err);
      });
    }
  };

  return (
    <div className="w-full text-slate-800">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="text-blue-600 hover:text-blue-700 p-0.5 -ml-1 rounded-lg hover:bg-blue-50 transition-colors"
              title="Back to Products"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {initialProduct ? 'Edit Product' : 'New Product'}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-200/60">
              <Pill className="w-3.5 h-3.5" />
              Medication & Retail Item
            </span>
          </div>
          <p className="text-xs text-slate-500 font-normal pl-6">
            Enter pharmaceutical or retail item specifications, pricing, and barcode identifiers.
          </p>
        </div>
      </div>

      {/* Main Grid: Left Column & Right Column */}
      <form onSubmit={saveProduct} className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          
          {/* Row 1: Product Name & Product Image */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Product Name Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <label className="text-xs font-bold text-slate-800 tracking-wide">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Augmentin 625mg Tablet"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 font-medium placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>
              <div className="flex justify-between items-center text-[11px] font-medium text-slate-400 mt-2.5">
                <span>Brand + Formulation + Strength</span>
                <span>Max 5MB</span>
              </div>
            </div>

            {/* Product Image Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 tracking-wide">
                  Product Image
                </span>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true); }}
                onDragLeave={() => setIsDraggingImage(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingImage(false);
                  if (e.dataTransfer.files?.[0]) handleImageFile(e.dataTransfer.files[0]);
                }}
                className={`border border-dashed rounded-xl p-2 text-center cursor-pointer transition-all flex flex-col items-center justify-center relative min-h-[76px] ${
                  isDraggingImage 
                    ? 'border-blue-500 bg-blue-50/50' 
                    : 'border-blue-200/80 bg-blue-50/20 hover:bg-blue-50/40'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
                  }}
                  accept="image/*"
                  className="hidden"
                />
                {form.image && form.image !== DEFAULT_IMAGE && !form.image.includes('AAAAWUlEQVR4Xu3BAQ0AAADCIPunNscw') && !form.image.includes('data:image/svg+xml') ? (
                  <div className="relative group w-full h-16 flex items-center justify-center">
                    <img src={form.image} alt="Product" className="h-full object-contain rounded-lg" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm((prev) => ({ ...prev, image: DEFAULT_IMAGE }));
                      }}
                      className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-xs transition-all"
                      title="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-1">
                    <div className="w-7 h-7 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center mb-0.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 leading-tight">Upload Image</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Drag and drop or click to browse</span>
                    <span className="text-[10px] text-slate-400">JPG, PNG (Max 5MB)</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Category & Subcategory (Exact 2 cards matching Image 1) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Category Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4" />
                </div>
                <label className="text-xs font-bold text-slate-800 tracking-wide">
                  Category <span className="text-red-500">*</span>
                </label>
              </div>
              <CustomSelect
                value={selectedRootCatId}
                onChange={handleRootCatChange}
                options={rootCategoryOptions}
                placeholder="Select category"
              />
            </div>

            {/* Subcategory Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <label className="text-xs font-bold text-slate-800 tracking-wide">
                  Subcategory <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <CustomSelect
                  value={selectedSubCatId}
                  onChange={handleSubCatChange}
                  options={subCategoryOptions}
                  placeholder={subCategoryOptions.length === 0 ? "No subcategories yet..." : "Select subcategory"}
                />
                <button
                  type="button"
                  onClick={() => setAddingCategoryState({ parentId: selectedRootCatId || null })}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-600 transition-colors shadow-2xs shrink-0"
                  title="Add subcategory"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Pricing Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
              {/* Sale Price (Retail) */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <label className="text-xs font-bold text-slate-800 tracking-wide">
                    Sale Price (Retail) <span className="text-red-500">*</span>
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-medium text-xs">
                    {currency}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={form.price}
                    onChange={(e) => setForm((prev) => ({ ...prev, price: Number(removeLeadingZeros(e.target.value)) }))}
                    onFocus={(e) => e.target.select()}
                    placeholder="650.00"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm text-slate-900 font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  />
                </div>
              </div>

              {/* Wholesale Price */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <label className="text-xs font-bold text-slate-800 tracking-wide">
                    Wholesale Price
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-medium text-xs">
                    {currency}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.wholesalePrice || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, wholesalePrice: e.target.value ? Number(removeLeadingZeros(e.target.value)) : '' }))}
                    onFocus={(e) => e.target.select()}
                    placeholder="580.00"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm text-slate-900 font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  />
                </div>
              </div>

              {/* Purchase Price */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <label className="text-xs font-bold text-slate-800 tracking-wide">
                    Purchase Price
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-medium text-xs">
                    {currency}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.costPrice}
                    disabled
                    placeholder="500.00"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-3 py-2 text-sm text-slate-600 font-bold outline-none cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Profit Margin Strip */}
            <div className="mt-3 rounded-xl bg-blue-50/70 border border-blue-100/80 px-3.5 py-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-blue-900">Estimated Gross Profit: </span>
                <span className="font-bold text-blue-700">
                  Retail: +{retailMargin.toFixed(1)}% Margin ({currency} {retailProfit.toFixed(2)} profit/unit)
                </span>
              </div>
            </div>
          </div>

          {/* Row 4: Expiry Date & Description/Storage Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Expiry Date Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <label className="text-xs font-bold text-slate-800 tracking-wide">
                    Expiry Date <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                </div>
                <input
                  type="date"
                  value={form.expiryDate || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">
                Enables automatic expiry warnings in Batch Management (FEFO).
              </p>
            </div>

            {/* Description & Storage Notes */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <label className="text-xs font-bold text-slate-800 tracking-wide">
                    Description & Storage Notes
                  </label>
                </div>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={form.description || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Antibiotic medicine. Use as directed by physician. Store below 25°C. Protect from light and moisture."
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none resize-none"
                />
              </div>
              <div className="text-[10px] text-slate-400 text-right font-medium mt-0.5">
                {form.description?.length || 0}/500
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          {/* Barcode Preview Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 tracking-wide">
                  Barcode Preview
                </span>
              </div>
              <span className="rounded-full bg-blue-50 text-blue-600 border border-blue-200/60 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                AUTO-GENERATED
              </span>
            </div>

            {/* Barcode Graphic Box */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 flex flex-col items-center justify-center text-center shadow-2xs">
              <div id="product-qr" className="w-full flex justify-center py-0.5">
                <Barcode
                  value={form.barcode?.trim() || tempPreviewBarcode}
                  width={1.6}
                  height={48}
                  displayValue={false}
                  margin={0}
                  background="transparent"
                />
              </div>
              <div className="mt-2 space-y-0.5">
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  {form.name || 'Product Name'}
                </p>
                <p className="text-xs font-bold text-blue-600">
                  {currency} {(typeof form.price === 'number' ? form.price : parseFloat(form.price) || 0).toFixed(2)}
                </p>
                <p className="text-[11px] font-mono text-slate-500 tracking-wider">
                  {form.barcode?.trim() || tempPreviewBarcode}
                </p>
              </div>
            </div>

            {/* Warning notice */}
            {!form.barcode?.trim() ? (
              <div className="rounded-xl bg-amber-50/80 border border-amber-200/80 p-3 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                  No barcode entered. A unique barcode and SKU will be auto-generated when you save.
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-blue-50/70 border border-blue-200/70 p-2.5 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 font-medium font-mono truncate">
                  Custom: {form.barcode}
                </p>
              </div>
            )}

            {/* Action Buttons with exact button theme */}
            <div className="flex items-center gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={handleSaveSvg}
                className="flex-1 rounded-xl border border-blue-200 bg-white hover:bg-blue-50/40 text-blue-600 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                Save SVG
              </button>
              <button
                type="button"
                onClick={handlePrintLabel}
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-white" />
                Print Label
              </button>
            </div>
          </div>

          {/* Quick Notes Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <label className="text-xs font-bold text-slate-800 tracking-wide">
                  Quick Notes
                </label>
              </div>
              <textarea
                rows={3}
                maxLength={500}
                value={form.quickNotes || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, quickNotes: e.target.value }))}
                placeholder="Keep in cool and dry place.&#10;Store below 25°C."
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none resize-none font-sans"
              />
            </div>
            <div className="text-[10px] text-slate-400 text-right font-medium mt-1">
              {form.quickNotes?.length || 0}/500
            </div>
          </div>
        </div>

        {/* Bottom Static Action Bar */}
        <div className="col-span-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 mt-1 border-t border-slate-200/80">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Info className="w-4 h-4 text-slate-400" />
            <span>
              Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-semibold text-[10px]">Esc</kbd> to cancel, <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-semibold text-[10px]">Ctrl+S</kbd> to save
            </span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-7 py-2.5 text-xs transition-colors shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-2.5 text-xs shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              {initialProduct ? 'Update Product' : 'Save Product'}
            </button>
          </div>
        </div>
      </form>

      {/* QR/Barcode Label Print Modal */}
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
                .qr-wrapper svg { width: 100%; height: auto; max-height: 50px; }
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
                  className="flex-1 h-10 rounded-xl border border-slate-200 text-center text-lg font-semibold outline-none focus:border-blue-500"
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
                type="button"
                onClick={async () => {
                  if (window.electronAPI && window.electronAPI.printQrLabel) {
                    try {
                      const printerName = settings?.labelPrinter || settings?.reportsPrinter;
                      const result = await window.electronAPI.printQrLabel(qrHtmlContent, printerName, qrPrintQuantity);
                      if (result.success) {
                        setScanFeedback({ msg: '✓ Label sent to printer.', type: 'success' });
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
                        '<html><head><title>Barcode Label</title>' +
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

      {/* Add Category/Subcategory Modal */}
      {addingCategoryState && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <h3 className="font-bold text-slate-900">
                {addingCategoryState.parentId ? "Add Subcategory" : "Add Main Category"}
              </h3>
              <button 
                type="button" 
                onClick={() => setAddingCategoryState(null)} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Category Name</label>
              <input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = newCategoryName.trim();
                    if (val) {
                      const res = await fetch('/api/categories?search=' + encodeURIComponent(val));
                      const data = await res.json();
                      const items = data.data || data || [];
                      const existing = items.find(c => c.name === val);
                      let newId;
                      if (!existing) {
                        const postRes = await fetch('/api/categories', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: val,
                            parentId: addingCategoryState.parentId || null,
                            status: 'Active'
                          })
                        });
                        const created = await postRes.json();
                        newId = created.id;
                        categories.push({ id: newId, name: val, parentId: addingCategoryState.parentId });
                      } else {
                        newId = existing.id;
                      }

                      if (addingCategoryState.parentId) {
                        setSelectedSubCatId(newId);
                        setForm(prev => ({ ...prev, category: newId }));
                      } else {
                        setSelectedRootCatId(newId);
                        setForm(prev => ({ ...prev, category: newId }));
                      }
                    }
                    setAddingCategoryState(null);
                    setNewCategoryName('');
                  } else if (e.key === 'Escape') {
                    setAddingCategoryState(null);
                  }
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 outline-none"
                placeholder="e.g. Tablets"
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setAddingCategoryState(null)} 
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={async () => {
                  const val = newCategoryName.trim();
                  if (val) {
                    const postRes = await fetch('/api/categories', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: val,
                        parentId: addingCategoryState.parentId || null,
                        status: 'Active'
                      })
                    });
                    const created = await postRes.json();
                    const newId = created.id;
                    categories.push({ id: newId, name: val, parentId: addingCategoryState.parentId });
                    if (addingCategoryState.parentId) {
                      setSelectedSubCatId(newId);
                      setForm(prev => ({ ...prev, category: newId }));
                    } else {
                      setSelectedRootCatId(newId);
                      setForm(prev => ({ ...prev, category: newId }));
                    }
                  }
                  setAddingCategoryState(null);
                  setNewCategoryName('');
                }} 
                className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
