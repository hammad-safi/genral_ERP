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

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Sales, purchase, profit and inventory reports" />
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-2 text-sm text-slate-700">
            <span>From</span>
            <input
              type="date"
              value={range.from}
              onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span>To</span>
            <input
              type="date"
              value={range.to}
              onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="mt-6 flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-sm text-slate-500">Total sales</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(totalSales, currency)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-sm text-slate-500">Total purchases</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(totalPurchases, currency)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-sm text-slate-500">Net profit</p>
          <p className="text-xs text-slate-400 mt-1">Revenue − COGS − Expenses</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(netProfit, currency)}</p>
        </div>
      </div>

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
        <div className="space-y-6 screen-only">
          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Sales Report</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-white p-4 shadow-sm">
                <p className="text-sm text-slate-500">Total sales</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(totalSales, currency)}</p>
              </div>
              <div className="rounded-3xl bg-white p-4 shadow-sm">
                <p className="text-sm text-slate-500">Items sold</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{totalItemsSold}</p>
              </div>
              <div className="rounded-3xl bg-white p-4 shadow-sm">
                <p className="text-sm text-slate-500">Best selling</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{bestSelling[0]?.name || 'N/A'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Inventory Valuation</h3>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Current inventory value</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{formatCurrency(inventoryValue, currency)}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Best Selling Products</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bestSelling.length === 0 ? (
                <div className="rounded-3xl bg-white p-4 text-sm text-slate-500">No items sold in this range</div>
              ) : (
                bestSelling.map((item) => (
                  <div key={item.name} className="rounded-3xl bg-white p-4 shadow-sm">
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-2 text-sm text-slate-600">{item.qty} sold</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Print View */}
        <div className="print-only">
          <div className="report-header">
            {settings?.logo && (
              <img src={settings.logo} alt="Shop Logo" style={{ maxHeight: '60px', marginBottom: '10px' }} />
            )}
            <h2 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>{settings?.shopName || 'Pharmacy Store'}</h2>
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
