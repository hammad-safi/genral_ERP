import { useState, useEffect } from 'react'
import { Banknote, TrendingUp, ShoppingBag, Wallet, BookOpen, X, Eye, Calendar } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency as formatCurrencyUtil } from '@/lib/utils'

import PageHeader from '@/components/PageHeader'
import StatsCard from '@/components/StatsCard'
import GlobalTable from '@/components/GlobalTable'
import GlobalButton from '@/components/GlobalButton'
import { useApiPagination } from '@/hooks/useApiPagination'

let globalMonthlyRecordsCache = null;

const MonthDetailsModal = ({ month, onClose, settings }) => {
  const [activeTab, setActiveTab] = useState('sales');

  const { data: salesData, loading: salesLoading, setPageIndex: setSalesPage, totalItems: totalSales } = useApiPagination({
    endpoint: '/api/sales?month=' + month.key,
    pageSize: 20
  });

  const { data: purchasesData, loading: purchasesLoading, setPageIndex: setPurchasesPage, totalItems: totalPurchases } = useApiPagination({
    endpoint: '/api/purchases?month=' + month.key,
    pageSize: 20
  });

  const { data: expensesData, loading: expensesLoading, setPageIndex: setExpensesPage, totalItems: totalExpenses } = useApiPagination({
    endpoint: '/api/expenses?month=' + month.key,
    pageSize: 20
  });

  const currency = settings?.currency ?? 'Rs';
  const formatCurrency = (amount) => formatCurrencyUtil(amount, currency);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{month.monthName} Transactions</h2>
            <p className="text-sm text-slate-500 mt-1">Net Profit: <span className={month.netProfit >= 0 ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>{formatCurrency(month.netProfit)}</span></p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sales' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Sales
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'purchases' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Purchases
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'expenses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Expenses
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {activeTab === 'sales' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <GlobalTable
                data={salesData}
                onLoadMore={() => setSalesPage(p => p + 1)}
                hasMore={salesData.length < totalSales}
                columns={[
                  { header: "Date" },
                  { header: "Customer" },
                  { header: "Payment" },
                  { header: "Amount", className: "text-right" }
                ]}
                renderRow={(sale, virtualIndex) => {
                  const rowBg = virtualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                  return (
                    <tr key={sale.id || virtualIndex} className="even:bg-slate-50/30 hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3.5 sm:py-4 text-sm text-slate-600">{new Date(sale.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 sm:py-4 text-sm font-medium text-slate-900">{sale.customerName || 'Walk-in'}</td>
                      <td className="px-4 py-3.5 sm:py-4 text-sm text-slate-600">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                          sale.paymentMethod?.toLowerCase() === 'credit' 
                            ? 'bg-amber-50 text-amber-700' 
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {sale.paymentMethod || 'Cash'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 sm:py-4 text-sm text-right font-medium text-slate-900">{formatCurrency(sale.totalAmount)}</td>
                    </tr>
                  );
                }}
                emptyState={<div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <Banknote className="w-12 h-12 text-slate-300 mb-4" />
                  <p>No sales this month.</p>
                </div>}
              />
            </div>
          )}

          {activeTab === 'purchases' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <GlobalTable
                data={purchasesData}
                onLoadMore={() => setPurchasesPage(p => p + 1)}
                hasMore={purchasesData.length < totalPurchases}
                columns={[
                  { header: "Date" },
                  { header: "Supplier" },
                  { header: "Payment" },
                  { header: "Amount", className: "text-right" }
                ]}
                renderRow={(purchase, virtualIndex) => {
                  const rowBg = virtualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                  return (
                    <tr key={purchase.id || virtualIndex} className="even:bg-slate-50/30 hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3.5 sm:py-4 text-sm text-slate-600">{new Date(purchase.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 sm:py-4 text-sm font-medium text-slate-900">{purchase.supplierName || 'N/A'}</td>
                      <td className="px-4 py-3.5 sm:py-4 text-sm text-slate-600">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                          purchase.paymentMethod?.toLowerCase() === 'credit' 
                            ? 'bg-amber-50 text-amber-700' 
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          {purchase.paymentMethod || 'Cash'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 sm:py-4 text-sm text-right font-medium text-slate-900">{formatCurrency(purchase.totalAmount)}</td>
                    </tr>
                  );
                }}
                emptyState={<div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <ShoppingBag className="w-12 h-12 text-slate-300 mb-4" />
                  <p>No purchases this month.</p>
                </div>}
              />
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <GlobalTable
                data={expensesData}
                onLoadMore={() => setExpensesPage(p => p + 1)}
                hasMore={expensesData.length < totalExpenses}
                columns={[
                  { header: "Date" },
                  { header: "Category" },
                  { header: "Description" },
                  { header: "Amount", className: "text-right" }
                ]}
                renderRow={(expense, virtualIndex) => {
                  const rowBg = virtualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                  return (
                    <tr key={expense.id || virtualIndex} className="even:bg-slate-50/30 hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3.5 sm:py-4 text-sm text-slate-600">{new Date(expense.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 sm:py-4 text-sm font-medium text-slate-900">{expense.category}</td>
                      <td className="px-4 py-3.5 sm:py-4 text-sm text-slate-500 max-w-xs truncate" title={expense.description}>{expense.description || '-'}</td>
                      <td className="px-4 py-3.5 sm:py-4 text-sm text-right font-medium text-slate-900">{formatCurrency(expense.amount)}</td>
                    </tr>
                  );
                }}
                emptyState={<div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <Wallet className="w-12 h-12 text-slate-300 mb-4" />
                  <p>No expenses this month.</p>
                </div>}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function MonthlyRecords() {
  const settings = useSettings();
  const [selectedMonthDetails, setSelectedMonthDetails] = useState(null);
  const [metrics, setMetrics] = useState(globalMonthlyRecordsCache);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/metricsWorker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      if (e.data.type === 'MONTHLY_RECORDS_METRICS_RESULT') {
        globalMonthlyRecordsCache = e.data.payload;
        setMetrics(e.data.payload);
      }
    };

    worker.postMessage({ type: 'MONTHLY_RECORDS_METRICS' });

    return () => {
      worker.terminate();
    };
  }, []);

  const {
    monthSummaries = [],
    grandTotalSales = 0,
    grandTotalPurchases = 0,
    grandTotalExpenses = 0,
    grandNetProfit = 0
  } = metrics || {};

  const currency = settings?.currency ?? 'Rs';
  const formatCurrency = (amount) => formatCurrencyUtil(amount, currency);

  return (
    <div className="space-y-6">
      {/* Standardized Header */}
      <PageHeader 
        icon={Calendar}
        title="Monthly Records" 
        description="View and analyze your historical monthly performance"
      />

      {/* Standardized Top Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard 
          title="Total Sales (All Time)" 
          value={formatCurrency(grandTotalSales)} 
          description="Total revenue generated" 
          color="blue" 
          icon={TrendingUp} 
          arrow="forward"
        />
        <StatsCard 
          title="Total Purchases (All Time)" 
          value={formatCurrency(grandTotalPurchases)} 
          description="Total spent on inventory" 
          color="amber" 
          icon={ShoppingBag} 
          arrow="forward"
        />
        <StatsCard 
          title="Total Expenses (All Time)" 
          value={formatCurrency(grandTotalExpenses)} 
          description="Total overhead costs" 
          color="red" 
          icon={Wallet} 
          arrow="forward"
        />
        <StatsCard 
          title="Net Profit (All Time)" 
          value={formatCurrency(grandNetProfit)} 
          description="Revenue minus cost & expenses" 
          color="emerald" 
          icon={Banknote} 
          arrow="forward"
        />
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <GlobalTable 
          columns={[
            { header: "Month" },
            { header: "Total Sales", className: "text-right" },
            { header: "Total Purchases", className: "text-right" },
            { header: "Total Expenses", className: "text-right" },
            { header: "Net Profit", className: "text-right" },
            { header: "Actions", className: "text-center w-[120px]" }
          ]}
          data={monthSummaries}
          hasMore={false}
          renderRow={(month, virtualIndex) => {
            const rowBg = virtualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
            return (
              <tr key={month.key || virtualIndex} className="even:bg-slate-50/30 hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
                <td className="px-4 py-3.5 sm:py-4 text-sm font-semibold text-slate-900">{month.monthName}</td>
                <td className="px-4 py-3.5 sm:py-4 text-sm text-right text-emerald-600 font-medium">{formatCurrency(month.totalSales)}</td>
                <td className="px-4 py-3.5 sm:py-4 text-sm text-right text-rose-600 font-medium">{formatCurrency(month.totalPurchases)}</td>
                <td className="px-4 py-3.5 sm:py-4 text-sm text-right text-orange-600 font-medium">{formatCurrency(month.totalExpenses)}</td>
                <td className={`px-4 py-3.5 sm:py-4 text-sm text-right font-bold ${month.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(month.netProfit)}
                </td>
                <td className="px-4 py-3.5 sm:py-4 text-sm">
                                      <div className="flex justify-center">
                      <button
                        onClick={() => setSelectedMonthDetails(month)}
                        className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 hover:bg-blue-100 transition-colors"
                        title="View"
                      >
                        <BookOpen className="h-4 w-4" />
                      </button>
                    </div>
                </td>
              </tr>
            );
          }}
          emptyState={
            <div className="py-12 flex flex-col items-center justify-center text-slate-500">
              <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
              <p>No monthly records found</p>
            </div>
          }
        />
      </div>

      {/* Details Modal */}
      {selectedMonthDetails && (
        <MonthDetailsModal 
          month={selectedMonthDetails} 
          onClose={() => setSelectedMonthDetails(null)} 
          settings={settings}
        />
      )}
    </div>
  );
}
