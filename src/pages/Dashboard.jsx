import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Banknote, TrendingUp, ShoppingBag, Wallet, 
  AlertTriangle, PackageX, Package, Users, CreditCard 
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatsCard from '@/components/StatsCard';
import DashboardCharts from '@/components/DashboardCharts';
import { initDB, getDB } from '@/lib/db';
import { categoryColors } from '@/lib/seed';
import { useSettings } from '@/hooks/useSettings';
import { useBusiness } from '@/contexts/BusinessContext';
import { formatCurrency, formatDate } from '@/lib/utils';

let globalDashboardCache = null;

export default function Dashboard() {
  const { businessName, businessIcon, businessColor } = useBusiness();
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';
  const db = getDB();
  const bizCategoryColors = categoryColors.business;

  const parseDate = (value) => {
    try {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const cleanupInvalidSaleDates = async () => {
      await initDB();
      const currentDB = getDB();
      try {
        await currentDB.sales.filter((sale) => parseDate(sale.date) === null).modify((sale) => {
          sale.date = new Date().toISOString();
        });
      } catch (e) {
        console.error("Cleanup dates error", e);
      }
    };
    cleanupInvalidSaleDates();
  }, []);

  // Keep track of database version to trigger worker updates
  const dbVersion = useLiveQuery(
    async () => {
      const currentDB = getDB();
      return (await currentDB.sales.count()) + (await currentDB.expenses.count()) + (await currentDB.purchases.count()) + (await currentDB.inventory.count());
    },
    []
  );

  const [metrics, setMetrics] = useState(globalDashboardCache);
  const [loadingError, setLoadingError] = useState(null);

  useEffect(() => {
    if (dbVersion === undefined) return; // Wait for Dexie to initialize

    // Initialize worker
    const worker = new Worker(new URL('../workers/metricsWorker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      if (e.data.type === 'DASHBOARD_METRICS_RESULT') {
        globalDashboardCache = e.data.payload;
        setMetrics(e.data.payload);
      } else if (e.data.type === 'ERROR') {
        setLoadingError(e.data.payload);
      }
    };

    worker.postMessage({ type: 'DASHBOARD_METRICS' });

    return () => {
      worker.terminate();
    };
  }, [dbVersion]);

  // Loading and error fallback
  if (loadingError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Revenue overview and live inventory insights" />
        <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700">Error loading dashboard data: {loadingError}</div>
      </div>
    );
  }
  if (!metrics) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Revenue overview and live inventory insights" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
              <div className="h-4 w-24 bg-slate-200 rounded mb-4"></div>
              <div className="h-8 w-32 bg-slate-200 rounded mb-2"></div>
              <div className="h-4 w-40 bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const {
    todaySalesTotal = 0,
    todaySalesCount = 0,
    thisMonthSalesTotal = 0,
    thisMonthSalesCount = 0,
    thisMonthPurchasesTotal = 0,
    thisMonthPurchasesCount = 0,
    thisMonthExpensesTotal = 0,
    lowStockCount = 0,
    outOfStockCount = 0,
    netProfitThisMonth = 0,
    totalProductsCount = 0,
    lineData = [],
    barData = [],
    pieData = [],
    recentTransactions = [],
    totalPeopleBalance = 0,
    peopleWithBalance = 0,
    totalSupplierBalance = 0,
    suppliersWithBalance = 0,
    topSellingProducts = [],
  } = metrics;

  const peopleLabel = 'Customer Balances';
  const peopleOweLabel = 'customers owe money';

  return (
    <div className="space-y-6">

      <PageHeader title="Dashboard" description="Revenue overview and live inventory insights" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Sales Today" value={formatCurrency(todaySalesTotal, currency)} description={`${todaySalesCount} transaction(s)`} type="positive" icon={Banknote} />
        <StatsCard title="Sales This Month" value={formatCurrency(thisMonthSalesTotal, currency)} description={`${thisMonthSalesCount} sales recorded`} type="positive" icon={TrendingUp} />
        <StatsCard title="Purchases This Month" value={formatCurrency(thisMonthPurchasesTotal, currency)} description={`${thisMonthPurchasesCount} restocks`} type="neutral" icon={ShoppingBag} />
        <StatsCard title="Net Profit" value={formatCurrency(netProfitThisMonth, currency)} description="Revenue minus cost and expenses" type={netProfitThisMonth >= 0 ? "positive" : "negative"} icon={Wallet} />
        <StatsCard title="Low Stock" value={`${lowStockCount}`} description="Items below threshold" type={lowStockCount > 0 ? "negative" : "neutral"} icon={AlertTriangle} />
        <StatsCard title="Out of Stock" value={`${outOfStockCount}`} description="Previously stocked, now empty" type={outOfStockCount > 0 ? "negative" : "neutral"} icon={PackageX} />
        <StatsCard title="Total Products" value={`${totalProductsCount}`} description="Active product SKUs" type="neutral" icon={Package} />
        <StatsCard title={peopleLabel} value={formatCurrency(totalPeopleBalance, currency)} description={`${peopleWithBalance} ${peopleOweLabel}`} type={totalPeopleBalance > 0 ? "positive" : "neutral"} icon={Users} />
        <StatsCard title="Total Payable" value={formatCurrency(totalSupplierBalance, currency)} description={`${suppliersWithBalance} suppliers you owe`} type={totalSupplierBalance > 0 ? "negative" : "neutral"} icon={CreditCard} />
      </div>

      <DashboardCharts lineData={lineData} barData={barData} pieData={pieData} recentTransactions={recentTransactions} topSellingProducts={topSellingProducts} currency={currency} />

    </div>
  );
}
