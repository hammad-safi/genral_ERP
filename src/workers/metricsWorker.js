import { getDB } from '../lib/db.js';
import { calculateNetProfit } from '../lib/utils.js';

const parseDate = (value) => {
  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

// Pre-define categorical colors matching Dashboard.jsx
const bizCategoryColors = {
  'Medicine': '#3b82f6',
  'Cosmetics': '#ec4899',
  'Food': '#f59e0b',
  'Electronics': '#8b5cf6',
  'Other': '#64748b'
};

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  try {
    const db = getDB();

    if (type === 'DASHBOARD_METRICS') {
      const [salesData, purchaseData, expenseData, inventoryData, productsData, peopleData, ledgerData, supplierData, supplierLedgerData] = await Promise.all([
        db.sales.toArray(),
        db.purchases.toArray(),
        db.expenses.toArray(),
        db.inventory.toArray(),
        db.products.toArray(),
        db.customers.toArray(),
        db.customerLedger.toArray(),
        db.suppliers.toArray(),
        db.supplierLedger.toArray()
      ]);

      const activeSales = salesData.filter(s => s.returned !== true);

      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const todaySales = activeSales.filter((sale) => {
        const saleDate = parseDate(sale.date);
        if (!saleDate) return false;
        return (
          saleDate.getDate() === startOfToday.getDate() &&
          saleDate.getMonth() === startOfToday.getMonth() &&
          saleDate.getFullYear() === startOfToday.getFullYear()
        );
      });

      const salesThisMonth = activeSales.filter((sale) => {
        const saleDate = parseDate(sale.date);
        if (!saleDate) return false;
        return (
          saleDate.getMonth() === startOfMonth.getMonth() &&
          saleDate.getFullYear() === startOfMonth.getFullYear()
        );
      });

      const purchasesThisMonth = purchaseData.filter((purchase) => {
        const purchaseDate = new Date(purchase.date);
        return purchaseDate >= startOfMonth && purchaseDate <= endOfMonth;
      });

      const expensesThisMonth = expenseData.filter((expense) => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startOfMonth && expenseDate <= endOfMonth;
      });

      const lowStockCount = inventoryData.filter(item => 
        item.quantity > 0 && item.quantity <= item.lowStockThreshold
      ).length;
      
      const outOfStockCount = inventoryData.filter(item => 
        item.quantity <= 0
      ).length;

      const netProfitThisMonth = calculateNetProfit(salesThisMonth, productsData, expensesThisMonth);

      const linePoints = {};
      for (let offset = 29; offset >= 0; offset -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - offset);
        linePoints[date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })] = 0;
      }
      activeSales.forEach((sale) => {
        const saleDate = parseDate(sale.date);
        if (!saleDate) return;
        const label = saleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        if (label in linePoints) {
          linePoints[label] += sale.totalAmount;
        }
      });
      const lineData = Object.entries(linePoints).map(([name, value]) => ({ name, value }));

      const months = {};
      for (let i = 0; i < 6; i += 1) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        months[label] = { revenue: 0, expense: 0 };
      }
      activeSales.forEach((sale) => {
        const saleDate = parseDate(sale.date);
        if (!saleDate) return;
        const label = saleDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (months[label]) months[label].revenue += sale.totalAmount;
      });
      expenseData.forEach((expense) => {
        const expenseDate = parseDate(expense.date);
        if (!expenseDate) return;
        const label = expenseDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (months[label]) months[label].expense += expense.amount;
      });
      const barData = Object.entries(months)
        .map(([name, values]) => ({ name, ...values }))
        .reverse();

      const categoryTotals = {};
      activeSales.forEach((sale) => {
        sale.items.forEach((item) => {
          const product = productsData.find((product) => product.id === item.productId);
          const category = product?.category ?? 'Other';
          categoryTotals[category] = (categoryTotals[category] || 0) + item.subtotal;
        });
      });
      const palette = ['#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#06b6d4', '#f97316'];
      const pieData = Object.entries(categoryTotals)
        .map(([name, value], index) => ({ 
          name, 
          value, 
          fill: bizCategoryColors[name] || palette[index % palette.length] 
        }))
        .slice(0, 6);

      const recentTransactions = [
        ...activeSales.map((sale) => ({
          type: 'Sale',
          date: sale.date,
          amount: sale.totalAmount,
          label: `${sale.items.length} item(s)`,
        })),
        ...purchaseData.map((purchase) => ({
          type: 'Purchase',
          date: purchase.date,
          amount: purchase.totalAmount,
          label: purchase.items?.[0]?.productName,
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      const peopleBalances = peopleData.map(person => {
        const idField = 'customerId';
        const ledger = ledgerData.filter(e => e[idField] === person.id);
        const totalCharged = ledger
          .filter(e => e.type === 'charge' || e.type === 'purchase')
          .reduce((sum, e) => sum + e.amount, 0);
        const totalPaid = ledger
          .filter(e => e.type === 'payment' || e.type === 'payment_reversal')
          .reduce((sum, e) => sum + e.amount, 0);
        return {
          personId: person.id,
          balance: totalCharged - totalPaid
        };
      });

      const totalPeopleBalance = peopleBalances
        .filter(p => p.balance > 0)
        .reduce((sum, p) => sum + p.balance, 0);

      const peopleWithBalance = peopleBalances.filter(p => p.balance > 0).length;

      const supplierBalances = supplierData.map(supplier => {
        const idField = 'supplierId';
        const ledger = supplierLedgerData.filter(e => e[idField] === supplier.id);
        const totalCharged = ledger
          .filter(e => e.type === 'charge' || e.type === 'purchase')
          .reduce((sum, e) => sum + e.amount, 0);
        const totalPaid = ledger
          .filter(e => e.type === 'payment' || e.type === 'payment_reversal')
          .reduce((sum, e) => sum + e.amount, 0);
        return {
          supplierId: supplier.id,
          balance: totalCharged - totalPaid
        };
      });

      const totalSupplierBalance = supplierBalances
        .filter(s => s.balance > 0)
        .reduce((sum, s) => sum + s.balance, 0);

      const suppliersWithBalance = supplierBalances.filter(s => s.balance > 0).length;

      const productSales = {};
      activeSales.forEach((sale) => {
        sale.items.forEach((item) => {
          if (!productSales[item.productId]) {
            productSales[item.productId] = 0;
          }
          productSales[item.productId] += item.qty;
        });
      });
      const topSellingProducts = Object.entries(productSales)
        .map(([productId, quantity]) => {
          const product = productsData.find((p) => p.id === Number(productId));
          return {
            name: product?.name || 'Unknown',
            price: product?.price || 0,
            category: product?.category || 'Unknown',
            image: product?.image || null,
            quantity,
            revenue: activeSales.reduce((sum, sale) => {
              const saleItem = sale.items.find((i) => i.productId === Number(productId));
              return sum + (saleItem ? saleItem.subtotal : 0);
            }, 0),
          };
        })
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      self.postMessage({
        type: 'DASHBOARD_METRICS_RESULT',
        payload: {
          todaySalesTotal: todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0),
          todaySalesCount: todaySales.length,
          thisMonthSalesTotal: salesThisMonth.reduce((sum, sale) => sum + sale.totalAmount, 0),
          thisMonthSalesCount: salesThisMonth.length,
          thisMonthPurchasesTotal: purchasesThisMonth.reduce((sum, purchase) => sum + purchase.totalAmount, 0),
          thisMonthPurchasesCount: purchasesThisMonth.length,
          thisMonthExpensesTotal: expensesThisMonth.reduce((sum, expense) => sum + expense.amount, 0),
          netProfitThisMonth,
          lowStockCount,
          outOfStockCount,
          totalProductsCount: productsData.length,
          lineData,
          barData,
          pieData,
          recentTransactions,
          totalPeopleBalance,
          peopleWithBalance,
          totalSupplierBalance,
          suppliersWithBalance,
          topSellingProducts
        }
      });
    } else if (type === 'REPORT_METRICS') {
      const { range } = payload;
      
      const [salesData, purchaseData, expenseData, inventoryData, productsData] = await Promise.all([
        db.sales.toArray(),
        db.purchases.toArray(),
        db.expenses.toArray(),
        db.inventory.toArray(),
        db.products.toArray(),
      ]);

      const activeSales = salesData.filter(s => s.returned !== true);
      const fromDate = range.from;
      const toDate = range.to;

      const filteredSales = activeSales.filter((sale) => {
        const d = new Date(sale.date);
        const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return localDateStr >= fromDate && localDateStr <= toDate;
      });

      const filteredPurchases = purchaseData.filter((purchase) => {
        const d = new Date(purchase.date);
        const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return localDateStr >= fromDate && localDateStr <= toDate;
      });

      const filteredExpenses = expenseData.filter((expense) => {
        const d = new Date(expense.date);
        const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return localDateStr >= fromDate && localDateStr <= toDate;
      });

      const totalSalesAmount = filteredSales.reduce((acc, curr) => acc + curr.totalAmount, 0);
      const totalPurchasesAmount = filteredPurchases.reduce((acc, curr) => acc + (curr.totalAmount ?? 0), 0);
      const totalExpensesAmount = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
      const netProfitAmount = calculateNetProfit(filteredSales, productsData, filteredExpenses);
      const totalInventoryValue = inventoryData.reduce((acc, item) => {
        const product = productsData.find((p) => p.id === item.productId);
        return acc + (product?.costPrice || 0) * item.quantity;
      }, 0);

      const bestSelling = Object.values(filteredSales.reduce((acc, sale) => {
        sale.items.forEach((item) => {
          const key = item.productId;
          acc[key] = (acc[key] || { name: item.productName, qty: 0, revenue: 0 });
          acc[key].qty += item.qty;
          acc[key].revenue += (item.subtotal || (item.qty * item.unitPrice) || 0);
        });
        return acc;
      }, {}))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      const totalItemsSold = filteredSales.reduce((acc, sale) => acc + (sale.items?.reduce((sum, item) => sum + item.qty, 0) || 0), 0);

      self.postMessage({
        type: 'REPORT_METRICS_RESULT',
        payload: {
          totalSalesAmount,
          totalPurchasesAmount,
          totalExpensesAmount,
          netProfitAmount,
          totalInventoryValue,
          bestSelling,
          totalItemsSold,
          filteredSalesCount: filteredSales.length,
          filteredPurchasesCount: filteredPurchases.length,
          filteredExpensesCount: filteredExpenses.length,
          filteredSales,
          filteredPurchases,
          filteredExpenses
        }
      });
    } else if (type === 'MONTHLY_RECORDS_METRICS') {
      const [sales, purchases, expenses, products, customers] = await Promise.all([
        db.sales.toArray(),
        db.purchases.toArray(),
        db.expenses.toArray(),
        db.products.toArray(),
        db.customers.toArray(),
      ]);

      const groupByMonth = (items) => {
        const groups = {};
        items.forEach(item => {
          const d = new Date(item.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        });
        return groups;
      };

      const salesByMonth = groupByMonth(sales);
      const purchasesByMonth = groupByMonth(purchases);
      const expensesByMonth = groupByMonth(expenses);

      const allMonths = [...new Set([
        ...Object.keys(salesByMonth),
        ...Object.keys(purchasesByMonth),
        ...Object.keys(expensesByMonth)
      ])].sort().reverse();

      const monthSummaries = allMonths.map(month => {
        const monthlySales = salesByMonth[month] ?? [];
        const monthlyPurchases = purchasesByMonth[month] ?? [];
        const monthlyExpenses = expensesByMonth[month] ?? [];

        const totalSales = monthlySales.reduce((s, x) => s + (x.totalAmount ?? 0), 0);
        const totalPurchases = monthlyPurchases.reduce((s, x) => s + (x.totalAmount ?? 0), 0);
        const totalExpenses = monthlyExpenses.reduce((s, x) => s + (x.amount ?? 0), 0);
        const netProfit = calculateNetProfit(monthlySales, products, monthlyExpenses);

        const [year, mon] = month.split('-');
        const monthName = new Date(Number(year), Number(mon) - 1).toLocaleString('default', {
          month: 'long', year: 'numeric'
        });

        const monthlySalesMapped = monthlySales.map(sale => {
          let customerName = 'Walk-in';
          if (sale.customerId) {
            customerName = customers.find(c => c.id === sale.customerId)?.name ?? 'Walk-in';
          }
          return { ...sale, customerName };
        });

        return {
          key: month,
          monthName,
          sales: monthlySalesMapped,
          purchases: monthlyPurchases,
          expenses: monthlyExpenses,
          totalSales,
          totalPurchases,
          totalExpenses,
          netProfit
        };
      });

      const grandTotalSales = monthSummaries.reduce((s, m) => s + m.totalSales, 0);
      const grandTotalPurchases = monthSummaries.reduce((s, m) => s + m.totalPurchases, 0);
      const grandTotalExpenses = monthSummaries.reduce((s, m) => s + m.totalExpenses, 0);
      const grandNetProfit = monthSummaries.reduce((s, m) => s + m.netProfit, 0);

      self.postMessage({
        type: 'MONTHLY_RECORDS_METRICS_RESULT',
        payload: {
          monthSummaries,
          grandTotalSales,
          grandTotalPurchases,
          grandTotalExpenses,
          grandNetProfit
        }
      });
    }
  } catch (error) {
    self.postMessage({ type: 'ERROR', payload: error.message });
  }
};
