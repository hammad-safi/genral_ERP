const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.jsx', 'utf8');

const startIndex = content.indexOf('  return (');
if (startIndex !== -1) {
  content = content.substring(0, startIndex);
  
  const newReturn = \  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="mb-8">
        <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">Configure your shop preferences</h1>
        <p className="text-xs text-slate-500 mt-1">Manage core establishment credentials, fiscal currency, thermal printer routes, and database lifecycle.</p>
      </div>
      
      <form onSubmit={handleSave} className="space-y-6">
        {/* Shop Information Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-[#eff6ff] flex items-center justify-center text-blue-600 border border-blue-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-slate-900">Shop Information</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Primary Business attributes displayed across customer invoices and reports.</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wide mt-1">Step 1 of 4</span>
            </div>
            
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700">Shop Name</span>
                <input
                  value={form.shopName}
                  onChange={(e) => setForm((current) => ({ ...current, shopName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700">Currency Symbol</span>
                <input
                  value={form.currency}
                  onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700">Phone Number</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700">Address</span>
                <input
                  value={form.address}
                  onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>
            
            <div className="mt-6 flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-700">Shop Logo</span>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 shrink-0 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 overflow-hidden text-blue-600 font-black text-lg">
                  {form.logo ? (
                    <img src={form.logo} alt="Shop Logo" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[15px]">{form.shopName ? form.shopName.substring(0, 2).toUpperCase() : 'WZ'}</span>
                  )}
                </div>
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                  <Upload className="h-3 w-3" />
                  Upload Logo
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {form.logo && (
                  <button type="button" onClick={() => setForm(c => ({...c, logo: ''}))} className="text-[11px] font-bold text-red-500 hover:text-red-600">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hardware & Printing Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
                  <Printer className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-slate-900">Hardware & Printing</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Configure peripherals, barcode thermal ribbon outputs, and slip printers.</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f0fdf4] px-2.5 py-1 border border-[#dcfce7]">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-[9px] font-bold text-emerald-700 tracking-wider">Driver Hub Connected</span>
              </div>
            </div>
            
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700">Receipt Printer (Thermal)</span>
                <select
                  value={form.receiptPrinter}
                  onChange={(e) => setForm((current) => ({ ...current, receiptPrinter: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Select Printer --</option>
                  {availablePrinters.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name}
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400">For 80mm POS receipts.</p>
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700">QR Label Printer</span>
                <select
                  value={form.labelPrinter}
                  onChange={(e) => setForm((current) => ({ ...current, labelPrinter: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Select Printer --</option>
                  {availablePrinters.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name}
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400">For product QR code stickers.</p>
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 block">Default System Printer</span>
                <select
                  value={form.reportsPrinter}
                  onChange={(e) => setForm((current) => ({ ...current, reportsPrinter: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Generic Fallback Printer --</option>
                  {availablePrinters.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name}
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400">For full page A4 reports.</p>
              </label>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100">
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">Hardware spooler daemon running normally</span>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="rounded-md bg-slate-100 px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition-colors">
                  Test Print Sample
                </button>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-[#2563eb] px-5 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 transition-colors relative">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Save Settings
                  {saved && (
                    <span className="absolute -left-14 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      Saved!
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Data Management Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-6">
        <div className="p-6">
          <div className="flex items-start justify-between mb-8">
            <div className="flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-slate-900">Data Management</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Export local records, upload JSON backups, or perform maintenance purge.</p>
              </div>
            </div>
            <span className="text-[10px] font-medium text-slate-400 mt-1">Offline SQLite & IndexedDB Storage</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-100 bg-[#f8fafc] p-6 text-center hover:border-blue-200 transition-all disabled:opacity-50"
            >
              <div className="h-10 w-10 rounded-full bg-blue-100/50 flex items-center justify-center text-[#60a5fa]">
                <Download className={\h-4 w-4 \\} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{exporting ? 'Exporting...' : 'Export All Data'}</p>
                <p className="text-[9px] text-slate-400 mt-1">Download complete shop catalog (json)</p>
              </div>
            </button>

            <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-100 bg-[#f8fafc] p-6 text-center hover:border-blue-200 transition-all cursor-pointer disabled:opacity-50">
              <div className="h-10 w-10 rounded-full bg-blue-100/50 flex items-center justify-center text-[#60a5fa]">
                <Upload className={\h-4 w-4 \\} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{importing ? 'Importing...' : 'Import JSON Backup'}</p>
                <p className="text-[9px] text-slate-400 mt-1">Restore ledger and stock archives</p>
              </div>
              <input type="file" accept=".json" onChange={handleImportData} disabled={importing} className="hidden" />
            </label>

            <button
              onClick={() => setConfirmClear(true)}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#fecaca] bg-[#fff1f2] p-6 text-center hover:bg-[#ffe4e6] transition-all"
            >
              <div className="h-10 w-10 rounded-full bg-[#fecaca] flex items-center justify-center text-[#f87171]">
                <Trash2 className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#e11d48]">Clear All Data</p>
                <p className="text-[9px] text-[#fb7185] mt-1">Irreversible reset of local SQLite records</p>
              </div>
            </button>
          </div>

          {importMessage && (
            <div className={\mt-4 p-3 rounded-lg flex items-center gap-2 text-xs font-bold \\}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
      </div>

      {/* License & App Information Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-6">
        <div className="p-6">
          <div className="flex items-start justify-between mb-8">
            <div className="flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 border border-blue-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-slate-900">License & App Information</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Software release validation and dedicated vendor technical support.</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f0fdf4] px-2.5 py-1 border border-[#dcfce7]">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
              <span className="text-[9px] font-bold text-emerald-700 tracking-wide">Active Commercial License</span>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 text-sm mt-4">
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Developed By</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">Hammad Software Solutions</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Contact Number</p>
                <p className="text-xs font-bold text-blue-600 mt-0.5 hover:underline cursor-pointer">03145660928</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Contact Email</p>
                <p className="text-xs font-bold text-blue-600 mt-0.5 hover:underline cursor-pointer">muhammadhammadulla02@gmail.com</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Version</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs font-bold text-slate-800">1.0.0</p>
                  <span className="inline-flex items-center rounded-md bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 border border-slate-200">Production Release</span>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">App Name</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">Shop ERP - Offline Business Management</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Copyright</p>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">© 2026 Hammad Software Solutions. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all data?"
        description="This will permanently delete ALL data for the shop. This action cannot be undone."
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
        description={confirmImportMismatch ? \Backup is for "\" business. Continue anyway?\ : ''}
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
    </div>
  );
}
\

  fs.writeFileSync('src/pages/Settings.jsx', content + newReturn);
}
