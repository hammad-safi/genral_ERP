import { api } from '@/lib/api';
import { useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle, memo, useCallback } from 'react';
import { Plus, Edit3, Trash2, Search, X, Box, Package, CheckCircle, AlertTriangle, Tag, LayoutGrid, Layers, Calendar } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import PageHeader from '@/components/PageHeader';
import StatsCard from '@/components/StatsCard';
import PaginationFooter from '@/components/PaginationFooter';
import ImageUpload from '@/components/ImageUpload';
import ConfirmDialog from '@/components/ConfirmDialog';
import BulkDeleteBar from '@/components/BulkDeleteBar';
import ProductFormView from '@/components/ProductFormView';

import { DEFAULT_IMAGE, formatCurrency, forceRepaintAfterRender, removeLeadingZeros } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { useBusiness } from '@/contexts/BusinessContext';
import { useApiPagination, clearPaginationCache } from '@/hooks/useApiPagination';

import { useDebounce } from '@/hooks/useDebounce';
import GlobalTable from '@/components/GlobalTable';
import GlobalButton from '@/components/GlobalButton';
import GlobalSearch from '@/components/GlobalSearch';
import PrintWrapper from '@/components/PrintWrapper';
import GlobalFilter from '@/components/GlobalFilter';
import ColumnVisibilityDropdown from '@/components/ColumnVisibilityDropdown';

import RowsDropdown from '@/components/RowsDropdown';

const units = ['pcs', 'kg', 'litre', 'bottle', 'pack'];

const CustomSelect = ({ value, onChange, options, placeholder = "Select option..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm font-medium outline-none transition-all ${
          isOpen ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className={`truncate text-left ${value ? 'text-slate-900' : 'text-slate-500'}`}>
          {(() => {
            if (!value) return placeholder;
            const selectedOpt = options.find(o => (typeof o === 'object' ? String(o.value) === String(value) : String(o) === String(value)));
            return selectedOpt ? (typeof selectedOpt === 'object' ? selectedOpt.label : selectedOpt) : value;
          })()}
        </span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-xl bg-white shadow-xl border border-slate-100 overflow-hidden flex flex-col">
          <div className="py-2.5 px-4 text-sm text-slate-500 border-b border-slate-100 bg-slate-50/50">
             {placeholder}
          </div>
          <div className="max-h-60 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {options.map((option) => {
              const isObj = typeof option === 'object' && option !== null;
              const optLabel = isObj ? option.label : option;
              const optValue = isObj ? option.value : option;
              const isSelected = value === optValue;
              
              return (
                <button
                  key={optValue}
                  type="button"
                  onClick={() => {
                    onChange(optValue);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    isSelected 
                      ? 'bg-blue-600 text-white font-medium' 
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {optLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const ProductFormModal = memo(forwardRef(({ currency, categories = [], onSuccess }, ref) => {
  const [openForm, setOpenForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [tempPreviewBarcode, setTempPreviewBarcode] = useState('');
  const [scanFeedback, setScanFeedback] = useState(null);
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [qrHtmlContent, setQrHtmlContent] = useState('');
  const [qrPrintQuantity, setQrPrintQuantity] = useState(1);
  const [addingCategoryState, setAddingCategoryState] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const settings = useSettings();
  const [form, setForm] = useState({
    name: '',
    category: categories.find(c => !c.parentId)?.id || null,
    barcode: '',
    price: '', wholesalePrice: '',
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
      setTempPreviewBarcode(`${Date.now()}`);
      setForm({
        name: '', barcode: '', price: '', wholesalePrice: '', costPrice: 0, unit: 'pcs', category: categories.find(c => !c.parentId)?.id || null,
        expiryDate: '', image: DEFAULT_IMAGE, description: '', createdAt: new Date().toISOString(),
      });
      setOpenForm(true);
    },
    openEdit: (product) => {
      setSelectedProduct(product);
      setTempPreviewBarcode(product.barcode?.trim() || `${Date.now()}`);
      setForm({ ...product, category: product.category || (categories.find(c => !c.parentId)?.id || null), expiryDate: product.expiryDate || '' });
      setOpenForm(true);
    },
    close: () => setOpenForm(false)
  }));

  const saveProduct = async (event, addAnother = false) => {
    if (event && event.preventDefault) event.preventDefault();
    if (!form.name) return;

    const barcodeValue = form.barcode?.trim() ?? '';
    const shouldGenerateBarcode = !barcodeValue && !selectedProduct?.barcode;
    let finalBarcode = barcodeValue || selectedProduct?.barcode || '';
    if (shouldGenerateBarcode) {
      finalBarcode = `${Date.now()}`;
    }
    
    // Exclude costPrice from productData as it's managed by purchase WAC calculation
    const { costPrice, ...formDataWithoutCost } = form;
    const productData = { 
      ...formDataWithoutCost, 
      barcode: finalBarcode,
      costPrice: selectedProduct?.id ? selectedProduct.costPrice : 0 // Preserve existing cost or set 0 for new
    };

    if (selectedProduct?.id) {
      await api.updateProduct(selectedProduct.id, productData);
      onSuccess('update', { ...productData, barcode: finalBarcode, id: selectedProduct.id });
    } else {
      const createdProduct = await api.createProduct(productData);
      const id = createdProduct?.id;
      onSuccess('add', { ...productData, ...createdProduct, id, barcode: finalBarcode });
    }
    
    if (addAnother) {
      // Reset form but keep category
      setSelectedProduct(null);
      setTempPreviewBarcode(`${Date.now()}`);
      setForm(prev => ({
        name: '', barcode: '', price: '', wholesalePrice: '', costPrice: 0, unit: 'pcs', category: prev.category,
        expiryDate: '', image: DEFAULT_IMAGE, description: '', createdAt: new Date().toISOString(),
      }));
    } else {
      setOpenForm(false);
    }
  };

  const updateBarcode = (value) => setForm((current) => ({ ...current, barcode: value }));

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!openForm) return;
      if (e.key === 'Escape') {
        setOpenForm(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProduct();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openForm, form, selectedProduct]);

  if (!openForm) return null;

  return (
    <>
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-8 py-6 shrink-0 bg-white z-10 sticky top-0">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">
                {selectedProduct ? 'Edit Product' : 'New Product'}
              </h2>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-200/50">
                Medication & Retail Item
              </span>
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              Enter pharmaceutical or retail item specifications, pricing, and barcode identifiers.
            </p>
          </div>
          <button
            onClick={() => setOpenForm(false)}
            type="button"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors mt-0.5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-8 pb-8 overflow-y-auto">
          <form onSubmit={saveProduct} className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            
            {/* Product Name */}
            <label className="block space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">Product Name <span className="text-red-500">*</span></span>
                <span className="text-[11px] font-medium text-slate-400">Brand + Formulation + Strength</span>
              </div>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-300 font-medium"
                placeholder="Augmentin 625mg Tablet"
                required
              />
            </label>

            {/* Categories and Unit */}
            <div className="grid gap-5 sm:grid-cols-2 relative z-20">
              {(() => {
                const chain = [];
                let currId = form.category;
                let safeCount = 0;
                while (currId && safeCount < 20) {
                  chain.unshift(currId);
                  const cat = categories.find(c => c.id === currId || c.id === Number(currId));
                  if (!cat) break;
                  currId = cat.parentId;
                  safeCount++;
                }
                
                const levels = [];
                const maxLevels = 3;
                const levelNames = ["Category", "Subcategory", "Sub-Subcategory"];
                
                for (let i = 0; i <= chain.length && i < maxLevels; i++) {
                  const currentParentId = i === 0 ? null : chain[i-1];
                  
                  const opts = categories.filter(c => {
                    const cParentId = c.parentId ? Number(c.parentId) : null;
                    const targetParentId = currentParentId !== null ? Number(currentParentId) : null;
                    return cParentId === targetParentId;
                  }).map(c => ({ label: c.name, value: c.id }));
                  
                  const selectedVal = chain[i] || null;
                  
                  levels.push(
                    <div className="space-y-2" key={`cat-level-${i}`}>
                      <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">
                        {levelNames[i]} {i === 0 && <span className="text-red-500">*</span>}
                      </span>
                      <div className="flex items-center gap-2 w-full">
                        <div className="flex-1">
                          <CustomSelect
                            value={selectedVal}
                            onChange={(val) => setForm(current => ({ ...current, category: val }))}
                            options={opts}
                            placeholder={opts.length === 0 ? `No ${levelNames[i].toLowerCase()}s yet...` : `Select ${levelNames[i].toLowerCase()}...`}
                          />
                        </div>
                        <button type="button" onClick={() => setAddingCategoryState({ parentId: currentParentId })} className="shrink-0 w-11 h-11 flex items-center justify-center border border-slate-200 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" title={`Add new ${levelNames[i].toLowerCase()}`}>
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                  
                  if (!selectedVal) break;
                }
                
                return (
                  <>
                    {/* Position 1: Main Category */}
                    {levels[0]}

                    {/* Position 2: Dispensing Unit */}
                    <div className="space-y-2 relative z-10">
                      <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">Dispensing Unit <span className="text-red-500">*</span></span>
                      <CustomSelect
                        value={form.unit}
                        onChange={(val) => setForm((current) => ({ ...current, unit: val }))}
                        options={units}
                        placeholder="Select unit..."
                      />
                    </div>

                    {/* Position 3 & 4: Subcategory & Sub-Subcategory */}
                    {levels[1] && levels[1]}
                    {levels[2] && levels[2]}
                  </>
                );
              })()}
            </div>

            {/* Barcode */}
            <label className="block space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">
                  Barcode / SKU <span className="text-slate-400 font-medium lowercase normal-case">(optional)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 pl-1.5 pr-2 py-0.5 text-[10px] font-bold text-blue-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  Scanner Active
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Scan with USB scanner or type code (e.g. 8964000124)"
                  value={form.barcode}
                  onChange={(event) => updateBarcode(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 font-mono"
                  autoComplete="off"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Automatic focus detects handheld POS bar-gun / 2D camera input.</p>
            </label>

            {/* Pricing Block */}
            <div className="rounded-xl border border-blue-50 bg-blue-50/30 overflow-hidden">
              <div className="p-4 grid gap-5 sm:grid-cols-3 items-end">
                <label className="space-y-2">
                  <div className="flex justify-between items-baseline gap-1 min-h-[16px]">
                    <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">Sale Price (Retail) <span className="text-red-500">*</span></span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-slate-400 text-sm font-medium">Rs</span>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      step="0.01"
                      value={form.price}
                      onChange={(event) => setForm((current) => ({ ...current, price: Number(removeLeadingZeros(event.target.value)) }))}
                      onFocus={e => e.target.select()}
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-bold"
                      required
                    />
                  </div>
                </label>
                
                <label className="space-y-2">
                  <div className="flex justify-between items-baseline gap-1 min-h-[16px]">
                    <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">Wholesale Price <span className="text-slate-400 font-medium normal-case lowercase">(optional)</span></span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-slate-400 text-sm font-medium">Rs</span>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      step="0.01"
                      value={form.wholesalePrice || ''}
                      onChange={(event) => setForm((current) => ({ ...current, wholesalePrice: event.target.value ? Number(removeLeadingZeros(event.target.value)) : '' }))}
                      onFocus={e => e.target.select()}
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-bold"
                    />
                  </div>
                </label>

                <label className="space-y-2">
                  <div className="flex justify-between items-baseline gap-1 min-h-[16px]">
                    <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">Purchase Price</span>
                    <span className="text-[10px] font-medium text-slate-400">Auto-costing</span>
                  </div>
                  <div className="relative opacity-60">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-slate-400 text-sm font-medium">Rs</span>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      step="0.01"
                      value={form.costPrice}
                      disabled
                      className="w-full rounded-xl border border-slate-200 bg-transparent pl-10 pr-3 py-3 text-sm text-slate-500 outline-none font-medium cursor-not-allowed"
                    />
                  </div>
                </label>
              </div>
              <div className="bg-blue-100/50 px-4 py-2.5 flex flex-col gap-1 border-t border-blue-100">
                <div className="flex items-center gap-2 text-blue-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span className="text-xs font-bold">Estimated Gross Profit:</span>
                </div>
                {(() => {
                  const saleP = typeof form.price === 'number' ? form.price : parseFloat(form.price || 0);
                  const wholeP = typeof form.wholesalePrice === 'number' ? form.wholesalePrice : parseFloat(form.wholesalePrice || 0);
                  const costP = typeof form.costPrice === 'number' ? form.costPrice : parseFloat(form.costPrice || 0);
                  
                  const retailProfit = saleP - costP;
                  const retailMargin = saleP > 0 ? (retailProfit / saleP) * 100 : 0;
                  
                  const wholeProfit = wholeP - costP;
                  const wholeMargin = wholeP > 0 ? (wholeProfit / wholeP) * 100 : 0;
                  
                  return (
                    <div className="flex flex-col text-xs pl-6 gap-0.5">
                      <span className="font-bold text-blue-700">
                        Retail: +{retailMargin.toFixed(1)}% Margin <span className="font-medium opacity-80">(Rs {retailProfit.toFixed(2)} profit/unit)</span>
                      </span>
                      {wholeP > 0 && (
                        <span className="font-bold text-blue-600/80">
                          Wholesale: +{wholeMargin.toFixed(1)}% Margin <span className="font-medium opacity-80">(Rs {wholeProfit.toFixed(2)} profit/unit)</span>
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Expiry Date */}
            <label className="block space-y-2">
              <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">Expiry Date <span className="text-slate-400 font-medium normal-case lowercase">(optional)</span></span>
              <input
                type="date"
                value={form.expiryDate || ''}
                onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium"
              />
              <p className="text-[11px] text-slate-500 mt-1">Enables automatic expiry warnings in Batch Management (FEFO).</p>
            </label>


          </div>

          <div className="space-y-6">
            
            {/* Image Upload */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">Product Image</span>
                <span className="text-[10px] font-medium text-slate-400">Max 5MB (PNG, JPG)</span>
              </div>
              <ImageUpload value={form.image} onChange={(value) => setForm((current) => ({ ...current, image: value }))} />
            </div>

            {/* Barcode Preview */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">Barcode Preview</span>
                <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Auto-Generated</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col items-center gap-3 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div id="product-qr" className="rounded-lg overflow-hidden flex justify-center w-full px-2">
                    <Barcode 
                      value={form.barcode?.trim() || tempPreviewBarcode}
                      width={1.8}
                      height={60}
                      displayValue={false}
                      margin={0}
                      background="transparent"
                    />
                  </div>
                  <div className="text-center space-y-0.5 mt-2">
                    <p className="text-sm font-bold text-slate-900">{form.name || 'Product Name'}</p>
                    <p className="text-xs font-bold text-blue-600">{currency} {(typeof form.price === 'number' ? form.price : parseFloat(form.price) || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-slate-500 font-mono tracking-wide uppercase">{form.barcode?.trim() || tempPreviewBarcode}</p>
                  </div>
                </div>

                {!form.barcode?.trim() && (
                  <div className="mt-4 rounded-lg bg-amber-50/50 border border-amber-200/60 p-3 flex gap-2">
                    <span className="text-amber-500">⚠️</span>
                    <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                      No barcode entered. A unique barcode and SKU will be auto-generated when you save.
                    </p>
                  </div>
                )}

                {scanFeedback && (
                  <div className={"mt-4 px-4 py-2 rounded-xl text-sm font-medium " + (
                    scanFeedback.type === 'success' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'
                  )}>
                    {scanFeedback.msg}
                  </div>
                )}

                <div className="flex gap-3 mt-4">
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
                      a.download = `${form.name || 'product'}-barcode.svg`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Save SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const price = typeof form.price === 'number' ? form.price.toFixed(2) : parseFloat(form.price || 0).toFixed(2);
                      const barcode = form.barcode?.trim() || tempPreviewBarcode;
                      const shopName = settings?.shopName || 'Shop ERP';
                      
                      const htmlContent = 
                        '<div class="qr-wrapper">' + (document.getElementById('product-qr')?.querySelector('svg')?.outerHTML || '') + '</div>' + '<div class="product-name">' + (form.name || 'Product') + '</div>' +
                        '<div class="product-price">' + currency + ' ' + price + '</div>' +
                        '<div class="product-sku">' + barcode + '</div>' +
                        '<div class="shop-name">' + shopName + '</div>';

                      setQrHtmlContent(htmlContent);
                      setQrPrintQuantity(1);
                      setQrPreviewOpen(true);
                    }}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Label
                  </button>
                </div>
              </div>
            </div>

            {/* Description */}
            <label className="block space-y-2">
              <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">Description & Storage Notes</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                placeholder="Add dosage guidelines, manufacturer details (e.g. GSK Pakistan), storage conditions (store below 25°C), or prescription requirements..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400"
              />
            </label>

          </div>
            
          <div className="col-span-full mt-2 flex items-center justify-between border-t border-slate-100 pt-6">
            <p className="text-xs text-slate-400 font-medium hidden sm:block">
              Press <kbd className="font-sans px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 font-semibold text-[10px]">ESC</kbd> to cancel, <kbd className="font-sans px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 font-semibold text-[10px]">Ctrl+S</kbd> to save
            </p>
            <div className="flex justify-end gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setOpenForm(false)}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => saveProduct(e, true)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                Save & Add Another
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {selectedProduct ? 'Update Product' : 'Save Product'}
              </button>
            </div>
          </div>
        </form>
      </div>
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

      {addingCategoryState && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <h3 className="font-bold text-slate-900">{addingCategoryState.parentId ? "Add Subcategory" : "Add Main Category"}</h3>
              <button type="button" onClick={() => setAddingCategoryState(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
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
                        }
                      setForm(prev => ({ ...prev, category: newId }));
                    }
                    setAddingCategoryState(null);
                    setNewCategoryName('');
                  } else if (e.key === 'Escape') {
                    setAddingCategoryState(null);
                  }
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 outline-none"
                placeholder="e.g. Beverages"
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button type="button" onClick={() => setAddingCategoryState(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
              <button
                type="button"
                onClick={async () => {
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
                        }
                      setForm(prev => ({ ...prev, category: newId }));
                  }
                  setAddingCategoryState(null);
                  setNewCategoryName('');
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
              >
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}));

export default function Products() {
  const modalRef = useRef(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProductForForm, setSelectedProductForForm] = useState(null);
  const { businessColor } = useBusiness();
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';

  const [stats, setStats] = useState({ total: 0, healthy: 0, low: 0, nearExpiry: 0, healthyPercent: '0.0' });

  const [categoriesList, setCategoriesList] = useState([]);
  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategoriesList(d.data || d || []));
  }, []);
  
  const categoryPaths = useMemo(() => {
    const catMap = new Map();
    categoriesList.forEach(c => catMap.set(c.id, c));
    
    const paths = [];
    categoriesList.forEach(c => {
      let path = c.name;
      let curr = c;
      let safeCount = 0;
      while (curr.parentId && safeCount < 20) {
        curr = catMap.get(Number(curr.parentId));
        if (!curr) break;
        path = curr.name + ' → ' + path;
        safeCount++;
      }
      paths.push({ id: c.id, name: c.name, path });
    });
    return paths.sort((a, b) => a.path.localeCompare(b.path));
  }, [categoriesList]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [showPrintLabels, setShowPrintLabels] = useState(false);

  // Column visibility state persisted in localStorage
  const optionalColumns = ['Category', 'Subcategory', 'Sub-Subcategory', 'Barcode', 'Sale Price', 'Wholesale Price', 'Purchase Price', 'Unit', 'Expiry', 'Stock'];
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('products_visible_columns');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return optionalColumns; // all visible by default
  });

  useEffect(() => {
    localStorage.setItem('products_visible_columns', JSON.stringify(visibleCols));
  }, [visibleCols]);

  const toggleColumn = useCallback((col) => {
    setVisibleCols(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  }, []);

  const [limit, setLimit] = useState(25);

  const { data: visibleData, totalItems: totalCount, loading: isLoading, refresh, setPageIndex, pageIndex, totalPages, summary } = useApiPagination({
    endpoint: `/api/products?category=${categoryFilter !== 'All' ? categoryFilter : ''}&stock=${stockFilter}&expiry=${expiryFilter}`,
    pageSize: limit,
    search: debouncedSearch,
    category: categoryFilter,
    mode: 'infinite'
  });

  const openNewProduct = () => {
    setSelectedProductForForm(null);
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (summary) {
      const total = summary.total ?? totalCount;
      const healthy = summary.healthy ?? 0;
      const low = summary.low ?? 0;
      const nearExpiry = summary.nearExpiry ?? 0;
      const healthyPercent = total > 0 ? ((healthy / total) * 100).toFixed(1) : '0.0';
      setStats({ total, healthy, low, nearExpiry, healthyPercent });
    } else if (totalCount !== undefined) {
      setStats(prev => ({ ...prev, total: totalCount }));
    }
  }, [summary, totalCount]);

  const openEditProduct = (product) => {
    setSelectedProductForForm(product);
    setIsFormOpen(true);
  };

  const removeProduct = async () => {
    if (!selectedProduct?.id) return;
    const idToDelete = selectedProduct.id;
    try {
      await api.deleteProduct(idToDelete);
      
    } catch (error) {
      console.error('Error deleting product:', error);
      return;
    }

    // Update state via refresh
    clearPaginationCache('products');
    clearPaginationCache('inventory');
    refresh();
    setConfirmDelete(false);
    setSelectedProduct(null);
    modalRef.current?.close();

    // Force repaint after React DOM updates complete
    forceRepaintAfterRender();
  };

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
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
          <div className="flex items-center gap-6 flex-1">
            <GlobalSearch
              value={search}
              onChange={setSearch}
              placeholder="Search product, barcode, or SKU..."
              className="w-full"
            />
          </div>
          
          <div className="flex items-center gap-2 pr-1">
            {(() => {
              const chain = [];
              let currId = categoryFilter === 'All' ? null : categoryFilter;
              let safeCount = 0;
              while (currId && safeCount < 20) {
                chain.unshift(currId);
                const cat = categoriesList.find(c => c.id === currId || c.id === Number(currId));
                if (!cat) break;
                currId = cat.parentId;
                safeCount++;
              }
              
              const levels = [];
              let currentParentId = null;
              let i = 0;
              
              while (i <= chain.length && i < 3) {
                const targetParentId = currentParentId !== null ? Number(currentParentId) : null;
                const opts = categoriesList.filter(c => {
                  const cParentId = c.parentId ? Number(c.parentId) : null;
                  return cParentId === targetParentId;
                }).map(c => ({ label: c.name, value: c.id }));
                
                if (opts.length === 0) break;
                
                const selectedVal = chain[i] || 'All';
                const levelIndex = i;
                const loopParentId = currentParentId;
                
                levels.push(
                  <GlobalFilter
                    key={`cat-filter-level-${levelIndex}`}
                    icon={LayoutGrid}
                    options={[
                      {label: levelIndex === 0 ? 'All Categories' : 'All Subcats', value: 'All'},
                      ...opts
                    ]}
                    value={selectedVal}
                    onChange={(val) => {
                      if (val === 'All') {
                        setCategoryFilter(levelIndex === 0 ? 'All' : loopParentId);
                      } else {
                        setCategoryFilter(val);
                      }
                    }}
                    variant="select"
                  />
                );
                
                if (selectedVal === 'All') break;
                currentParentId = selectedVal;
                i++;
              }
              return levels;
            })()}
            <GlobalFilter
              icon={Layers}
              options={[{label: 'Stock: All Levels', value: 'all'}, {label: 'Low Stock', value: 'low'}, {label: 'Out of Stock', value: 'out'}]}
              value={stockFilter}
              onChange={setStockFilter}
              variant="select"
            />
            <GlobalFilter
              icon={Calendar}
              options={[{label: 'Expiry: Any date', value: 'all'}, {label: 'Near Expiry', value: 'near'}, {label: 'Expired', value: 'expired'}]}
              value={expiryFilter}
              onChange={setExpiryFilter}
              variant="select"
            />
            <ColumnVisibilityDropdown
              columns={optionalColumns}
              visibleCols={visibleCols}
              toggleColumn={toggleColumn}
            />
          </div>
        </div>
      </div>
    );
  }, [search, categoryFilter, stockFilter, expiryFilter, totalCount, categoryPaths, categoriesList, currency, visibleCols, toggleColumn]);

  const tableColumns = [
    {
      header: (
        <input
          type="checkbox"
          checked={selectAll}
          onChange={toggleSelectAll}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      ),
      className: "w-8 text-center",
    },
    { header: "#", className: "w-8 text-slate-400 text-center" },
    { 
      header: (
        <span className="inline-flex items-center gap-1 font-semibold text-slate-500 text-[11px]">
          PRODUCT <span className="text-slate-300 text-[10px]">⇅</span>
        </span>
      ) 
    },
    ...(visibleCols.includes('Category') ? [{ 
      header: <span className="inline-flex items-center gap-1 font-semibold text-slate-500 text-[11px]">CATEGORY <span className="text-slate-300 text-[10px]">⇅</span></span> 
    }] : []),
    ...(visibleCols.includes('Subcategory') ? [{ 
      header: <span className="inline-flex items-center gap-1 font-semibold text-slate-500 text-[11px]">SUBCATEGORY <span className="text-slate-300 text-[10px]">⇅</span></span> 
    }] : []),
    ...(visibleCols.includes('Sub-Subcategory') ? [{ 
      header: <span className="inline-flex items-center gap-1 font-semibold text-slate-500 text-[11px]">SUB-SUBCATEGORY <span className="text-slate-300 text-[10px]">⇅</span></span> 
    }] : []),
    ...(visibleCols.includes('Barcode') ? [{ 
      header: <span className="inline-flex items-center gap-1 font-semibold text-slate-500 text-[11px]">BARCODE <span className="text-slate-300 text-[10px]">⇅</span></span> 
    }] : []),
    ...(visibleCols.includes('Sale Price') ? [{ 
      header: <span className="inline-flex items-center gap-1 font-semibold text-slate-500 text-[11px]">SALE PRICE <span className="text-slate-300 text-[10px]">⇅</span></span> 
    }] : []),
    ...(visibleCols.includes('Wholesale Price') ? [{ 
      header: <span className="inline-flex items-center gap-1 font-semibold text-slate-500 text-[11px]">WHOLESALE PRICE <span className="text-slate-300 text-[10px]">⇅</span></span> 
    }] : []),
    ...(visibleCols.includes('Purchase Price') ? [{ 
      header: <span className="inline-flex items-center gap-1 font-semibold text-slate-500 text-[11px]">PURCHASE PRICE <span className="text-slate-300 text-[10px]">⇅</span></span> 
    }] : []),
    ...(visibleCols.includes('Unit') ? [{ 
      header: <span className="inline-flex items-center gap-1 font-semibold text-slate-500 text-[11px]">UNIT <span className="text-slate-300 text-[10px]">⇅</span></span> 
    }] : []),
    ...(visibleCols.includes('Expiry') ? [{ 
      header: <span className="inline-flex items-center gap-1 font-semibold text-slate-500 text-[11px]">EXPIRY <span className="text-slate-300 text-[10px]">⇅</span></span> 
    }] : []),
    ...(visibleCols.includes('Stock') ? [{ 
      header: <span className="inline-flex items-center gap-1 font-semibold text-slate-500 text-[11px]">STOCK <span className="text-slate-300 text-[10px]">⇅</span></span> 
    }] : []),
    { header: "ACTIONS", className: "text-right" },
  ];
  const renderProductRow = (product, virtualIndex, measureRef) => {
    const rowBg = virtualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';
    const isSelected = selectedIds.includes(product.id);
    const rowNumber = virtualIndex + 1;
    const stockQty = product.stockQuantity ?? product.quantity ?? 0;
    const lowStockThreshold = product.lowStockThreshold || 10;

    return (
    <tr
      key={product.id}
      ref={measureRef}
      data-index={virtualIndex}
      className={`border-b border-slate-100 transition-colors ${isSelected ? 'bg-blue-50/60 hover:bg-blue-50/80' : `hover:bg-slate-50/80 ${rowBg}`}`}
    >
      <td className="px-4 py-3.5 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelect(product.id)}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      </td>
      <td className="px-3 py-3.5 text-xs text-slate-400 font-medium text-center">
        {rowNumber}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <img src={product.image} alt={product.name} className="h-9 w-9 rounded-lg object-cover border border-slate-100 shrink-0" />
          <p className="font-semibold text-slate-900 text-sm">{product.name}</p>
        </div>
      </td>
      {(() => {
        let chain = [];
        let currId = product.category;
        let safeCount = 0;
        while (currId && safeCount < 20) {
          const cat = categoriesList.find(c => c.id === currId || c.id === Number(currId));
          if (!cat) break;
          chain.unshift(cat.name);
          currId = cat.parentId ? Number(cat.parentId) : null;
          safeCount++;
        }
        
        if (chain.length === 0 && product.category) {
          chain = [product.category]; // Fallback if no matching category object
        }

        return (
          <>
            {visibleCols.includes('Category') && (
              <td className="px-4 py-3.5 text-slate-700 text-sm">
                {chain.length > 0 ? chain[0] : '-'}
              </td>
            )}
            
            {visibleCols.includes('Subcategory') && (
              <td className="px-4 py-3.5 text-slate-500 text-sm">
                {chain.length > 1 ? chain[1] : '-'}
              </td>
            )}
            
            {visibleCols.includes('Sub-Subcategory') && (
              <td className="px-4 py-3.5 text-slate-400 text-sm">
                {chain.length > 2 ? chain[2] : '-'}
              </td>
            )}
          </>
        );
      })()}
      {visibleCols.includes('Barcode') && (
        <td className="px-4 py-3.5 text-slate-600 font-mono text-xs">{product.barcode || '-'}</td>
      )}
      {visibleCols.includes('Sale Price') && (
        <td className="px-4 py-3.5 font-bold text-slate-900 text-sm">{formatCurrency(product.price, currency)}</td>
      )}
      {visibleCols.includes('Wholesale Price') && (
        <td className="px-4 py-3.5 text-slate-600 text-sm">{product.wholesalePrice ? formatCurrency(product.wholesalePrice, currency) : '-'}</td>
      )}
      {visibleCols.includes('Purchase Price') && (
        <td className="px-4 py-3.5 text-slate-600 text-sm">{formatCurrency(product.costPrice, currency)}</td>
      )}
      {visibleCols.includes('Unit') && (
        <td className="px-4 py-3.5 text-slate-600 text-xs">{product.unit || 'pcs'}</td>
      )}
      {visibleCols.includes('Expiry') && (
        <td className="px-4 py-3.5 text-slate-600 text-xs">
          {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : '-'}
        </td>
      )}
      {visibleCols.includes('Stock') && (
        <td className="px-4 py-3.5">
          <span className={`inline-flex items-center justify-center min-w-[32px] px-2.5 py-0.5 rounded-full text-xs font-bold ${
            stockQty <= 0
              ? 'bg-red-50 text-red-600'
              : stockQty <= lowStockThreshold
              ? 'bg-amber-50 text-amber-600'
              : 'bg-emerald-50 text-emerald-600'
          }`}>
            {stockQty}
          </span>
        </td>
      )}
      <td className="px-4 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => openEditProduct(product)}
            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
            title="Edit product"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedProduct(product);
              setConfirmDelete(true);
            }}
            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition-colors"
            title="Delete product"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
  };

  const memoizedTable = useMemo(() => {
    return (
      <div className="mt-3">
        <GlobalTable 
          data={visibleData} 
          columns={tableColumns} 
          renderRow={renderProductRow}
          loading={isLoading}
          onLoadMore={() => setPageIndex(p => p + 1)}
          hasMore={visibleData.length < totalCount}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm font-semibold text-slate-700">No products found</p>
              <p className="text-xs text-slate-400 mt-1">Try modifying your search or filter criteria</p>
            </div>
          }
        />
      </div>
    );
  }, [visibleData, selectedIds, selectAll, debouncedSearch, currency, totalCount, limit, isLoading, visibleCols]);



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
      
      await api.deleteProductsBulk(selectedRows);
      clearPaginationCache('products');
      clearPaginationCache('inventory');
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
      <div key={product.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center break-inside-avoid relative group">
        <div className="mb-3 grid place-items-center bg-white p-4 rounded-2xl w-full overflow-hidden">
          <Barcode 
            value={product.barcode || 'NO-SKU'} 
            width={1.5}
            height={40}
            displayValue={false}
            margin={0}
            background="transparent"
          />
        </div>
        <p className="font-semibold text-slate-900">{product.name}</p>
        <p className="text-sm text-slate-600">{formatCurrency(product.price, currency)}</p>
        <p className="text-xs text-slate-500 mt-2">{product.barcode}</p>
        
        <div className="mt-4 pt-4 border-t border-slate-200 print:hidden">
          <button 
            type="button"
            onClick={() => {
               const win = window.open('', '', 'width=600,height=600');
               win.document.write('<html><head><title>Print Label</title>');
               win.document.write('<style>body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; } .print-card { text-align: center; border: 1px solid #ccc; padding: 20px; border-radius: 16px; width: 100%; max-width: 300px; display: flex; flex-direction: column; align-items: center; } svg { max-width: 100%; height: auto; }</style>');
               win.document.write('</head><body>');
               win.document.write(`<div class="print-card">${document.getElementById(`qr-svg-${product.id}`).outerHTML}<h2>${product.name}</h2><p>${formatCurrency(product.price, currency)}</p><p>${product.barcode}</p></div>`);
               win.document.write('</body></html>');
               win.document.close();
               win.focus();
               setTimeout(() => { win.print(); win.close(); }, 250);
            }}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-white border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print Single
          </button>
        </div>
        <div id={`qr-card-${product.id}`} className="hidden">
           <div id={`qr-svg-${product.id}`} className="flex justify-center w-full">
             <Barcode 
               value={product.barcode || 'NO-SKU'} 
               width={2}
               height={60}
               displayValue={false}
               margin={0}
             />
           </div>
        </div>
      </div>
    ));
  }, [visibleData, selectedIds, currency, showPrintLabels]);

  if (isFormOpen) {
    return (
      <ProductFormView
        currency={currency}
        categories={categoriesList}
        initialProduct={selectedProductForForm}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedProductForForm(null);
        }}
        onSuccess={async (mode, productData) => {
          setIsFormOpen(false);
          setSelectedProductForForm(null);
          clearPaginationCache('products');
          clearPaginationCache('inventory');
          refresh(true);
          forceRepaintAfterRender();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        icon={Box}
        title="Products Management"
        description="Manage your products, categories, stock and pricing all in one place."
        action={
          <div className="flex items-center gap-2.5">
            <GlobalButton
              variant="outline"
              icon={() => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>}
              onClick={() => setShowPrintLabels(true)}
            >
              Print Label Codes
            </GlobalButton>
            <button
              type="button"
              onClick={openNewProduct}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Add Product
            </button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard 
          title="Total Products" 
          value={stats.total.toLocaleString()} 
          description="Active inventory items" 
          color="blue" 
          icon={Package} 
          arrow="forward" 
        />
        <StatsCard 
          title="Healthy Stock" 
          value={stats.healthy.toLocaleString()} 
          description="At or above reorder level" 
          color="emerald" 
          icon={CheckCircle} 
          arrow="forward" 
        />
        <StatsCard 
          title="Low or Critical Stock" 
          value={stats.low.toLocaleString()} 
          description="Action required soon" 
          color="amber" 
          icon={AlertTriangle} 
          arrow="forward" 
        />
        <StatsCard 
          title="Near Expiry (1-80d)" 
          value={stats.nearExpiry.toLocaleString()} 
          description="Check for expiry" 
          color="purple" 
          icon={Tag} 
          arrow="forward" 
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        {tableContent}
        {memoizedTable}
      </div>

      {showPrintLabels && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 p-6 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Print Label Codes</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedIds.length > 0 ? `Printing ${selectedIds.length} selected products` : `Printing up to 300 visible products`}
                </p>
              </div>
              <button onClick={() => setShowPrintLabels(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
              <PrintWrapper title="Print Labels" printLabel="Labels" showButton={true}>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {productQRCodes}
                </div>
              </PrintWrapper>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 p-6 shrink-0 bg-white">
              <GlobalButton variant="secondary" onClick={() => setShowPrintLabels(false)}>Close</GlobalButton>
            </div>
          </div>
        </div>
      )}

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



