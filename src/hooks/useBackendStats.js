import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3001/api/dashboard-stats';

let globalCache = null;
let fetchPromise = null;

export function useBackendStats() {
  const [stats, setStats] = useState(globalCache || {
    customers: { totalCustomers: 0, totalOwed: 0, totalPaid: 0 },
    suppliers: { totalSuppliers: 0, totalOwed: 0, totalPaid: 0 },
    sales: { totalSales: 0, totalRevenue: 0 },
    purchases: { totalPurchases: 0, totalCost: 0, totalPaid: 0 },
    expenses: { totalExpenses: 0, totalAmount: 0 },
    products: { totalProducts: 0, totalValue: 0 }
  });
  const [loading, setLoading] = useState(!globalCache);
  const [error, setError] = useState(null);

  const fetchStats = async (force = false) => {
    if (globalCache && !force) {
      setStats(globalCache);
      setLoading(false);
      return;
    }

    if (!fetchPromise || force) {
      fetchPromise = fetch(API_URL).then(res => res.json());
    }

    try {
      setLoading(true);
      const data = await fetchPromise;
      
      // Map flat API structure to the nested UI structure
      const mappedStats = {
        customers: {
          totalCustomers: data.customers || 0,
          totalOwed: data.customersOwed || 0,
          totalPaid: data.customersPaid || 0
        },
        suppliers: {
          totalSuppliers: data.suppliers || 0,
          totalOwed: data.suppliersOwed || 0,
          totalPaid: data.suppliersPaid || 0
        },
        sales: {
          totalSales: data.sales || 0,
          totalRevenue: data.salesRevenue || 0
        },
        purchases: {
          totalPurchases: data.purchases || 0,
          totalCost: data.purchasesCost || 0,
          totalPaid: data.purchasesPaid || 0
        },
        expenses: {
          totalExpenses: data.expenses || 0,
          totalAmount: data.expensesAmount || 0
        },
        products: {
          totalProducts: data.products || 0,
          totalValue: data.productsValue || 0
        }
      };

      globalCache = mappedStats;
      setStats(mappedStats);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard stats', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, error, refresh: () => fetchStats(true) };
}
