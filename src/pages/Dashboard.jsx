import { useEffect, useState } from 'react';
import { 
  Banknote, TrendingUp, ShoppingBag, Wallet, 
  AlertTriangle, PackageX, Package, Users, CreditCard 
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatsCard from '@/components/StatsCard';
import DashboardCharts from '@/components/DashboardCharts';

const categoryColors = { business: {} };
import { useSettings } from '@/hooks/useSettings';
import { useBusiness } from '@/contexts/BusinessContext';
import { formatCurrency, formatDate } from '@/lib/utils';

let globalDashboardCache = null;

export default function Dashboard() {
  const { businessName, businessIcon, businessColor } = useBusiness();
  const settings = useSettings();
  const currency = settings?.currency ?? 'Rs';
    const bizCategoryColors = categoryColors.business;

  const parseDate = (value) => {
    try {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };

  

  // Keep track of database version to trigger worker updates
  const [metrics, setMetrics] = useState(globalDashboardCache);
  const [loadingError, setLoadingError] = useState(null);

  useEffect(() => {
    fetch('/api/metrics/dashboard')
      .then(r => r.json())
      .then(data => {
        globalDashboardCache = data;
        setMetrics(data);
        setLoadingError(null);
      })
      .catch(err => setLoadingError(err.message));
  }, []);

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

      <PageHeader 
        eyebrow="DASHBOARD" 
        title="Revenue overview and live inventory insights" 
      />
      <div className="grid gap-5 lg:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard 
          title="Sales Today" 
          value={formatCurrency(todaySalesTotal, currency)} 
          description={`${todaySalesCount} transaction(s)`} 
          color="emerald" 
          icon={Banknote} 
          arrow="forward"
        />
        <StatsCard 
          title="Sales This Month" 
          value={formatCurrency(thisMonthSalesTotal, currency)} 
          description={`${thisMonthSalesCount} sales recorded`} 
          color="blue" 
          icon={TrendingUp} 
          arrow="forward"
        />
        <StatsCard 
          title="Purchases This Month" 
          value={formatCurrency(thisMonthPurchasesTotal, currency)} 
          description={`${thisMonthPurchasesCount} restocks`} 
          color="blue" 
          icon={ShoppingBag} 
          arrow="forward"
        />
        <StatsCard 
          title="Net Profit" 
          value={formatCurrency(netProfitThisMonth, currency)} 
          description="Revenue minus cost and expenses" 
          color="blue" 
          icon={Wallet} 
          arrow="forward"
        />
        <StatsCard 
          title="Low Stock" 
          value={`${lowStockCount}`} 
          description="Items below threshold" 
          color="amber" 
          icon={AlertTriangle} 
          arrow="forward"
        />
        <StatsCard 
          title="Out of Stock" 
          value={`${outOfStockCount}`} 
          description="Previously stocked, now empty" 
          color="red" 
          icon={PackageX} 
          arrow="forward"
        />
        <StatsCard 
          title="Total Products" 
          value={`${totalProductsCount}`} 
          description="Active product SKUs" 
          color="blue" 
          icon={Package} 
          arrow="forward"
        />
        <StatsCard 
          title={peopleLabel} 
          value={formatCurrency(totalPeopleBalance, currency)} 
          description={`${peopleWithBalance} ${peopleOweLabel}`} 
          color="teal" 
          icon={Users} 
          arrow="forward"
        />
        <StatsCard 
          title="Total Payable" 
          value={formatCurrency(totalSupplierBalance, currency)} 
          description={`${suppliersWithBalance} suppliers you owe`} 
          color="blue" 
          icon={CreditCard} 
          arrow="forward"
        />
      </div>

      <DashboardCharts lineData={lineData} barData={barData} pieData={pieData} recentTransactions={recentTransactions} topSellingProducts={topSellingProducts} currency={currency} />

    </div>
  );
}
