import { useState, useEffect } from 'react';
import { RefreshCw, Download, Upload, Trash2, Printer } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useSettings } from '@/hooks/useSettings';
import { useBusiness } from '@/contexts/BusinessContext';
import { initDB, getDB, resetDatabase } from '@/lib/db';
import { forceRepaintAfterRender } from '@/lib/utils';

export default function Settings() {
  const settings = useSettings();
  const { businessColor } = useBusiness();
  const [form, setForm] = useState({
    shopName: settings?.shopName || '',
    currency: settings?.currency || '',
    address: settings?.address || '',
    phone: settings?.phone || '',
    receiptPrinter: settings?.receiptPrinter || '',
    labelPrinter: settings?.labelPrinter || '',
    reportsPrinter: settings?.reportsPrinter || '',
    logo: settings?.logo || '',
  });
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [saved, setSaved] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmImportMismatch, setConfirmImportMismatch] = useState(null);
  const [exportError, setExportError] = useState(null);

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setForm({
        shopName: settings.shopName || '',
        currency: settings.currency || '',
        address: settings.address || '',
        phone: settings.phone || '',
        receiptPrinter: settings.receiptPrinter || '',
        labelPrinter: settings.labelPrinter || '',
        reportsPrinter: settings.reportsPrinter || '',
        logo: settings.logo || '',
      });
    }
  }, [settings]);

  // Fetch available OS printers
  useEffect(() => {
    const fetchPrinters = async () => {
      if (window.electronAPI && window.electronAPI.getPrinters) {
        try {
          const printers = await window.electronAPI.getPrinters();
          setAvailablePrinters(printers);
        } catch (err) {
          console.error('Failed to fetch printers:', err);
        }
      }
    };
    fetchPrinters();
  }, []);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm((current) => ({ ...current, logo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const currentDB = getDB();
    
    await currentDB.settings.put({ key: 'shopName', value: form.shopName });
    await currentDB.settings.put({ key: 'currency', value: form.currency });
    await currentDB.settings.put({ key: 'address', value: form.address });
    await currentDB.settings.put({ key: 'phone', value: form.phone });
    await currentDB.settings.put({ key: 'receiptPrinter', value: form.receiptPrinter });
    await currentDB.settings.put({ key: 'labelPrinter', value: form.labelPrinter });
    await currentDB.settings.put({ key: 'reportsPrinter', value: form.reportsPrinter });
    await currentDB.settings.put({ key: 'logo', value: form.logo });
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = async () => {
    setConfirmClear(false);
    try {
      await resetDatabase();
      await initDB();
      forceRepaintAfterRender();
    } catch (error) {
      console.error('Failed to reset database:', error);
      setResetError('Failed to reset database. Please try again.');
      setTimeout(() => setResetError(null), 3000);
    }
  };

  useEffect(() => {
    const preventDefault = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);

    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  const handleExportData = async () => {
    setExporting(true);
    try {
      const currentDB = getDB();
      const exportData = {
        business: 'pharmacy',
        exportDate: new Date().toISOString(),
        data: {
          products: await currentDB.products.toArray(),
          inventory: await currentDB.inventory.toArray(),
          purchases: await currentDB.purchases.toArray(),
          sales: await currentDB.sales.toArray(),
          suppliers: await currentDB.suppliers.toArray(),
          expenses: await currentDB.expenses.toArray(),
          salesReturns: await currentDB.salesReturns.toArray(),
          settings: await currentDB.settings.toArray(),
          customers: await currentDB.customers.toArray(),
          customerLedger: await currentDB.customerLedger.toArray(),
          priceHistory: await currentDB.priceHistory.toArray(),
        }
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      const shopNameSlug = (settings?.shopName || 'webzen Business').replace(/\s+/g, '-');
      link.download = `${shopNameSlug}-backup-${new Date().toISOString().substring(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError('Failed to export data. Please try again.');
      setTimeout(() => setExportError(null), 3000);
    } finally {
      setExporting(false);
    }
  };

  const handleImportData = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportMessage(null);
    try {
      const fileContent = await file.text();
      const importData = JSON.parse(fileContent);
      
      // Check if business matches, but allow import if business field is missing (backward compatibility)
      if (importData.business && importData.business !== 'pharmacy') {
        // Store the import data and show confirm dialog instead of window.confirm
        setConfirmImportMismatch(importData);
        setImporting(false);
        return;
      }

      await performImport(importData);
    } catch (error) {
      console.error('Import failed:', error);
      setImportMessage({ type: 'error', text: `Import failed: ${error.message}` });
      setTimeout(() => setImportMessage(null), 5000);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const performImport = async (importData) => {
    try {
      const currentDB = getDB();
      
      // Clear existing data
      await Promise.all([
        currentDB.products.clear(),
        currentDB.inventory.clear(),
        currentDB.purchases.clear(),
        currentDB.sales.clear(),
        currentDB.suppliers.clear(),
        currentDB.expenses.clear(),
        currentDB.salesReturns.clear(),
        currentDB.customers.clear(),
        currentDB.customerLedger.clear(),
        currentDB.priceHistory.clear(),
      ]);

      // Import new data
      await Promise.all([
        currentDB.products.bulkPut(importData.data.products || []),
        currentDB.inventory.bulkPut(importData.data.inventory || []),
        currentDB.purchases.bulkPut(importData.data.purchases || []),
        currentDB.sales.bulkPut(importData.data.sales || []),
        currentDB.suppliers.bulkPut(importData.data.suppliers || []),
        currentDB.expenses.bulkPut(importData.data.expenses || []),
        currentDB.salesReturns.bulkPut(importData.data.salesReturns || []),
        currentDB.customers.bulkPut(importData.data.customers || []),
        currentDB.customerLedger.bulkPut(importData.data.customerLedger || []),
        currentDB.priceHistory.bulkPut(importData.data.priceHistory || []),
      ]);

      // Import settings
      if (importData.data.settings && Array.isArray(importData.data.settings)) {
        for (const setting of importData.data.settings) {
          await currentDB.settings.put(setting);
        }
      }

      setImportMessage({ type: 'success', text: 'Data imported successfully! Refresh the page to see changes.' });
      setTimeout(() => setImportMessage(null), 5000);
      forceRepaintAfterRender();
    } catch (error) {
      console.error('Import failed:', error);
      setImportMessage({ type: 'error', text: `Import failed: ${error.message}` });
      setTimeout(() => setImportMessage(null), 5000);
    } finally {
      setImporting(false);
    }
  };



  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure your shop preferences" />
      
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-4">Shop Information</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Shop Name</span>
                <input
                  value={form.shopName}
                  onChange={(e) => setForm((current) => ({ ...current, shopName: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                  placeholder="Enter shop name"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Currency Symbol</span>
                <input
                  value={form.currency}
                  onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                  placeholder="e.g. Rs, $, PKR"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Phone Number</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                  placeholder="Enter phone number"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Address</span>
                <input
                  value={form.address}
                  onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                  placeholder="Enter shop address"
                />
              </label>
            </div>
            
            <div className="mt-6 flex items-start gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Shop Logo</span>
                <div className="flex items-center gap-4">
                  {form.logo ? (
                    <img src={form.logo} alt="Shop Logo" className="h-16 w-16 rounded-2xl object-cover border border-slate-200" />
                  ) : (
                    <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 text-2xl">
                      🏪
                    </div>
                  )}
                  <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors">
                    <Upload className="h-4 w-4" />
                    Upload Logo
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {form.logo && (
                    <button type="button" onClick={() => setForm(c => ({...c, logo: ''}))} className="text-sm text-red-600 hover:text-red-700">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <Printer className="h-5 w-5 text-slate-700" />
              <h3 className="text-base font-bold text-slate-900">Hardware & Printing</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Receipt Printer (Thermal)</span>
                <select
                  value={form.receiptPrinter}
                  onChange={(e) => setForm((current) => ({ ...current, receiptPrinter: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                >
                  <option value="">-- Select Printer --</option>
                  {availablePrinters.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name} {printer.status !== 0 ? '(' + printer.status + ')' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">For 80mm POS receipts.</p>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">QR Label Printer</span>
                <select
                  value={form.labelPrinter}
                  onChange={(e) => setForm((current) => ({ ...current, labelPrinter: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                >
                  <option value="">-- Select Printer --</option>
                  {availablePrinters.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name} {printer.status !== 0 ? '(' + printer.status + ')' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">For product QR code stickers.</p>
              </label>
              
              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700 block">Default System Printer</span>
                <select
                  value={form.reportsPrinter}
                  onChange={(e) => setForm((current) => ({ ...current, reportsPrinter: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                >
                  <option value="">-- Generic Fallback Printer --</option>
                  {availablePrinters.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name} {printer.status !== 0 ? '(' + printer.status + ')' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">For full page A4 reports.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Save Settings
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Settings saved successfully!
              </span>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4">Data Management</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Export Button */}
          <button
            onClick={handleExportData}
            disabled={exporting}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-slate-200 bg-slate-50 px-6 py-4 text-sm font-semibold text-slate-700 hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className={`h-5 w-5 ${exporting ? 'animate-spin' : ''}`} />
            {exporting ? 'Exporting...' : 'Export All Data'}
          </button>

          {/* Import Button */}
          <label className="flex flex-col items-center gap-3 rounded-xl border-2 border-slate-200 bg-slate-50 px-6 py-4 text-sm font-semibold text-slate-700 hover:border-green-500 hover:bg-green-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <Upload className={`h-5 w-5 ${importing ? 'animate-spin' : ''}`} />
            {importing ? 'Importing...' : 'Import JSON Backup'}
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              disabled={importing}
              className="hidden"
            />
          </label>

          {/* Clear Button */}
          <button
            onClick={() => setConfirmClear(true)}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-red-200 bg-red-50 px-6 py-4 text-sm font-semibold text-red-700 hover:border-red-500 hover:bg-red-100 transition-all"
          >
            <Trash2 className="h-5 w-5" />
            Clear All Data
          </button>
        </div>

        {importMessage && (
          <div className={`mt-4 p-4 rounded-lg flex items-center gap-2 ${
            importMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {importMessage.type === 'success' ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              )}
            </svg>
            {importMessage.text}
          </div>
        )}
      </div>

      {/* <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4">Current Configuration</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2.5 px-3 rounded-lg bg-slate-50">
            <span className="text-sm text-slate-500">Shop Name</span>
            <span className="text-sm font-semibold text-slate-900">{settings?.shopName || 'Not set'}</span>
          </div>
          <div className="flex justify-between py-2.5 px-3 rounded-lg bg-slate-50">
            <span className="text-sm text-slate-500">Currency</span>
            <span className="text-sm font-semibold text-slate-900">{settings?.currency || 'Not set'}</span>
          </div>
          <div className="flex justify-between py-2.5 px-3 rounded-lg bg-slate-50">
            <span className="text-sm text-slate-500">Address</span>
            <span className="text-sm font-semibold text-slate-900">{settings?.address || 'Not set'}</span>
          </div>
          <div className="flex justify-between py-2.5 px-3 rounded-lg bg-slate-50">
            <span className="text-sm text-slate-500">Phone</span>
            <span className="text-sm font-semibold text-slate-900">{settings?.phone || 'Not set'}</span>
          </div>
        </div>
      </div> */}

      <ConfirmDialog
        open={confirmClear}
        title="Clear all data?"
        description="This will permanently delete ALL data for the shop (products, sales, inventory, customers, etc.). The database will be completely empty. This action cannot be undone."
        confirmText="Yes, Clear All Data"
        cancelText="Cancel"
        requireAuthPhrase="CLEAR ALL DATA"
        onCancel={() => setConfirmClear(false)}
        onConfirm={handleReset}
        isDestructive={true}
      />

      <ConfirmDialog
        open={!!confirmImportMismatch}
        title="Business mismatch"
        description={confirmImportMismatch ? `Backup is for "${confirmImportMismatch.business}" business, but you are importing to pharmacy. Continue anyway?` : ''}
        confirmText="Import Anyway"
        cancelText="Cancel"
        onCancel={() => setConfirmImportMismatch(null)}
        onConfirm={() => {
          const data = confirmImportMismatch;
          setConfirmImportMismatch(null);
          setImporting(true);
          performImport(data);
        }}
      />

      {resetError && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-red-50 border border-red-200 p-4 shadow-lg">
          <p className="text-sm text-red-800">{resetError}</p>
        </div>
      )}

      {exportError && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-red-50 border border-red-200 p-4 shadow-lg">
          <p className="text-sm text-red-800">{exportError}</p>
        </div>
      )}

      {/* License & App Information */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-6 shadow-sm mt-8">
        <div className="flex items-center gap-2 mb-4">
          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-base font-bold text-slate-900">License & App Information</h3>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Developed By</p>
              <p className="text-sm font-medium text-slate-900 mt-1">Hammad Software Solutions</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contact Number</p>
              <p className="text-sm font-medium text-blue-600 mt-1">
                <a href="mailto:muhammadowais9219@gmail.com" className="hover:underline">
                  03145660928
                </a>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contact Email</p>
              <p className="text-sm font-medium text-blue-600 mt-1">
                <a href="mailto:muhammadhammadulla02@gmail.com" className="hover:underline">
                  muhammadhammadulla02@gmail.com
                </a>
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Version</p>
              <p className="text-sm font-medium text-slate-900 mt-1">1.0.0</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">App Name</p>
              <p className="text-sm font-medium text-slate-900 mt-1">Shop ERP - Offline Business Management</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Copyright</p>
              <p className="text-sm font-medium text-slate-700 mt-1">© 2026 Hammad Software Solutions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
