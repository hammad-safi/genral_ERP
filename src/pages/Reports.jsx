import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Printer } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PrintWrapper from '@/components/PrintWrapper';
import { getDB } from '@/lib/db';
import { downloadJson, formatCurrency } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { useBusiness } from '@/contexts/BusinessContext';

const getLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

let globalReportsCache = new Map();

export default function Reports() {
  const { businessColor } = useBusiness();
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';

  const dbVersion = useLiveQuery(
    async () => {
      const currentDB = getDB();
      return (await currentDB.sales.count()) + (await currentDB.expenses.count()) + (await currentDB.purchases.count()) + (await currentDB.inventory.count());
    },
    []
  );

  const [range, setRange] = useState({ from: getLocalDateString(thirtyDaysAgo), to: getLocalDateString(today) });
  const cacheKey = JSON.stringify(range);
  const [metrics, setMetrics] = useState(() => globalReportsCache.get(cacheKey) || null);
  const [loadingError, setLoadingError] = useState(null);

  useEffect(() => {
    setMetrics(globalReportsCache.get(cacheKey) || null);
  }, [cacheKey]);

  useEffect(() => {
    if (dbVersion === undefined) return;

    const worker = new Worker(new URL('../workers/metricsWorker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      if (e.data.type === 'REPORT_METRICS_RESULT') {
        globalReportsCache.set(cacheKey, e.data.payload);
        setMetrics(e.data.payload);
      } else if (e.data.type === 'ERROR') {
        setLoadingError(e.data.payload);
      }
    };

    worker.postMessage({ type: 'REPORT_METRICS', payload: { range } });

    return () => {
      worker.terminate();
    };
  }, [dbVersion, range]);

  if (loadingError) {
    return <div style={{ padding: 32, color: 'red', textAlign: 'center' }}>Error loading reports: {loadingError}</div>;
  }
  if (!metrics) {
    return <div style={{ padding: 32, textAlign: 'center' }}>Crunching report metrics...</div>;
  }

  const {
    totalSalesAmount: totalSales = 0,
    totalPurchasesAmount: totalPurchases = 0,
    totalExpensesAmount: totalExpenses = 0,
    netProfitAmount: netProfit = 0,
    totalInventoryValue: inventoryValue = 0,
    bestSelling = [],
    totalItemsSold = 0,
    filteredSales = [],
    filteredPurchases = [],
    filteredExpenses = []
  } = metrics;

  const activeFilteredSales = filteredSales.filter(s => s.returned !== true);

  const handleExport = () => {
    downloadJson({ sales: filteredSales, purchases: filteredPurchases, expenses: filteredExpenses }, `reports-${range.from}-to-${range.to}.json`);
  };

  const handlePrint = async () => {
    if (window.electronAPI && window.electronAPI.printCurrentPage) {
      await window.electronAPI.printCurrentPage(settings?.reportsPrinter || '');
    } else {
      window.print();
    }
  };

  const cashSales = activeFilteredSales.filter(s => s.paymentMethod === 'Cash' || s.paymentMethod?.toLowerCase() === 'cash' || !s.paymentMethod).reduce((sum, s) => sum + s.totalAmount, 0);
  const cardSales = totalSales - cashSales;
  const avgItemsPerBill = activeFilteredSales.length > 0 ? (totalItemsSold / activeFilteredSales.length).toFixed(2) : 0;
  const margin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <PrintWrapper title="Business Report" printLabel="Business Report">
        <style dangerouslySetInnerHTML={{ __html: 
          "@media print { " +
          "@page { size: A4 portrait; margin: 20mm; } " +
          "body { font-family: Arial, sans-serif; font-size: 13px; color: #000; background: #fff; } " +
          "h1, h2, h3 { font-size: 18px; color: #000; margin-bottom: 10px; margin-top: 20px; } " +
          "table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #ccc; } " +
          "th, td { border: 1px solid #ccc; padding: 8px; text-align: left; } " +
          "th { background-color: #f2f2f2 !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; } " +
          "tr:nth-child(even) { background-color: #f9f9f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } " +
          ".page-break { page-break-before: always; } " +
          ".screen-only { display: none !important; } " +
          ".print-only { display: block !important; } " +
          ".report-header { text-align: center; margin-bottom: 30px; } " +
          ".report-header p { margin: 2px 0; color: #333; } " +
          ".text-right { text-align: right; } " +
          "} " +
          "@media screen { " +
          ".print-only { display: none !important; } " +
          ".screen-only { display: block; } " +
          "}"
        }} />

        {/* Screen View */}
        <main className="flex-1 p-0 lg:p-0 space-y-6 w-full screen-only">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-blue-600 mb-1">
                <span>FINANCE &amp; ANALYTICS</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-500">AUDIT REPORTS</span>
              </nav>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Sales, purchase, profit and inventory reports</h1>
              <p className="text-xs lg:text-sm text-slate-500 mt-0.5">Comprehensive transactional overview, gross margin analytics, and inventory valuation for fiscal audit.</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-emerald-800 text-xs font-medium self-start md:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Register Active • Online Sync OK
            </div>
          </header>

          <section className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-44">
                  <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="date-from">From</label>
                  <div className="relative rounded-lg shadow-sm">
                    <input className="block w-full rounded-lg border-slate-300 pl-3 pr-9 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-blue-500 bg-slate-50/50" id="date-from" type="date" value={range.from} onChange={(e) => setRange((c) => ({ ...c, from: e.target.value }))} />
                  </div>
                </div>
                <div className="w-44">
                  <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="date-to">To</label>
                  <div className="relative rounded-lg shadow-sm">
                    <input className="block w-full rounded-lg border-slate-300 pl-3 pr-9 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-blue-500 bg-slate-50/50" id="date-to" type="date" value={range.to} onChange={(e) => setRange((c) => ({ ...c, to: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold shadow-xs transition-all" type="button" onClick={handleExport}>
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  Export Data (.JSON)
                </button>
                <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all" onClick={handlePrint} type="button">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                  </svg>
                  Print Report
                </button>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Total sales</span>
                  <div className="mt-2 text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{formatCurrency(totalSales, currency)}</div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">{activeFilteredSales.length} verified orders</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Total purchases</span>
                  <div className="mt-2 text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{formatCurrency(totalPurchases, currency)}</div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Inbound wholesale invoices</span>
                <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">{filteredPurchases.length} Consignments</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Net profit</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">Gross Margin {margin}%</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Revenue − COGS − Expenses</p>
                  <div className="mt-2 text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{formatCurrency(netProfit, currency)}</div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Sales Report</h2>
                <p className="text-xs text-slate-500">Aggregated counter checkout activity and movement velocity</p>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">Realtime POS sync</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50/70 rounded-lg p-4 border border-slate-100">
                <span className="text-xs font-medium text-slate-500">Total sales</span>
                <div className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalSales, currency)}</div>
                <div className="text-[11px] text-slate-400 mt-1">Cash: {formatCurrency(cashSales, currency)} • Card: {formatCurrency(cardSales, currency)}</div>
              </div>
              <div className="bg-slate-50/70 rounded-lg p-4 border border-slate-100">
                <span className="text-xs font-medium text-slate-500">Items sold</span>
                <div className="text-xl font-bold text-slate-900 mt-1">{totalItemsSold}</div>
                <div className="text-[11px] text-slate-400 mt-1">Avg. transaction: {avgItemsPerBill} items/bill</div>
              </div>
              <div className="bg-slate-50/70 rounded-lg p-4 border border-slate-100">
                <span className="text-xs font-medium text-slate-500">Best selling</span>
                <div className="text-xl font-bold text-blue-700 capitalize mt-1 truncate">{bestSelling[0]?.name || 'N/A'}</div>
                <div className="text-[11px] text-slate-400 mt-1">({bestSelling[0]?.qty || 0} units)</div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Inventory Valuation</h2>
                <p className="text-xs text-slate-500">Overall stock capital based on average cost</p>
              </div>
            </div>
            <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current inventory value</span>
                  <div className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight mt-1">
                    {formatCurrency(inventoryValue, currency)}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Best Selling Products</h2>
                <p className="text-xs text-slate-500">Fast-moving medicine and consumable lines in the selected timeframe</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {bestSelling.slice(0, 4).map(item => (
                <div key={item.name} className="bg-slate-50/70 hover:bg-slate-50 rounded-lg p-4 border border-slate-200/80 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 capitalize truncate w-32">{item.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{item.qty} sold</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Revenue: <strong className="text-slate-800 font-semibold">{formatCurrency(item.revenue || 0, currency)}</strong></span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-2 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Item / SKU Description</th>
                    <th className="py-2.5 px-3 text-center">Qty Sold</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {bestSelling.map(item => (
                    <tr key={item.name}>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{item.name}</td>
                      <td className="py-2.5 px-3 text-center font-bold">{item.qty}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{formatCurrency(item.revenue || 0, currency)}</td>
                    </tr>
                  ))}
                  {bestSelling.length === 0 && (
                    <tr><td colSpan="3" className="py-4 text-center">No sales in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="border-t border-slate-200 pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
              <span>Generated for: <strong>{settings?.shopName || 'Store'}</strong></span>
            </div>
            <div>
              <span>Report Timestamp: {new Date().toLocaleString()}</span>
            </div>
          </footer>
        </main>

        {/* Print View */}
        <div className="print-only">
          <div className="report-header">
            {settings?.logo && (
              <img src={settings.logo} alt="Shop Logo" style={{ maxHeight: '60px', marginBottom: '10px' }} />
            )}
            <h2 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>{settings?.shopName || 'Shop ERP'}</h2>
            <p><strong>Report Period:</strong> {range.from} to {range.to}</p>
            <p><strong>Printed on:</strong> {new Date().toLocaleString()}</p>
          </div>

          <div>
            <h3>Sales Summary</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th className="text-right">Items Sold</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {activeFilteredSales.map(sale => (
                  <tr key={sale.id}>
                    <td>{new Date(sale.date).toLocaleDateString()}</td>
                    <td>{sale.customerName || 'Walk-in'}</td>
                    <td className="text-right">{sale.items?.reduce((sum, item) => sum + item.qty, 0) || 0}</td>
                    <td className="text-right">{formatCurrency(sale.totalAmount, currency)}</td>
                  </tr>
                ))}
                {activeFilteredSales.length === 0 && (
                  <tr><td colSpan="4" className="text-center">No sales in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="page-break">
            <h3>Purchases Summary</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th className="text-right">Items</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map(purchase => (
                  <tr key={purchase.id}>
                    <td>{new Date(purchase.date).toLocaleDateString()}</td>
                    <td>{purchase.supplier || 'N/A'}</td>
                    <td className="text-right">{purchase.quantity || 0}</td>
                    <td className="text-right">{formatCurrency(purchase.totalCost, currency)}</td>
                  </tr>
                ))}
                {filteredPurchases.length === 0 && (
                  <tr><td colSpan="4" className="text-center">No purchases in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="page-break">
            <h3>Expenses Summary</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(expense => (
                  <tr key={expense.id}>
                    <td>{new Date(expense.date).toLocaleDateString()}</td>
                    <td>{expense.category}</td>
                    <td>{expense.title}</td>
                    <td className="text-right">{formatCurrency(expense.amount, currency)}</td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr><td colSpan="4" className="text-center">No expenses in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="page-break">
            <h3>Grand Totals</h3>
            <table>
              <tbody>
                <tr>
                  <td><strong>Total Sales Revenue</strong></td>
                  <td className="text-right"><strong>{formatCurrency(totalSales, currency)}</strong></td>
                </tr>
                <tr>
                  <td><strong>Total Purchases Cost</strong></td>
                  <td className="text-right"><strong>{formatCurrency(totalPurchases, currency)}</strong></td>
                </tr>
                <tr>
                  <td><strong>Total Expenses</strong></td>
                  <td className="text-right"><strong>{formatCurrency(totalExpenses, currency)}</strong></td>
                </tr>
                <tr>
                  <td><strong>Net Profit</strong></td>
                  <td className="text-right"><strong>{formatCurrency(netProfit, currency)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </PrintWrapper>
    </div>
  );
}
