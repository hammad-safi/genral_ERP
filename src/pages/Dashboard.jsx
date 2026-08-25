import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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
  const bizCategoryColors = categoryColors.pharmacy;

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
      const sales = await currentDB.sales.toArray();
      const invalidSales = sales.filter((sale) => {
        const date = parseDate(sale.date);
        return date === null;
      });
      if (invalidSales.length > 0) {
        await Promise.all(
          invalidSales.map((sale) =>
            sale.id ? currentDB.sales.update(sale.id, { date: new Date().toISOString() }) : Promise.resolve(0)
          )
        );
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
    return <div style={{ padding: 32, color: 'red', textAlign: 'center' }}>Error loading dashboard data: {loadingError}</div>;
  }
  if (!metrics) {
    return <div style={{ padding: 32, textAlign: 'center' }}>Loading dashboard metrics...</div>;
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
  } = metrics;

  const peopleLabel = 'Customer Balances';
  const peopleOweLabel = 'customers owe money';

  return (
    <div className="space-y-6">

      <PageHeader title="Dashboard" description="Revenue overview and live inventory insights" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Sales Today" value={formatCurrency(todaySalesTotal, currency)} description={`${todaySalesCount} transaction(s)`} />
        <StatsCard title="Sales This Month" value={formatCurrency(thisMonthSalesTotal, currency)} description={`${thisMonthSalesCount} sales recorded`} />
        <StatsCard title="Purchases This Month" value={formatCurrency(thisMonthPurchasesTotal, currency)} description={`${thisMonthPurchasesCount} restocks`} />
        <StatsCard title="Net Profit" value={formatCurrency(netProfitThisMonth, currency)} description="Revenue minus cost and expenses" />
        <StatsCard title="Low Stock" value={`${lowStockCount}`} description="Items below threshold" />
        <StatsCard title="Out of Stock" value={`${outOfStockCount}`} description="Previously stocked, now empty" />
        <StatsCard title="Total Products" value={`${totalProductsCount}`} description="Active product SKUs" />
        <StatsCard title={peopleLabel} value={formatCurrency(totalPeopleBalance, currency)} description={`${peopleWithBalance} ${peopleOweLabel}`} />
      </div>

      <DashboardCharts lineData={lineData} barData={barData} pieData={pieData} recentTransactions={recentTransactions} currency={currency} />

    </div>
  );
}
