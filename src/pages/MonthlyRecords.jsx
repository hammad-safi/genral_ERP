import { useState, useEffect, useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useReactToPrint } from 'react-to-print'
import { Printer, BookOpen, X } from 'lucide-react'
import { useBusiness } from '@/contexts/BusinessContext'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency as formatCurrencyUtil } from '@/lib/utils'
import { getDB } from '@/lib/db'
import GlobalTable from '@/components/GlobalTable'
import GlobalButton from '@/components/GlobalButton'
import RowsDropdown from '@/components/RowsDropdown'
import GlobalSearch from '@/components/GlobalSearch'

let globalMonthlyRecordsCache = null;

export default function MonthlyRecords() {
  const { db } = useBusiness()
  const settings = useSettings()
  const [selectedMonthDetails, setSelectedMonthDetails] = useState(null)
  const [limit, setLimit] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
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

  // Reset page to 1 on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, limit]);

  const paginationData = useMemo(() => {
    const allSummaries = metrics?.monthSummaries || [];
    const filteredSummaries = searchTerm.trim() 
      ? allSummaries.filter(m => m.monthName.toLowerCase().includes(searchTerm.toLowerCase()))
      : allSummaries;

    const totalCount = filteredSummaries.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    
    const getPageNumbers = () => {
      const pages = [];
      if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        if (currentPage <= 3) {
          pages.push(1, 2, 3, 4, '...', totalPages);
        } else if (currentPage >= totalPages - 2) {
          pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
        } else {
          pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
        }
      }
      return pages;
    };

    const startItem = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const endItem = Math.min(currentPage * limit, totalCount);
    
    // Slice data for local pagination
    const visibleData = filteredSummaries.slice(startItem === 0 ? 0 : startItem - 1, endItem);

    return { totalCount, totalPages, getPageNumbers, startItem, endItem, visibleData };
  }, [metrics, currentPage, limit, searchTerm]);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Monthly Records</h1>
        <div className="flex items-center gap-3 shrink-0 mt-2 md:mt-0">
          <GlobalButton
            icon={Printer}
            onClick={handlePrint}
            variant="outline"
          >
            Print All Records
          </GlobalButton>
        </div>
      </div>

      {/* Grand Total Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">All Time Sales</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(metrics?.grandTotalSales ?? 0)}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Total value of all sales</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">All Time Purchases</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(metrics?.grandTotalPurchases ?? 0)}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Total value of all purchases</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">All Time Expenses</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(metrics?.grandTotalExpenses ?? 0)}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Total value of all expenses</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Net Profit</p>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(metrics?.grandNetProfit ?? 0)}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Overall net profit</p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1">
            <GlobalSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by month..."
              className="w-full max-w-md"
            />
          </div>
        </div>
        <div>
          <GlobalTable
            data={paginationData.visibleData}
            columns={[
              { header: "Month", className: "w-40" },
              { header: "Sales" },
              { header: "Purchases" },
              { header: "Expenses" },
              { header: "Net Profit" },
              { header: "Actions", className: "w-24 text-center" },
            ]}
            renderRow={(month, virtualIndex) => {
              const rowBg = virtualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
              return (
                <tr key={month.key} className={`border-b border-slate-200 hover:bg-slate-100 ${rowBg}`}>
                  <td className="py-3 px-4 text-sm font-bold text-slate-800">{month.monthName}</td>
                  <td className="py-3 px-4 text-sm">
                    <div className="font-semibold text-green-600">{formatCurrency(month.totalSales)}</div>
                    <div className="text-xs text-slate-400">{month.sales.length} transactions</div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <div className="font-semibold text-blue-600">{formatCurrency(month.totalPurchases)}</div>
                    <div className="text-xs text-slate-400">{month.purchases.length} transactions</div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <div className="font-semibold text-red-500">{formatCurrency(month.totalExpenses)}</div>
                    <div className="text-xs text-slate-400">{month.expenses.length} transactions</div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <div className={`font-bold ${month.netProfit >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                      {formatCurrency(month.netProfit)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedMonthDetails(month)}
                      className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 hover:bg-blue-100 transition-colors inline-flex items-center justify-center"
                      title="View Details"
                    >
                      <BookOpen className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            }}
            emptyState={
              <div className="p-8 text-center text-slate-500">
                No monthly records available
              </div>
            }
          />
          
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div>
                Showing <span className="font-bold text-slate-700">{paginationData.startItem}</span> to <span className="font-bold text-slate-700">{paginationData.endItem}</span> of <span className="font-bold text-slate-700">{paginationData.totalCount}</span> items
              </div>
              <div className="h-3 w-px bg-slate-200"></div>
              <div className="flex items-center gap-2">
                <span>Rows:</span>
                <RowsDropdown limit={limit} setLimit={setLimit} />
              </div>
            </div>

            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm text-sm font-medium text-slate-600">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`flex h-7 w-7 items-center justify-center rounded ${currentPage === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              
              {paginationData.getPageNumbers().map((pageNum, idx) => (
                <button
                  key={idx}
                  disabled={pageNum === '...'}
                  onClick={() => typeof pageNum === 'number' && setCurrentPage(pageNum)}
                  className={`flex h-7 w-7 items-center justify-center rounded ${
                    pageNum === '...' 
                      ? 'text-slate-400 cursor-default' 
                      : pageNum === currentPage 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button 
                onClick={() => setCurrentPage(prev => Math.min(paginationData.totalPages, prev + 1))}
                disabled={currentPage === paginationData.totalPages}
                className={`flex h-7 w-7 items-center justify-center rounded ${currentPage === paginationData.totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </section>
      {selectedMonthDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedMonthDetails.monthName} Details</h2>
                <p className="text-sm text-slate-500">Summary of all transactions</p>
              </div>
              <button
                onClick={() => setSelectedMonthDetails(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
              
              {/* Sales Table */}
              {selectedMonthDetails.sales.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
                    Sales ({selectedMonthDetails.sales.length})
                  </h3>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Items</th>
                          <th className="px-4 py-3">Customer</th>
                          <th className="px-4 py-3">Payment</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {selectedMonthDetails.sales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-800">{formatDate(sale.date)}</td>
                            <td className="px-4 py-3 text-slate-800">{sale.items?.length ?? 0} items</td>
                            <td className="px-4 py-3 text-slate-800">{sale.customerName ?? 'Walk-in'}</td>
                            <td className="px-4 py-3 text-slate-800">{sale.paymentMethod}</td>
                            <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(sale.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-slate-700">Total Sales</td>
                          <td className="px-4 py-3 text-right text-green-700">{formatCurrency(selectedMonthDetails.totalSales)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Purchases Table */}
              {selectedMonthDetails.purchases.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                    Purchases ({selectedMonthDetails.purchases.length})
                  </h3>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">Supplier</th>
                          <th className="px-4 py-3">Qty</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {selectedMonthDetails.purchases.map((purchase) => (
                          <tr key={purchase.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-800">{formatDate(purchase.date)}</td>
                            <td className="px-4 py-3 text-slate-800">{purchase.productName}</td>
                            <td className="px-4 py-3 text-slate-800">{purchase.supplier ?? 'N/A'}</td>
                            <td className="px-4 py-3 text-slate-800">{purchase.quantity}</td>
                            <td className="px-4 py-3 text-right font-medium text-blue-600">{formatCurrency(purchase.totalCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-slate-700">Total Purchases</td>
                          <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(selectedMonthDetails.totalPurchases)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Expenses Table */}
              {selectedMonthDetails.expenses.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                    Expenses ({selectedMonthDetails.expenses.length})
                  </h3>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Title</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {selectedMonthDetails.expenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-800">{formatDate(expense.date)}</td>
                            <td className="px-4 py-3 text-slate-800">{expense.title}</td>
                            <td className="px-4 py-3 text-slate-800">{expense.category}</td>
                            <td className="px-4 py-3 text-right font-medium text-red-600">{formatCurrency(expense.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-slate-700">Total Expenses</td>
                          <td className="px-4 py-3 text-right text-red-700">{formatCurrency(selectedMonthDetails.totalExpenses)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

            </div>
            
            {/* Modal Footer / Net Summary */}
            <div className="border-t border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-slate-700">Net Profit</span>
                <span className={`text-2xl font-bold ${selectedMonthDetails.netProfit >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                  {formatCurrency(selectedMonthDetails.netProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
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
            <h1>{settings?.shopName || 'Shop ERP'}</h1>
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
