import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { useBusiness } from '@/contexts/BusinessContext'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency as formatCurrencyUtil } from '@/lib/utils'
import { getDB } from '@/lib/db'

let globalMonthlyRecordsCache = null;

export default function MonthlyRecords() {
  const { db } = useBusiness()
  const settings = useSettings()
  const [expandedMonth, setExpandedMonth] = useState(null)
  const printRef = useRef(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Monthly_Records',
  })

  const dbVersion = useLiveQuery(async () => {
    if (!db) return undefined;
    return (await db.sales.count()) + (await db.purchases.count()) + (await db.expenses.count());
  }, [db]);

  const [metrics, setMetrics] = useState(globalMonthlyRecordsCache);
  const [loadingError, setLoadingError] = useState(null);

  useEffect(() => {
    if (dbVersion === undefined) return;

    const worker = new Worker(new URL('../workers/metricsWorker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      if (e.data.type === 'MONTHLY_RECORDS_METRICS_RESULT') {
        globalMonthlyRecordsCache = e.data.payload;
        setMetrics(e.data.payload);
      } else if (e.data.type === 'ERROR') {
        setLoadingError(e.data.payload);
      }
    };

    worker.postMessage({ type: 'MONTHLY_RECORDS_METRICS' });

    return () => {
      worker.terminate();
    };
  }, [dbVersion]);

  if (loadingError) {
    return <div style={{ padding: 32, color: 'red', textAlign: 'center' }}>Error loading monthly records: {loadingError}</div>;
  }
  if (!metrics) {
    return <div style={{ padding: 32, textAlign: 'center' }}>Crunching monthly records...</div>;
  }

  const {
    monthSummaries = [],
    grandTotalSales = 0,
    grandTotalPurchases = 0,
    grandTotalExpenses = 0,
    grandNetProfit = 0
  } = metrics;

  const formatCurrency = (amount) => formatCurrencyUtil(amount, settings?.currency ?? 'Rs')

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-PK', {
      day: 'numeric', month: 'short', year: 'numeric'
    })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monthly Records</h1>
          <p className="text-gray-500 text-sm">Complete history grouped by month</p>
        </div>
        <button
          onClick={handlePrint}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          🖨 Print All Records
        </button>
      </div>

      {/* Grand Total Cards */}
      <div className="w-full">
        <div className="grid grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-600 font-medium uppercase">All Time Sales</p>
          <p className="text-2xl font-bold text-green-700">
            {formatCurrency(metrics?.grandTotalSales ?? 0)}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-medium uppercase">All Time Purchases</p>
          <p className="text-2xl font-bold text-blue-700">
            {formatCurrency(metrics?.grandTotalPurchases ?? 0)}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-600 font-medium uppercase">All Time Expenses</p>
          <p className="text-2xl font-bold text-red-700">
            {formatCurrency(metrics?.grandTotalExpenses ?? 0)}
          </p>
        </div>
        <div className={`border rounded-xl p-4 ${
          (metrics?.grandNetProfit ?? 0) >= 0
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-orange-50 border-orange-200'
        }`}>
          <p className="text-xs font-medium text-gray-500 uppercase">Total Net Profit</p>
          <p className={`text-2xl font-bold ${
            (metrics?.grandNetProfit ?? 0) >= 0 ? 'text-emerald-700' : 'text-orange-700'
          }`}>
            {formatCurrency(metrics?.grandNetProfit ?? 0)}
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 flex items-center gap-2">
        <span>ℹ</span>
        <span>Net Profit = Sales Revenue − Cost of Goods Sold (based on product cost prices) − Expenses. This matches the Dashboard and Reports views.</span>
      </div>

      {/* Month by Month Records */}
      <div className="space-y-4">
        {metrics?.monthSummaries && metrics.monthSummaries.map(month => (
          <div key={month.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">

            {/* Month Header — click to expand */}
            <button
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedMonth(
                expandedMonth === month.key ? null : month.key
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <span className="text-xl">📅</span>
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800">{month.monthName}</p>
                  <p className="text-xs text-gray-400">
                    {month.sales.length} sales · {month.purchases.length} purchases · {month.expenses.length} expenses
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-right">
                <div>
                  <p className="text-xs text-gray-400">Sales</p>
                  <p className="font-semibold text-green-600">{formatCurrency(month.totalSales)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Purchases</p>
                  <p className="font-semibold text-blue-600">{formatCurrency(month.totalPurchases)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Expenses</p>
                  <p className="font-semibold text-red-500">{formatCurrency(month.totalExpenses)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Net Profit</p>
                  <p className={`font-bold text-lg ${month.netProfit >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {formatCurrency(month.netProfit)}
                  </p>
                </div>
                <span className="text-gray-400 text-lg">
                  {expandedMonth === month.key ? '▲' : '▼'}
                </span>
              </div>
            </button>

            {/* Expanded Details */}
            {expandedMonth === month.key && (
              <div className="border-t border-slate-200">

                {/* Sales */}
                {month.sales.length > 0 && (
                  <div className="p-4">
                    <h3 className="font-semibold text-sm text-gray-600 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Sales ({month.sales.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="text-left p-2 text-gray-700">Date</th>
                            <th className="text-left p-2 text-gray-700">Items</th>
                            <th className="text-left p-2 text-gray-700">Customer</th>
                            <th className="text-left p-2 text-gray-700">Payment</th>
                            <th className="text-right p-2 text-gray-700">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {month.sales.map((sale) => (
                            <tr key={sale.id} className="border-b border-gray-100">
                              <td className="p-2 text-gray-800">{formatDate(sale.date)}</td>
                              <td className="p-2 text-gray-800">{sale.items?.length ?? 0} items</td>
                              <td className="p-2 text-gray-800">{sale.customerName ?? 'Walk-in'}</td>
                              <td className="p-2 text-gray-800">{sale.paymentMethod}</td>
                              <td className="p-2 text-right font-medium text-green-600">
                                {formatCurrency(sale.totalAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="font-bold bg-green-50">
                          <tr>
                            <td colSpan={4} className="p-2 text-gray-700">Month Total</td>
                            <td className="p-2 text-right text-green-700">
                              {formatCurrency(month.totalSales)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Purchases */}
                {month.purchases.length > 0 && (
                  <div className="p-4 border-t border-slate-200">
                    <h3 className="font-semibold text-sm text-gray-600 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Purchases ({month.purchases.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-blue-50">
                          <tr>
                            <th className="text-left p-2 text-gray-700">Date</th>
                            <th className="text-left p-2 text-gray-700">Product</th>
                            <th className="text-left p-2 text-gray-700">Supplier</th>
                            <th className="text-left p-2 text-gray-700">Qty</th>
                            <th className="text-right p-2 text-gray-700">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {month.purchases.map((purchase) => (
                            <tr key={purchase.id} className="border-b border-gray-100">
                              <td className="p-2 text-gray-800">{formatDate(purchase.date)}</td>
                              <td className="p-2 text-gray-800">{purchase.productName}</td>
                              <td className="p-2 text-gray-800">{purchase.supplier ?? 'N/A'}</td>
                              <td className="p-2 text-gray-800">{purchase.quantity}</td>
                              <td className="p-2 text-right font-medium text-blue-600">
                                {formatCurrency(purchase.totalCost)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="font-bold bg-blue-50">
                          <tr>
                            <td colSpan={4} className="p-2 text-gray-700">Month Total</td>
                            <td className="p-2 text-right text-blue-700">
                              {formatCurrency(month.totalPurchases)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Expenses */}
                {month.expenses.length > 0 && (
                  <div className="p-4 border-t border-slate-200">
                    <h3 className="font-semibold text-sm text-gray-600 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Expenses ({month.expenses.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-red-50">
                          <tr>
                            <th className="text-left p-2">Date</th>
                            <th className="text-left p-2">Title</th>
                            <th className="text-left p-2">Category</th>
                            <th className="text-right p-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {month.expenses.map((expense) => (
                            <tr key={expense.id} className="border-b border-gray-100">
                              <td className="p-2">{formatDate(expense.date)}</td>
                              <td className="p-2">{expense.title}</td>
                              <td className="p-2">{expense.category}</td>
                              <td className="p-2 text-right font-medium text-red-600">
                                {formatCurrency(expense.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="font-bold bg-red-50">
                          <tr>
                            <td colSpan={3} className="p-2">Month Total</td>
                            <td className="p-2 text-right text-red-700">
                              {formatCurrency(month.totalExpenses)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Month Net Summary */}
                <div className="p-4 border-t bg-gray-50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-700">
                      {month.monthName} — Net Profit
                    </span>
                    <span className={`text-xl font-bold ${
                      month.netProfit >= 0 ? 'text-emerald-600' : 'text-orange-600'
                    }`}>
                      {formatCurrency(month.netProfit)}
                    </span>
                  </div>
                </div>

              </div>
            )}
          </div>
        ))}

        {(!metrics?.monthSummaries || metrics.monthSummaries.length === 0) && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-gray-500">No records found yet.</p>
            <p className="text-gray-400 text-sm">Start adding sales, purchases and expenses.</p>
          </div>
        )}
      </div>
      </div>

      {/* Hidden Monthly Report for Printing — Always Expanded */}
      <div ref={printRef} className="print-source">
        <style dangerouslySetInnerHTML={{ __html:
          "@media print { " +
          "@page { size: A4 portrait; margin: 20mm; } " +
          "body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; } " +
          ".print-only { display: block !important; } " +
          ".screen-only { display: none !important; } " +
          "table { width: 100%; border-collapse: collapse; margin-bottom: 20px; } " +
          "th, td { border: 1px solid #ccc; padding: 6px; text-align: left; } " +
          "th { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } " +
          "tr:nth-child(even) { background-color: #fafafa !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } " +
          ".text-right { text-align: right; } " +
          ".report-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; } " +
          ".report-header h1 { font-size: 24px; margin-bottom: 5px; } " +
          ".month-section { margin-top: 30px; page-break-inside: avoid; border-top: 1px solid #000; padding-top: 10px; } " +
          ".month-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; display: flex; justify-content: space-between; } " +
          ".summary-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; } " +
          ".summary-box { border: 1px solid #ddd; padding: 10px; text-align: center; } " +
          ".summary-label { font-size: 10px; text-transform: uppercase; color: #666; } " +
          ".summary-val { font-size: 14px; font-weight: bold; } " +
          ".profit-green { color: #059669; } " +
          ".profit-red { color: #dc2626; } " +
          "}"
        }} />
        <div style={{ padding: '20px' }}>
          <div className="report-header">
            <h1>{settings?.shopName || 'Pharmacy ERP'}</h1>
            {settings?.address && <p>{settings.address}</p>}
            {settings?.phone && <p>Ph: {settings.phone}</p>}
            <h2 style={{ marginTop: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>Monthly Business Records</h2>
            <p>Printed: {new Date().toLocaleString()}</p>
          </div>

          <div className="summary-grid">
            <div className="summary-box">
              <div className="summary-label">Total Sales</div>
              <div className="summary-val">{formatCurrency(metrics?.grandTotalSales ?? 0)}</div>
            </div>
            <div className="summary-box">
              <div className="summary-label">Total Purchases</div>
              <div className="summary-val">{formatCurrency(metrics?.grandTotalPurchases ?? 0)}</div>
            </div>
            <div className="summary-box">
              <div className="summary-label">Total Expenses</div>
              <div className="summary-val">{formatCurrency(metrics?.grandTotalExpenses ?? 0)}</div>
            </div>
            <div className="summary-box">
              <div className="summary-label">Net Profit</div>
              <div className={`summary-val ${(metrics?.grandNetProfit ?? 0) >= 0 ? 'profit-green' : 'profit-red'}`}>
                {formatCurrency(metrics?.grandNetProfit ?? 0)}
              </div>
            </div>
          </div>

          {metrics?.monthSummaries && metrics.monthSummaries.map(month => (
            <div key={month.key} className="month-section">
              <div className="month-title">
                <span>{month.monthName}</span>
                <span className={month.netProfit >= 0 ? 'profit-green' : 'profit-red'}>
                  Net: {formatCurrency(month.netProfit)}
                </span>
              </div>

              {/* Month Summary Small */}
              <div style={{ display: 'flex', gap: '20px', marginBottom: '10px', fontSize: '11px', color: '#444' }}>
                <span>Sales: {formatCurrency(month.totalSales)}</span>
                <span>Purchases: {formatCurrency(month.totalPurchases)}</span>
                <span>Expenses: {formatCurrency(month.totalExpenses)}</span>
              </div>

              {/* Sales Table */}
              {month.sales.length > 0 && (
                <div>
                  <p style={{ fontWeight: 'bold', fontSize: '12px', margin: '10px 0 5px' }}>Sales Transactions</p>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Customer</th>
                        <th>Payment</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {month.sales.map((sale) => (
                        <tr key={sale.id}>
                          <td>{formatDate(sale.date)}</td>
                          <td>{sale.items?.length ?? 0}</td>
                          <td>{sale.customerName ?? 'Walk-in'}</td>
                          <td>{sale.paymentMethod}</td>
                          <td className="text-right">{formatCurrency(sale.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Purchases Table */}
              {month.purchases.length > 0 && (
                <div>
                  <p style={{ fontWeight: 'bold', fontSize: '12px', margin: '10px 0 5px' }}>Purchases Transactions</p>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Product</th>
                        <th>Supplier</th>
                        <th>Qty</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {month.purchases.map((p) => (
                        <tr key={p.id}>
                          <td>{formatDate(p.date)}</td>
                          <td>{p.productName}</td>
                          <td>{p.supplier || 'N/A'}</td>
                          <td>{p.quantity}</td>
                          <td className="text-right">{formatCurrency(p.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Expenses Table */}
              {month.expenses.length > 0 && (
                <div>
                  <p style={{ fontWeight: 'bold', fontSize: '12px', margin: '10px 0 5px' }}>Expenses Transactions</p>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Title</th>
                        <th>Category</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {month.expenses.map((e) => (
                        <tr key={e.id}>
                          <td>{formatDate(e.date)}</td>
                          <td>{e.title}</td>
                          <td>{e.category}</td>
                          <td className="text-right">{formatCurrency(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
