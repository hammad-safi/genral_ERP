require('dotenv').config();
const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:danger1718@localhost:5432/shop_erp?schema=public';
const isRemoteDb = connectionString.includes('supabase') || connectionString.includes('neon') || connectionString.includes('railway') || Boolean(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false
});

// Since we couldn't push schema with Prisma, we need to create the tables manually if they don't exist!
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ProductBatch" (
        "id" SERIAL PRIMARY KEY,
        "batchNumber" TEXT NOT NULL,
        "productId" INTEGER NOT NULL,
        "quantity" INTEGER NOT NULL DEFAULT 0,
        "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "expiryDate" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS "PriceHistory" (
        "id" SERIAL PRIMARY KEY,
        "productId" INTEGER NOT NULL,
        "type" TEXT NOT NULL,
        "purchasePrice" DOUBLE PRECISION DEFAULT 0,
        "wac" DOUBLE PRECISION DEFAULT 0,
        "date" TEXT,
        "quantity" INTEGER DEFAULT 1,
        "supplier" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS "SupplierLedger" (
        "id" SERIAL PRIMARY KEY,
        "supplierId" INTEGER NOT NULL,
        "date" TEXT NOT NULL,
        "description" TEXT,
        "credit" DOUBLE PRECISION DEFAULT 0,
        "debit" DOUBLE PRECISION DEFAULT 0,
        "balance" DOUBLE PRECISION DEFAULT 0,
        "refId" INTEGER,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS "Purchase" (
        "id" SERIAL PRIMARY KEY,
        "supplierId" INTEGER,
        "supplierName" TEXT,
        "date" TEXT,
        "amountPaid" DOUBLE PRECISION DEFAULT 0,
        "discount" DOUBLE PRECISION DEFAULT 0,
        "tax" DOUBLE PRECISION DEFAULT 0,
        "totalAmount" DOUBLE PRECISION DEFAULT 0,
        "items" JSONB DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      
      CREATE TABLE IF NOT EXISTS "Role" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT UNIQUE NOT NULL,
        "isSystem" BOOLEAN DEFAULT FALSE,
        "permissions" JSONB NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE TABLE IF NOT EXISTS "User" (
        "id" SERIAL PRIMARY KEY,
        "username" TEXT UNIQUE NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "isActive" BOOLEAN DEFAULT TRUE,
        "lastLogin" TEXT,
        "fullName" TEXT,
        "email" TEXT,
        "address" TEXT,
        "profilePicture" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER,
        "userName" TEXT,
        "action" TEXT,
        "module" TEXT,
        "details" TEXT,
        "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      DO $$
      DECLARE
        user_count INTEGER;
        role_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO role_count FROM "Role";
        IF role_count = 0 THEN
          INSERT INTO "Role" (name, "isSystem", permissions) VALUES 
          ('Admin', true, '{"Dashboard": {"Add": true, "Edit": true, "View": true, "Delete": true, "Export": true}, "Inventory": {"Add": true, "Edit": true, "View": true, "Delete": true, "Export": true}, "POS": {"Add": true, "Edit": true, "View": true, "Delete": true, "Export": true}, "Sales": {"Add": true, "Edit": true, "View": true, "Delete": true, "Export": true}, "Purchases": {"Add": true, "Edit": true, "View": true, "Delete": true, "Export": true}, "Suppliers": {"Add": true, "Edit": true, "View": true, "Delete": true, "Export": true}, "Customers": {"Add": true, "Edit": true, "View": true, "Delete": true, "Export": true}, "Expenses": {"Add": true, "Edit": true, "View": true, "Delete": true, "Export": true}, "Reports": {"Add": true, "Edit": true, "View": true, "Delete": true, "Export": true}, "Settings": {"Add": true, "Edit": true, "View": true, "Delete": true, "Export": true}, "Users": {"Add": true, "Edit": true, "View": true, "Delete": true, "Export": true}}'::jsonb),
          ('Manager', true, '{"Dashboard": {"Add": false, "Edit": false, "View": true, "Delete": false, "Export": false}, "Inventory": {"Add": true, "Edit": true, "View": true, "Delete": false, "Export": true}, "POS": {"Add": true, "Edit": false, "View": true, "Delete": false, "Export": false}, "Sales": {"Add": true, "Edit": false, "View": true, "Delete": false, "Export": true}, "Purchases": {"Add": true, "Edit": true, "View": true, "Delete": false, "Export": true}, "Suppliers": {"Add": true, "Edit": true, "View": true, "Delete": false, "Export": true}, "Customers": {"Add": true, "Edit": true, "View": true, "Delete": false, "Export": true}, "Expenses": {"Add": true, "Edit": true, "View": true, "Delete": false, "Export": true}, "Reports": {"Add": false, "Edit": false, "View": true, "Delete": false, "Export": true}, "Settings": {"Add": false, "Edit": false, "View": false, "Delete": false, "Export": false}, "Users": {"Add": false, "Edit": false, "View": false, "Delete": false, "Export": false}}'::jsonb),
          ('Cashier', true, '{"Dashboard": {"Add": false, "Edit": false, "View": true, "Delete": false, "Export": false}, "Inventory": {"Add": false, "Edit": false, "View": false, "Delete": false, "Export": false}, "POS": {"Add": true, "Edit": false, "View": true, "Delete": false, "Export": false}, "Sales": {"Add": true, "Edit": false, "View": true, "Delete": false, "Export": false}, "Purchases": {"Add": false, "Edit": false, "View": false, "Delete": false, "Export": false}, "Suppliers": {"Add": false, "Edit": false, "View": false, "Delete": false, "Export": false}, "Customers": {"Add": true, "Edit": true, "View": true, "Delete": false, "Export": false}, "Expenses": {"Add": false, "Edit": false, "View": false, "Delete": false, "Export": false}, "Reports": {"Add": false, "Edit": false, "View": false, "Delete": false, "Export": false}, "Settings": {"Add": false, "Edit": false, "View": false, "Delete": false, "Export": false}, "Users": {"Add": false, "Edit": false, "View": false, "Delete": false, "Export": false}}'::jsonb);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS "Product" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "category" TEXT,
        "barcode" TEXT,
        "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "unit" TEXT NOT NULL DEFAULT 'pcs',
          "attributes" JSONB DEFAULT '{}'::jsonb,
        "expiryDate" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS "Inventory" (
        "id" SERIAL PRIMARY KEY,
        "productId" INTEGER NOT NULL,
        "quantity" INTEGER NOT NULL DEFAULT 0,
        "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
        "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiryDate" TEXT
      );
      CREATE TABLE IF NOT EXISTS "Category" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "parentId" INTEGER,
          "attributes" JSONB DEFAULT '[]'::jsonb
      );
      CREATE TABLE IF NOT EXISTS "Customer" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "phone" TEXT,
        "email" TEXT,
        "address" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS "Supplier" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "phone" TEXT,
        "email" TEXT,
        "address" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS "Sale" (
        "id" SERIAL PRIMARY KEY,
        "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
          "customerId" INTEGER,
          "items" JSONB DEFAULT '[]'::jsonb
        );
      CREATE TABLE IF NOT EXISTS "Expense" (
        "id" SERIAL PRIMARY KEY,
        "date" TEXT,
        "amount" DOUBLE PRECISION DEFAULT 0,
        "description" TEXT,
        "category" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS "CustomerLedger" (
        "id" SERIAL PRIMARY KEY,
        "customerId" INTEGER NOT NULL,
        "date" TEXT NOT NULL,
        "description" TEXT,
        "credit" DOUBLE PRECISION DEFAULT 0,
        "debit" DOUBLE PRECISION DEFAULT 0,
        "balance" DOUBLE PRECISION DEFAULT 0,
        "refId" INTEGER,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("PostgreSQL tables verified.");
    const { rowCount: roleCount } = await pool.query('SELECT id FROM "Role" WHERE name = \'Admin\'');
    if (roleCount === 0) {
      await pool.query('INSERT INTO "Role" (name, permissions, "isSystem") VALUES (\'Admin\', \'{}\'::jsonb, true)');
    }

    // Add new columns to existing "User" table
    try { await pool.query('ALTER TABLE "User" ADD COLUMN "fullName" TEXT'); } catch(e) {}
    try { await pool.query('ALTER TABLE "User" ADD COLUMN "email" TEXT'); } catch(e) {}
    try { await pool.query('ALTER TABLE "User" ADD COLUMN "address" TEXT'); } catch(e) {}
    try { await pool.query('ALTER TABLE "User" ADD COLUMN "profilePicture" TEXT'); } catch(e) {}
    try { await pool.query('ALTER TABLE "Expense" ADD COLUMN "note" TEXT'); } catch(e) {}
  } finally {
    client.release();
  }
}

initDB().catch(console.error);


const calculateNetProfit = (sales, products, expenses) => {
  const validSales = sales.filter((sale) => sale.returned !== true);
  const totalRevenue = validSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const productsMap = products instanceof Map ? products : new Map((products || []).map(p => [p.id, p]));
  const totalCOGS = validSales.reduce((total, sale) => {
    const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
    return total + items.reduce((saleSum, item) => {
      let costPrice = item.costPrice;
      if (costPrice == null) {
        costPrice = productsMap.get(item.productId)?.costPrice ?? 0;
      }
      return saleSum + costPrice * (item.qty || item.quantity || 0);
    }, 0);
  }, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  return totalRevenue - totalCOGS - totalExpenses;
};

// --- METRICS ---
app.get('/api/metrics/dashboard', async (req, res) => {
  try {
    const [
      { rows: todaySalesRows },
      { rows: monthSalesRows },
      { rows: monthPurchasesRows },
      { rows: monthExpensesRows },
      { rows: monthCogsRows },
      { rows: inventoryRows },
      { rows: productsCountRows },
      { rows: customerBalanceRows },
      { rows: supplierBalanceRows },
      { rows: recentSales },
      { rows: recentPurchases },
      { rows: pieChartRows },
      { rows: topSellingRows },
      { rows: lineDataRows },
      { rows: barDataSalesRows },
      { rows: barDataExpensesRows }
    ] = await Promise.all([
      pool.query(`SELECT SUM("totalAmount") as total, COUNT(*) as count FROM "Sale" WHERE date >= date_trunc('day', CURRENT_TIMESTAMP)`),
      pool.query(`SELECT SUM("totalAmount") as total, COUNT(*) as count FROM "Sale" WHERE date >= date_trunc('month', CURRENT_TIMESTAMP)`),
      pool.query(`SELECT SUM("totalAmount") as total, COUNT(*) as count FROM "Purchase" WHERE date::timestamp >= date_trunc('month', CURRENT_TIMESTAMP)`),
      pool.query(`SELECT SUM("amount") as total FROM "Expense" WHERE (date::timestamp) >= date_trunc('month', CURRENT_TIMESTAMP)`),
      pool.query(`
        SELECT SUM((
          SELECT SUM(COALESCE((i->>'costPrice')::numeric, 0) * COALESCE((i->>'qty')::numeric, (i->>'quantity')::numeric, 0))
          FROM jsonb_array_elements(CASE WHEN "items" IS NULL OR "items"::text = '""' THEN '[]'::jsonb ELSE "items" END) as i
        )) as cogs
        FROM "Sale"
        WHERE date >= date_trunc('month', CURRENT_TIMESTAMP)
      `),
      pool.query(`SELECT COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= COALESCE("lowStockThreshold", 10)) as low, COUNT(*) FILTER (WHERE quantity <= 0) as out FROM "Inventory"`),
      pool.query(`SELECT COUNT(*) as count FROM "Product"`),
      pool.query(`
        SELECT SUM(balance) as total, COUNT(DISTINCT "customerId") as count 
        FROM (SELECT "customerId", SUM(debit) - SUM(credit) as balance FROM "CustomerLedger" GROUP BY "customerId") sub
        WHERE balance > 0
      `),
      pool.query(`
        SELECT SUM(balance) as total, COUNT(DISTINCT "supplierId") as count 
        FROM (SELECT "supplierId", SUM(credit) - SUM(debit) as balance FROM "SupplierLedger" GROUP BY "supplierId") sub
        WHERE balance > 0
      `),
      pool.query(`SELECT 'Sale' as type, date, "totalAmount" as amount, jsonb_array_length(CASE WHEN "items" IS NULL OR "items"::text = '""' THEN '[]'::jsonb ELSE "items" END) || ' item(s)' as label FROM "Sale" ORDER BY date DESC LIMIT 5`),
      pool.query(`SELECT 'Purchase' as type, date::timestamp as date, "totalAmount" as amount, (CASE WHEN "items" IS NULL OR "items"::text = '""' THEN '[]'::jsonb ELSE "items" END)->0->>'productName' as label FROM "Purchase" ORDER BY date::timestamp DESC LIMIT 5`),
      pool.query(`
        SELECT COALESCE(p.category, 'Other') as category, SUM(COALESCE((i->>'subtotal')::numeric, 0)) as subtotal
        FROM "Sale" s
        CROSS JOIN jsonb_array_elements(CASE WHEN "items" IS NULL OR "items"::text = '""' THEN '[]'::jsonb ELSE "items" END) as i
        LEFT JOIN "Product" p ON (i->>'productId')::int = p.id
        GROUP BY COALESCE(p.category, 'Other')
        ORDER BY subtotal DESC
        LIMIT 6
      `),
      pool.query(`
        SELECT 
          (i->>'productId')::int as "productId",
          SUM(COALESCE((i->>'qty')::numeric, (i->>'quantity')::numeric, 0)) as quantity,
          SUM(COALESCE((i->>'subtotal')::numeric, 0)) as revenue
        FROM "Sale" s
        CROSS JOIN jsonb_array_elements(CASE WHEN "items" IS NULL OR "items"::text = '""' THEN '[]'::jsonb ELSE "items" END) as i
        GROUP BY (i->>'productId')::int
        ORDER BY quantity DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT date_trunc('day', date) as day, SUM("totalAmount") as revenue
        FROM "Sale"
        WHERE date >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY day
        ORDER BY day ASC
      `),
      pool.query(`
        SELECT date_trunc('month', date) as month, SUM("totalAmount") as revenue
        FROM "Sale"
        WHERE date >= date_trunc('month', CURRENT_DATE - INTERVAL '5 months')
        GROUP BY month
        ORDER BY month ASC
      `),
      pool.query(`
        SELECT date_trunc('month', date::timestamp) as month, SUM("amount") as expense
        FROM "Expense"
        WHERE (date::timestamp) >= date_trunc('month', CURRENT_DATE - INTERVAL '5 months')
        GROUP BY month
        ORDER BY month ASC
      `)
    ]);

    const todaySalesTotal = Number(todaySalesRows[0]?.total || 0);
    const todaySalesCount = Number(todaySalesRows[0]?.count || 0);
    const thisMonthSalesTotal = Number(monthSalesRows[0]?.total || 0);
    const thisMonthSalesCount = Number(monthSalesRows[0]?.count || 0);
    const thisMonthPurchasesTotal = Number(monthPurchasesRows[0]?.total || 0);
    const thisMonthPurchasesCount = Number(monthPurchasesRows[0]?.count || 0);
    const thisMonthExpensesTotal = Number(monthExpensesRows[0]?.total || 0);
    const cogsThisMonth = Number(monthCogsRows[0]?.cogs || 0);
    
    const netProfitThisMonth = thisMonthSalesTotal - cogsThisMonth - thisMonthExpensesTotal;
    
    const lowStockCount = Number(inventoryRows[0]?.low || 0);
    const outOfStockCount = Number(inventoryRows[0]?.out || 0);
    const totalProductsCount = Number(productsCountRows[0]?.count || 0);
    
    const totalPeopleBalance = Number(customerBalanceRows[0]?.total || 0);
    const peopleWithBalance = Number(customerBalanceRows[0]?.count || 0);
    const totalSupplierBalance = Number(supplierBalanceRows[0]?.total || 0);
    const suppliersWithBalance = Number(supplierBalanceRows[0]?.count || 0);

    // Format Line Data
    const linePoints = {};
    for (let offset = 29; offset >= 0; offset -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      linePoints[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })] = 0;
    }
    lineDataRows.forEach(row => {
      const d = new Date(row.day);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
      if (label in linePoints) linePoints[label] += Number(row.revenue);
    });
    const lineData = Object.entries(linePoints).map(([name, value]) => ({ name, value }));

    // Format Bar Data
    const months = {};
    for (let i = 0; i < 6; i += 1) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months[d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })] = { revenue: 0, expense: 0 };
    }
    barDataSalesRows.forEach(row => {
      const d = new Date(row.month);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (months[label]) months[label].revenue += Number(row.revenue);
    });
    barDataExpensesRows.forEach(row => {
      const d = new Date(row.month);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (months[label]) months[label].expense += Number(row.expense);
    });
    const barData = Object.entries(months).map(([name, values]) => ({ name, ...values })).reverse();

    // Pie Chart
    const bizCategoryColors = { 'Medicine': '#3b82f6', 'Cosmetics': '#ec4899', 'Food': '#f59e0b', 'Electronics': '#8b5cf6', 'Other': '#64748b' };
    const palette = ['#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#06b6d4', '#f97316'];
    const pieData = pieChartRows.map((row, index) => ({
      name: row.category,
      value: Number(row.subtotal),
      fill: bizCategoryColors[row.category] || palette[index % palette.length]
    }));

    // Top Selling Products
    const topSellingProducts = [];
    for (const row of topSellingRows) {
      const { rows: prod } = await pool.query('SELECT name, price, category FROM "Product" WHERE id = $1', [row.productId]);
      topSellingProducts.push({
        name: prod[0]?.name || 'Unknown',
        price: prod[0]?.price || 0,
        category: prod[0]?.category || 'Unknown',
        quantity: Number(row.quantity),
        revenue: Number(row.revenue)
      });
    }

    // Recent Transactions
    const recentTransactions = [...recentSales, ...recentPurchases]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(t => ({ ...t, amount: Number(t.amount) }));

    res.json({
      todaySalesTotal, todaySalesCount,
      thisMonthSalesTotal, thisMonthSalesCount,
      thisMonthPurchasesTotal, thisMonthPurchasesCount,
      thisMonthExpensesTotal,
      netProfitThisMonth,
      lowStockCount, outOfStockCount,
      totalProductsCount,
      lineData,
      barData,
      pieData,
      recentTransactions,
      totalPeopleBalance, peopleWithBalance,
      totalSupplierBalance, suppliersWithBalance,
      topSellingProducts
    });
  } catch (error) { 
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  }
});

app.get('/api/metrics/reports', async (req, res) => {
  try {
    const from = (req.query.from || '').trim() || '1970-01-01';
    const to = (req.query.to || '').trim() || '2099-12-31';
    
    const [{rows: rawSales}, {rows: filteredPurchases}, {rows: filteredExpenses}, {rows: inventoryData}, {rows: productsData}] = await Promise.all([
        pool.query(`SELECT * FROM "Sale" WHERE "date"::date >= $1::date AND "date"::date <= $2::date`, [from, to]),
        pool.query(`SELECT * FROM "Purchase" WHERE SUBSTRING("date" FROM 1 FOR 10) >= $1 AND SUBSTRING("date" FROM 1 FOR 10) <= $2`, [from, to]),
        pool.query(`SELECT * FROM "Expense" WHERE SUBSTRING("date" FROM 1 FOR 10) >= $1 AND SUBSTRING("date" FROM 1 FOR 10) <= $2`, [from, to]),
        pool.query('SELECT * FROM "Inventory"'),
        pool.query('SELECT * FROM "Product"')
    ]);
    const filteredSales = rawSales.filter(s => s.returned !== true);

    const totalSalesAmount = filteredSales.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const totalPurchasesAmount = filteredPurchases.reduce((acc, curr) => acc + (curr.totalAmount ?? 0), 0);
    const totalExpensesAmount = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const netProfitAmount = calculateNetProfit(filteredSales, productsData, filteredExpenses);
    
    const totalInventoryValue = inventoryData.reduce((acc, item) => {
      const product = productsData.find((p) => p.id === item.productId);
      return acc + (product?.costPrice || 0) * item.quantity;
    }, 0);

    const bestSellingMap = filteredSales.reduce((acc, sale) => {
      const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
      items.forEach((item) => {
        const key = item.productId;
        if (!acc[key]) {
          acc[key] = { name: item.productName, qty: 0, revenue: 0 };
        }
        const qty = item.qty || item.quantity || 0;
        acc[key].qty += qty;
        acc[key].revenue += (item.subtotal || (qty * (item.unitPrice || 0)) || 0);
      });
      return acc;
    }, {});
    
    const bestSelling = Object.values(bestSellingMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const totalItemsSold = filteredSales.reduce((acc, sale) => {
      const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
      return acc + items.reduce((sum, item) => sum + (item.qty || item.quantity || 0), 0);
    }, 0);

    res.json({
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
    });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.get('/api/metrics/monthly', async (req, res) => {
  try {
    const [{rows: salesData}, {rows: purchaseData}, {rows: expenseData}, {rows: productsData}] = await Promise.all([
      pool.query('SELECT * FROM "Sale"'),
      pool.query('SELECT * FROM "Purchase"'),
      pool.query('SELECT * FROM "Expense"'),
      pool.query('SELECT * FROM "Product"')
    ]);

    const activeSales = salesData.filter(s => s.returned !== true);
    const productsMap = new Map(productsData.map(p => [p.id, p]));

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

    const salesByMonth = groupByMonth(activeSales);
    const purchasesByMonth = groupByMonth(purchaseData);
    const expensesByMonth = groupByMonth(expenseData);

    const allMonths = [...new Set([
      ...Object.keys(salesByMonth),
      ...Object.keys(purchasesByMonth),
      ...Object.keys(expensesByMonth)
    ])].sort().reverse();

    let grandTotalSales = 0;
    let grandTotalPurchases = 0;
    let grandTotalExpenses = 0;
    let grandNetProfit = 0;

    const monthSummaries = allMonths.map(month => {
      const monthlySales = salesByMonth[month] ?? [];
      const monthlyPurchases = purchasesByMonth[month] ?? [];
      const monthlyExpenses = expensesByMonth[month] ?? [];

      const totalSales = monthlySales.reduce((s, x) => s + (x.totalAmount ?? 0), 0);
      const totalPurchases = monthlyPurchases.reduce((s, x) => s + (x.totalAmount ?? 0), 0);
      const totalExpenses = monthlyExpenses.reduce((s, x) => s + (x.amount ?? 0), 0);
      const netProfit = calculateNetProfit(monthlySales, productsMap, monthlyExpenses);

      grandTotalSales += totalSales;
      grandTotalPurchases += totalPurchases;
      grandTotalExpenses += totalExpenses;
      grandNetProfit += netProfit;

      const [year, mon] = month.split('-');
      const monthName = new Date(Number(year), Number(mon) - 1).toLocaleString('default', {
        month: 'long', year: 'numeric'
      });

      return {
        key: month,
        monthName,
        totalSales,
        totalPurchases,
        totalExpenses,
        netProfit
      };
    });

    res.json({
      monthSummaries,
      grandTotalSales,
      grandTotalPurchases,
      grandTotalExpenses,
      grandNetProfit
    });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

// --- PRODUCTS ---
app.get('/api/products', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 20;
      const search = req.query.search || '';
      const category = req.query.category || '';
      const stock = req.query.stock || '';
      const expiry = req.query.expiry || '';
      const offset = page * limit;
  
      let query = 'SELECT p.* FROM "Product" p';
      let countQuery = 'SELECT COUNT(p.*) as total FROM "Product" p';
      let joins = '';
      let params = [];
      let whereClauses = [];
  
      if (stock === 'low') {
        joins += ' LEFT JOIN "Inventory" i ON i."productId" = p.id';
        whereClauses.push('COALESCE(i.quantity, 0) <= COALESCE(p."lowStockThreshold", 10)');
        whereClauses.push('COALESCE(i.quantity, 0) > 0');
      } else if (stock === 'out') {
        joins += ' LEFT JOIN "Inventory" i ON i."productId" = p.id';
        whereClauses.push('COALESCE(i.quantity, 0) <= 0');
      }

      if (expiry === 'near') {
        whereClauses.push('p."expiryDate" IS NOT NULL AND p."expiryDate" != \'\' AND p."expiryDate"::date <= CURRENT_DATE + interval \'30 days\' AND p."expiryDate"::date >= CURRENT_DATE');
      } else if (expiry === 'expired') {
        whereClauses.push('p."expiryDate" IS NOT NULL AND p."expiryDate" != \'\' AND p."expiryDate"::date < CURRENT_DATE');
      }

      if (search) {
        params.push('%' + search + '%');
        whereClauses.push('(p."name" ILIKE $' + params.length + ' OR p."barcode" ILIKE $' + params.length + ' OR p."category" ILIKE $' + params.length + ')');
      }
      
      if (category && category !== 'All') {
        const cats = category.split(',').filter(Boolean);
        if (cats.length > 0) {
          const catParams = [];
          for (const c of cats) {
            params.push(c);
            catParams.push('$' + params.length);
          }
          whereClauses.push('p."category" IN (' + catParams.join(', ') + ')');
        }
      }
  
      if (joins) {
        query += joins;
        countQuery += joins;
      }

      if (whereClauses.length > 0) {
        const whereStr = ' WHERE ' + whereClauses.join(' AND ');
        query += whereStr;
        countQuery += whereStr;
      }
  
      query += ' ORDER BY p.id DESC LIMIT ' + limit + ' OFFSET ' + offset;

    const { rows: products } = await pool.query(query, params);
    const { rows: countRes } = await pool.query(countQuery, params);

    res.json({ data: products, total: Math.max(0, parseInt(countRes[0].total)) });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});


// --- BULK PRODUCTS ---
app.post('/api/products/bulk', async (req, res) => {
  const client = await pool.connect();
  try {
    const products = req.body.products || [];
    await client.query('BEGIN');
    for (let p of products) {
      let categoryId = parseInt(p.category) || null;
      if (isNaN(categoryId)) categoryId = null;
      
      if (p.id) {
        await client.query(
          'INSERT INTO "Product" (id, name, category, barcode, price, "costPrice", unit, attributes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
          [p.id, p.name || 'Unknown', categoryId, p.barcode || null, p.price || 0, p.costPrice || 0, p.unit || 'pcs', p.attributes ? JSON.stringify(p.attributes) : '{}']
        );
      } else {
        await client.query(
          'INSERT INTO "Product" (name, category, barcode, price, "costPrice", unit, attributes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [p.name || 'Unknown', categoryId, p.barcode || null, p.price || 0, p.costPrice || 0, p.unit || 'pcs', p.attributes ? JSON.stringify(p.attributes) : '{}']
        );
      }
    }
    await client.query(`SELECT setval('"Product_id_seq"', COALESCE((SELECT MAX(id)+1 FROM "Product"), 1), false)`);
    await client.query('COMMIT');
    res.status(201).json({ message: 'Products bulk inserted successfully', count: products.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bulk Insert Error:', error);
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  } finally {
    client.release();
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const p = req.body;
    await pool.query('BEGIN');
    const { rows } = await pool.query(
      'INSERT INTO "Product" (name, category, barcode, price, "costPrice", unit, attributes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [p.name, p.category, p.barcode, p.price || 0, p.costPrice || 0, p.unit || 'pcs', p.attributes ? JSON.stringify(p.attributes) : '{}']
    );
    await pool.query('INSERT INTO "Inventory" ("productId", quantity, "lowStockThreshold") VALUES ($1, 0, 10)', [rows[0].id]);
    await pool.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, COALESCE(i.quantity, 0) as "stockQuantity", COALESCE(i.quantity, 0) as "currentStock"
      FROM "Product" p
      LEFT JOIN "Inventory" i ON i."productId" = p.id
      WHERE p.id = $1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const p = req.body;
    const { rows } = await pool.query(
      'UPDATE "Product" SET name = COALESCE($1, name), category = COALESCE($2, category), barcode = COALESCE($3, barcode), price = COALESCE($4, price), "costPrice" = COALESCE($5, "costPrice"), unit = COALESCE($6, unit), attributes = COALESCE($7, attributes), "expiryDate" = COALESCE($9, "expiryDate") WHERE id = $8 RETURNING *',
      [p.name, p.category, p.barcode, p.price, p.costPrice, p.unit, p.attributes ? JSON.stringify(p.attributes) : undefined, req.params.id, p.expiryDate]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});


// --- BULK DELETE PRODUCTS ---
app.delete('/api/products/bulk', async (req, res) => {
  const client = await pool.connect();
  try {
    const ids = req.body.ids || [];
    if (!ids.length) return res.json({ message: 'No ids provided' });
    
    await client.query('BEGIN');
    await client.query('DELETE FROM "Inventory" WHERE "productId" = ANY($1::int[])', [ids]);
    await client.query('DELETE FROM "ProductBatch" WHERE "productId" = ANY($1::int[])', [ids]);
    await client.query('DELETE FROM "Product" WHERE id = ANY($1::int[])', [ids]);
    await client.query('COMMIT');
    res.json({ message: 'Products deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  } finally {
    client.release();
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM "Product" WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

// --- INVENTORY ---
app.get('/api/inventory/stats', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT quantity, "lowStockThreshold" FROM "Inventory"');
    let total = rows.length;
    let healthy = 0;
    let low = 0;
    let out = 0;
    for (const r of rows) {
      if (r.quantity <= 0) out++;
      else if (r.quantity <= (r.lowStockThreshold || 10)) low++;
      else healthy++;
    }
    res.json({ total, healthy, low, out });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.get('/api/inventory', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const categoryFilter = req.query.category || 'All';
    const filterStatus = req.query.filter || 'all'; // all, low, out
    const expiryFilter = req.query.expiry || 'all'; // all, expired, near
    
    let whereClauses = [];
    let params = [];
    let paramIndex = 1;
    
    if (search) {
      whereClauses.push(`(p.name ILIKE $${paramIndex} OR p.barcode ILIKE $${paramIndex} OR p.category ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (categoryFilter !== 'All') {
      whereClauses.push(`p.category = $${paramIndex}`);
      params.push(categoryFilter);
      paramIndex++;
    }
    
    if (filterStatus === 'out') {
      whereClauses.push(`i.quantity <= 0`);
    } else if (filterStatus === 'low') {
      whereClauses.push(`i.quantity <= COALESCE(i."lowStockThreshold", 10)`);
    }
    
    if (expiryFilter === 'expired') {
      whereClauses.push(`p."expiryDate" < CURRENT_DATE::text`); // Simplistic expiry filtering
    } else if (expiryFilter === 'near') {
      whereClauses.push(`p."expiryDate" >= CURRENT_DATE::text AND p."expiryDate" <= (CURRENT_DATE + INTERVAL '30 days')::text`);
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    
    const countQuery = `SELECT COUNT(*) as total FROM "Inventory" i LEFT JOIN "Product" p ON i."productId" = p.id ${whereStr}`;
    const dataQuery = `
      SELECT i.*, p.name as "productName", p.category, p.barcode, p."costPrice", COALESCE(i."expiryDate", p."expiryDate") as "expiryDate", p.unit 
      FROM "Inventory" i 
      LEFT JOIN "Product" p ON i."productId" = p.id 
      ${whereStr}
      ORDER BY i.id DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const { rows: countRows } = await pool.query(countQuery, params);
    
    params.push(limit, page * limit);
    const { rows } = await pool.query(dataQuery, params);
    
    // Add expiryStatus string similar to what dexie transformChunk did
    const today = new Date();
    const warningDate = new Date();
    warningDate.setDate(today.getDate() + 30);
    
    const transformed = rows.map(item => {
      let expiryStatus = 'ok';
      if (item.expiryDate) {
         const expDate = new Date(item.expiryDate);
         if (expDate < today) expiryStatus = 'expired';
         else if (expDate <= warningDate) expiryStatus = 'warning';
      }
      return {
        ...item,
        expiryStatus,
        status: item.quantity <= 0 ? 'Out' : item.quantity <= (item.lowStockThreshold || 10) ? 'Low' : 'OK'
      };
    });

    res.json({ data: transformed, total: Math.max(0, parseInt(countRows[0].total)) });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.get('/api/inventory/:productId/batches', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM "ProductBatch" WHERE "productId" = $1 ORDER BY "expiryDate" ASC NULLS LAST, "createdAt" ASC', [req.params.productId]);
    res.json(rows);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.post('/api/inventory/adjust', async (req, res) => {
  const client = await pool.connect();
  try {
    const { productId, type, quantity, note, batchId } = req.body;
    await client.query('BEGIN');
    
    let change = type === 'add' ? quantity : -quantity;
    
    // Validate subtraction
    if (type === 'subtract') {
      const { rows: bRows } = await client.query('SELECT * FROM "ProductBatch" WHERE id = $1', [batchId]);
      if (bRows.length === 0) throw new Error('Batch not found');
      if (bRows[0].quantity < quantity) throw new Error(`Cannot subtract ${quantity}. Batch only has ${bRows[0].quantity}.`);
      
      await client.query('UPDATE "ProductBatch" SET quantity = quantity - $1 WHERE id = $2', [quantity, batchId]);
    } else {
      // Add
      if (batchId) {
        // Optional batch id provided? Wait, in the frontend batchId is used. 
        // If it's a manual add, we either create a new batch or use the existing one.
        // Actually, frontend UI passes "batchId" if selecting an existing batch to add to? 
        // Wait, frontend UI says "Select a batch..." for subtract. For add, "Create new manual batch".
        // Let's just create a new manual batch for 'add' if batchId is not an existing number.
      }
      
      const batchNum = `MANUAL-${Date.now()}`;
      await client.query(
        'INSERT INTO "ProductBatch" ("batchNumber", "productId", quantity, "costPrice", "createdAt") VALUES ($1, $2, $3, $4, NOW())',
        [batchNum, productId, quantity, 0]
      );
    }
    
    // Update total inventory
    await client.query(
      'UPDATE "Inventory" SET quantity = quantity + $1 WHERE "productId" = $2',
      [change, productId]
    );

    // Optional: Log it somewhere? No audit table currently exists in PG yet, we can skip it or add later.

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  } finally {
    client.release();
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM "Inventory" WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const queries = {
      customers: `SELECT COUNT(*) FROM "Customer"`,
      customersOwed: `SELECT SUM(balance) FROM (SELECT "customerId", MAX(balance) as balance FROM "CustomerLedger" GROUP BY "customerId") sub WHERE balance > 0`,
      customersPaid: `SELECT SUM(credit) FROM "CustomerLedger"`,
      
      suppliers: `SELECT COUNT(*) FROM "Supplier"`,
      suppliersOwed: `SELECT SUM(balance) FROM (SELECT "supplierId", MAX(balance) as balance FROM "SupplierLedger" GROUP BY "supplierId") sub WHERE balance > 0`,
      suppliersPaid: `SELECT SUM(debit) FROM "SupplierLedger"`,
      
      sales: `SELECT COUNT(*) FROM "Sale"`,
      salesRevenue: `SELECT SUM("totalAmount") FROM "Sale"`,
      
      purchases: `SELECT COUNT(*) FROM "Purchase"`,
      purchasesCost: `SELECT SUM("totalAmount") FROM "Purchase"`,
      purchasesPaid: `SELECT SUM("amountPaid") FROM "Purchase"`,
      
      expenses: `SELECT COUNT(*) FROM "Expense"`,
      expensesAmount: `SELECT SUM("amount") FROM "Expense"`,
      
      products: `SELECT COUNT(*) FROM "Product"`,
      productsValue: `SELECT SUM(p."costPrice" * i."quantity") FROM "Product" p JOIN "Inventory" i ON p.id = i."productId"`
    };

    const results = {};
    for (const [key, query] of Object.entries(queries)) {
      const { rows } = await pool.query(query);
      results[key] = parseFloat(rows[0]?.sum || rows[0]?.count || 0);
    }

    res.json({
      customers: {
        totalCustomers: results.customers,
        totalOwed: results.customersOwed,
        totalPaid: results.customersPaid
      },
      suppliers: {
        totalSuppliers: results.suppliers,
        totalOwed: results.suppliersOwed,
        totalPaid: results.suppliersPaid
      },
      sales: {
        totalSales: results.sales,
        totalRevenue: results.salesRevenue
      },
      purchases: {
        totalPurchases: results.purchases,
        totalCost: results.purchasesCost,
        totalPaid: results.purchasesPaid
      },
      expenses: {
        totalExpenses: results.expenses,
        totalAmount: results.expensesAmount
      },
      products: {
        totalProducts: results.products,
        totalValue: results.productsValue
      }
    });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

// --- CUSTOMERS ---
app.post('/api/customers', async (req, res) => {
  const client = await pool.connect();
  try {
    const c = req.body;
    const numBal = parseFloat(c.openingBalance) || 0;
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO "Customer" (name, phone, email, address, balance) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [c.name, c.phone || '', c.email || '', c.address || '', numBal]
    );
    const newCustomer = rows[0];

    if (numBal !== 0) {
      const debit = numBal > 0 ? numBal : 0;
      const credit = numBal < 0 ? Math.abs(numBal) : 0;
      await client.query(
        'INSERT INTO "CustomerLedger" ("customerId", "date", "description", "debit", "credit", "balance") VALUES ($1, $2, $3, $4, $5, $6)',
        [newCustomer.id, new Date().toISOString(), 'Opening balance', debit, credit, numBal]
      );
    }
    
    await client.query('COMMIT');
    newCustomer.balance = numBal;
    newCustomer.totalPaid = 0;
    newCustomer.totalCharged = numBal > 0 ? numBal : 0;
    res.status(201).json(newCustomer);
  } catch (error) {
    await client.query('ROLLBACK');
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  } finally {
    client.release();
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const c = req.body;
    const { rows } = await pool.query(
      'UPDATE "Customer" SET name = COALESCE($1, name), phone = COALESCE($2, phone), email = COALESCE($3, email), address = COALESCE($4, address) WHERE id = $5 RETURNING *',
      [c.name, c.phone, c.email, c.address, req.params.id]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.delete('/api/customers/bulk', async (req, res) => {
  const client = await pool.connect();
  try {
    const ids = req.body.ids || [];
    if (!ids.length) return res.json({ message: 'No ids provided' });
    
    await client.query('BEGIN');
    await client.query('DELETE FROM "CustomerLedger" WHERE "customerId" = ANY($1::int[])', [ids]);
    await client.query('DELETE FROM "Customer" WHERE id = ANY($1::int[])', [ids]);
    await client.query('COMMIT');
    res.json({ message: 'Customers deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  } finally {
    client.release();
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM "CustomerLedger" WHERE "customerId" = $1', [req.params.id]);
    await client.query('DELETE FROM "Customer" WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  } finally {
    client.release();
  }
});

app.get('/api/customers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = page * limit;

    let query = `
      SELECT c.*, 
        COALESCE(
          (SELECT SUM(debit) - SUM(credit) FROM "CustomerLedger" WHERE "customerId" = c.id),
          c.balance,
          0
        ) as balance,
        COALESCE((SELECT SUM(credit) FROM "CustomerLedger" WHERE "customerId" = c.id), 0) as "totalPaid"
      FROM "Customer" c
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM "Customer" c';
    let params = [];

    if (search) {
      query += ' WHERE c.name ILIKE $1 OR c.phone ILIKE $1 OR c.email ILIKE $1 OR REPLACE(REPLACE(COALESCE(c.phone, \'\'), \'-\', \'\'), \' \', \'\') ILIKE $1';
      countQuery += ' WHERE c.name ILIKE $1 OR c.phone ILIKE $1 OR c.email ILIKE $1 OR REPLACE(REPLACE(COALESCE(c.phone, \'\'), \'-\', \'\'), \' \', \'\') ILIKE $1';
      params.push('%' + search + '%');
    }
    
    query += ' ORDER BY c.id DESC LIMIT ' + limit + ' OFFSET ' + offset;

    const { rows: data } = await pool.query(query, params);
    const { rows: countRes } = await pool.query(countQuery, params);

    const { rows: statsRes } = await pool.query(`
      SELECT 
        COUNT(*)::int as "totalCount",
        COALESCE(SUM(
          GREATEST(
            COALESCE(
              (SELECT SUM(debit) - SUM(credit) FROM "CustomerLedger" WHERE "customerId" = c.id),
              c.balance,
              0
            ),
            0
          )
        ), 0)::float as "totalOwed",
        COALESCE((SELECT SUM(credit) FROM "CustomerLedger"), 0)::float as "totalPaid"
      FROM "Customer" c
    `);
    
    res.json({ 
      data, 
      total: Math.max(0, parseInt(countRes[0].total)), 
      page, 
      totalPages: Math.ceil(Math.max(0, parseInt(countRes[0].total)) / limit),
      summary: statsRes[0] || { totalCount: 0, totalOwed: 0, totalPaid: 0 }
    });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});






app.put('/api/customers/:id', async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    const { rows } = await pool.query(
      'UPDATE "Customer" SET name = COALESCE($1, name), phone = COALESCE($2, phone), email = COALESCE($3, email), address = COALESCE($4, address) WHERE id = $5 RETURNING *',
      [name, phone, email, address, req.params.id]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM "CustomerLedger" WHERE "customerId" = $1', [req.params.id]);
    await pool.query('DELETE FROM "Customer" WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

// --- CATEGORIES ---
app.get('/api/categories', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM "Category"');
    res.json(rows);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, parentId, attributes } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO "Category" (name, "parentId", attributes) VALUES ($1, $2, $3) RETURNING *',
      [name, parentId || null, attributes ? JSON.stringify(attributes) : '[]']
    );
    res.status(201).json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const { name, parentId, attributes } = req.body;
    const { rows } = await pool.query(
      'UPDATE "Category" SET name = $1, "parentId" = $2, attributes = $3 WHERE id = $4 RETURNING *',
      [name, parentId || null, attributes ? JSON.stringify(attributes) : '[]', req.params.id]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM "Category" WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

// --- RESET ALL / CLEAR DATA ---
app.all(['/api/reset-all', '/api/clear-data'], async (req, res) => {
  try {
    // Truncate all shop tables to completely wipe data while keeping User & Role
    await pool.query('TRUNCATE TABLE "Product", "Inventory", "Category", "Customer", "Supplier", "Sale", "Purchase", "ProductBatch", "PriceHistory", "SupplierLedger", "CustomerLedger", "Expense", "AuditLog" CASCADE');
    res.json({ success: true, message: 'All shop data cleared successfully' });
  } catch (error) { 
    require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n');
    res.status(500).json({ error: error.message }); 
  }
});


// --- PURCHASES & BATCHES ---
app.post('/api/purchases', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { supplierId, supplierName, date, amountPaid, discount, tax, totalAmount, items } = req.body;
    
    // Create Purchase Record
    const { rows: purchaseRows } = await client.query(
      'INSERT INTO "Purchase" ("supplierId", "supplierName", "date", "amountPaid", "discount", "tax", "totalAmount", "items") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [supplierId || null, supplierName || null, date, amountPaid || 0, discount || 0, tax || 0, totalAmount || 0, JSON.stringify(items || [])]
    );
    const purchase = purchaseRows[0];
    
    // Update Ledger
    if (supplierId && amountPaid !== (totalAmount - discount + tax)) {
      // get previous balance
      const { rows: balRows } = await client.query('SELECT balance FROM "SupplierLedger" WHERE "supplierId" = $1 ORDER BY id DESC LIMIT 1', [supplierId]);
      const prevBal = balRows.length > 0 ? balRows[0].balance : 0;
      const credit = (totalAmount - discount + tax); // amount we owe to supplier
      const debit = amountPaid; // amount we paid
      const newBal = prevBal + credit - debit;
      
      await client.query(
        'INSERT INTO "SupplierLedger" ("supplierId", "date", "description", "credit", "debit", "balance", "refId") VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [supplierId, date, 'Purchase #' + purchase.id, credit, debit, newBal, purchase.id]
      );
    }
    
    // Loop Items
    for (const item of items) {
      // Batch
      await client.query(
        'INSERT INTO "ProductBatch" ("batchNumber", "productId", "quantity", "costPrice", "expiryDate") VALUES ($1, $2, $3, $4, $5)',
        [item.batchNumber, item.productId, item.quantity, item.costPrice, item.expiryDate || null]
      );
      
      // Price History & WAC
      const { rows: histRows } = await client.query('SELECT quantity, "purchasePrice" FROM "PriceHistory" WHERE "productId" = $1 AND type = \'purchase\'', [item.productId]);
      const totalCostAmt = histRows.reduce((sum, h) => sum + ((h.purchasePrice || 0) * (h.quantity || 1)), 0) + item.totalCost;
      const totalQty = histRows.reduce((sum, h) => sum + (h.quantity || 1), 0) + item.quantity;
      const wac = totalQty > 0 ? totalCostAmt / totalQty : 0;
      
      await client.query('UPDATE "Product" SET "costPrice" = $1 WHERE id = $2', [wac, item.productId]);
      if (item.expiryDate) {
        await client.query('UPDATE "Product" SET "expiryDate" = $1 WHERE id = $2', [item.expiryDate, item.productId]);
      }
      
      await client.query(
        'INSERT INTO "PriceHistory" ("productId", "type", "purchasePrice", "wac", "date", "quantity", "supplier") VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [item.productId, 'purchase', item.costPrice, wac, date, item.quantity, supplierName || null]
      );
      
      // Inventory
      const { rows: invRows } = await client.query('SELECT id, quantity, "expiryDate" FROM "Inventory" WHERE "productId" = $1 LIMIT 1', [item.productId]);
      if (invRows.length > 0) {
        const inv = invRows[0];
        await client.query(
          'UPDATE "Inventory" SET quantity = $1, "lastUpdated" = $2, "expiryDate" = COALESCE($3, "expiryDate") WHERE id = $4',
          [inv.quantity + item.quantity, new Date().toISOString(), item.expiryDate || null, inv.id]
        );
      } else {
        await client.query(
          'INSERT INTO "Inventory" ("productId", "quantity", "lowStockThreshold", "expiryDate") VALUES ($1, $2, $3, $4)',
          [item.productId, item.quantity, 10, item.expiryDate || null]
        );
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(purchase);
  } catch (error) {
    await client.query('ROLLBACK');
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  } finally {
    client.release();
  }
});


app.delete('/api/purchases/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get purchase
    const { rows: purchaseRows } = await client.query('SELECT * FROM "Purchase" WHERE id = $1', [req.params.id]);
    if (purchaseRows.length === 0) throw new Error('Purchase not found');
    const purchase = purchaseRows[0];
    
    // Revert items
    const items = typeof purchase.items === 'string' ? JSON.parse(purchase.items) : (purchase.items || []);
    
    for (const item of items) {
      if (!item.productId) continue;
      
      // Revert Inventory
      const { rows: invRows } = await client.query('SELECT id, quantity FROM "Inventory" WHERE "productId" = $1 LIMIT 1', [item.productId]);
      if (invRows.length > 0) {
        const inv = invRows[0];
        const newQty = Math.max(0, inv.quantity - (item.quantity || 0));
        await client.query('UPDATE "Inventory" SET quantity = $1, "lastUpdated" = $2 WHERE id = $3', [newQty, new Date().toISOString(), inv.id]);
      }
      
      // Revert Batch
      if (item.batchNumber) {
        const { rows: batchRows } = await client.query('SELECT id, quantity FROM "ProductBatch" WHERE "productId" = $1 AND "batchNumber" = $2 LIMIT 1', [item.productId, item.batchNumber]);
        if (batchRows.length > 0) {
          const batch = batchRows[0];
          const newBatchQty = Math.max(0, batch.quantity - (item.quantity || 0));
          await client.query('UPDATE "ProductBatch" SET quantity = $1 WHERE id = $2', [newBatchQty, batch.id]);
        }
      }
      
      // Delete PriceHistory entry corresponding to this purchase (we'll just delete one matching date and qty)
      await client.query(
        'DELETE FROM "PriceHistory" WHERE id IN (SELECT id FROM "PriceHistory" WHERE "productId" = $1 AND type = \'purchase\' AND quantity = $2 AND date = $3 LIMIT 1)',
        [item.productId, item.quantity, purchase.date]
      );
    }
    
    // Revert Supplier Ledger
    if (purchase.supplierId) {
       await client.query('DELETE FROM "SupplierLedger" WHERE "refId" = $1', [purchase.id]);
       
       // Recalculate balance for subsequent ledgers (optional/complex, usually we just append a correcting entry instead)
       // Let's just append a correcting entry to reverse the charge
       const credit = purchase.amountPaid; // Return amount paid
       const debit = (purchase.totalAmount - (purchase.discount || 0) + (purchase.tax || 0)); // Revert invoice cost
       
       const { rows: balRows } = await client.query('SELECT balance FROM "SupplierLedger" WHERE "supplierId" = $1 ORDER BY id DESC LIMIT 1', [purchase.supplierId]);
       const prevBal = balRows.length > 0 ? balRows[0].balance : 0;
       const newBal = prevBal + credit - debit;
       
       await client.query(
         'INSERT INTO "SupplierLedger" ("supplierId", "date", "description", "credit", "debit", "balance", "refId") VALUES ($1, $2, $3, $4, $5, $6, $7)',
         [purchase.supplierId, new Date().toISOString(), 'Reversal of Purchase #' + purchase.id, credit, debit, newBal, purchase.id]
       );
    }
    
    // Delete Purchase
    await client.query('DELETE FROM "Purchase" WHERE id = $1', [req.params.id]);
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  } finally {
    client.release();
  }
});

app.get('/api/purchases', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM "Purchase"';
    let countQuery = 'SELECT COUNT(*) as total FROM "Purchase"';
    const params = [];
    
    if (search) {
      params.push('%' + search + '%');
      const searchClause = ' WHERE ("supplierName" ILIKE $1 OR date ILIKE $1 OR id::text ILIKE $1)';
      query += searchClause;
      countQuery += searchClause;
    }
    
    query += ' ORDER BY id DESC LIMIT ' + limit + ' OFFSET ' + offset;

    const { rows: purchases } = await pool.query(query, params);
    const { rows: countRes } = await pool.query(countQuery, params);
    
    // Add purchaseNumber for backwards compatibility
    const dataWithNumbers = purchases.map(p => ({
      ...p,
      purchaseNumber: 'PUR-' + String(p.id).padStart(4, '0')
    }));

    res.json({ data: dataWithNumbers, total: Math.max(0, parseInt(countRes[0].total)) });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});


app.post('/api/batches', async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await pool.query(
      'INSERT INTO "ProductBatch" ("batchNumber", "productId", "quantity", "costPrice", "expiryDate") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [b.batchNumber, b.productId, b.quantity || 0, b.costPrice || 0, b.expiryDate || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.put('/api/batches/:id', async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await pool.query(
      'UPDATE "ProductBatch" SET "batchNumber" = COALESCE($1, "batchNumber"), quantity = COALESCE($2, quantity), "costPrice" = COALESCE($3, "costPrice"), "expiryDate" = COALESCE($4, "expiryDate") WHERE id = $5 RETURNING *',
      [b.batchNumber, b.quantity, b.costPrice, b.expiryDate, req.params.id]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.delete('/api/batches/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM "ProductBatch" WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
});
app.get('/api/batches', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM "ProductBatch" ORDER BY id DESC');
    res.json({ data: rows });
  } catch (error) { { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
});
app.get('/api/ledger/:supplierId', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM "SupplierLedger" WHERE "supplierId" = $1 ORDER BY id ASC', [req.params.supplierId]);
    res.json({ data: rows });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});



// --- DATABASE SEEDER ---
app.post('/api/seed', async (req, res) => {
  const { productsCount = 0, customersCount = 0, suppliersCount = 0 } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Seed Products
    if (productsCount > 0) {
      let query = 'INSERT INTO "Product" (name, barcode, price, "costPrice", unit) VALUES ';
      let values = [];
      let paramIndex = 1;
      for (let i = 0; i < productsCount; i++) {
        query += `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`;
        if (i < productsCount - 1 && (values.length + 5) < 30000) query += ', ';
        values.push(`Seed Product ${Math.floor(Math.random() * 1000000)}`, `B${Date.now()}${i}`, Math.floor(Math.random() * 1000) + 10, Math.floor(Math.random() * 500) + 5, 'pcs');
        
        // Chunk inserts to avoid query string limits
        if (values.length >= 25000 || i === productsCount - 1) {
          await client.query(query, values);
          if (i < productsCount - 1) {
             query = 'INSERT INTO "Product" (name, barcode, price, "costPrice", unit) VALUES ';
             values = [];
             paramIndex = 1;
          }
        }
      }
    }
    
    // Seed Customers
    if (customersCount > 0) {
      let query = 'INSERT INTO "Customer" (name, phone, address, balance) VALUES ';
      let values = [];
      let paramIndex = 1;
      for (let i = 0; i < customersCount; i++) {
        query += `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`;
        if (i < customersCount - 1 && (values.length + 4) < 30000) query += ', ';
        values.push(`Seed Customer ${Math.floor(Math.random() * 1000000)}`, `555-${Math.floor(Math.random() * 9000)+1000}`, '123 Seed St', 0);
        
        if (values.length >= 25000 || i === customersCount - 1) {
          await client.query(query, values);
          if (i < customersCount - 1) {
             query = 'INSERT INTO "Customer" (name, phone, address, balance) VALUES ';
             values = [];
             paramIndex = 1;
          }
        }
      }
    }

    // Seed Suppliers
    if (suppliersCount > 0) {
      let query = 'INSERT INTO "Supplier" (name, phone, address, balance) VALUES ';
      let values = [];
      let paramIndex = 1;
      for (let i = 0; i < suppliersCount; i++) {
        query += `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`;
        if (i < suppliersCount - 1 && (values.length + 4) < 30000) query += ', ';
        values.push(`Seed Supplier ${Math.floor(Math.random() * 1000000)}`, `555-${Math.floor(Math.random() * 9000)+1000}`, '456 Seed Ave', 0);
        
        if (values.length >= 25000 || i === suppliersCount - 1) {
          await client.query(query, values);
          if (i < suppliersCount - 1) {
             query = 'INSERT INTO "Supplier" (name, phone, address, balance) VALUES ';
             values = [];
             paramIndex = 1;
          }
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Seeding completed' });
  } catch (error) {
    await client.query('ROLLBACK');
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  } finally {
    client.release();
  }
});

// --- SUPPLIERS ---
app.get('/api/suppliers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = page * limit;

    let query = "SELECT s.*, COALESCE(SUM(l.credit) - SUM(l.debit), 0) as balance FROM \"Supplier\" s LEFT JOIN \"SupplierLedger\" l ON s.id = l.\"supplierId\"";
    let countQuery = 'SELECT COUNT(*) as total FROM "Supplier" s';
    let params = [];

    if (search) {
      query += ' WHERE s.name ILIKE $1 OR s.phone ILIKE $1 OR s.email ILIKE $1';
      countQuery += ' WHERE s.name ILIKE $1 OR s.phone ILIKE $1 OR s.email ILIKE $1';
      params.push('%' + search + '%');
    }

    query += ' GROUP BY s.id ORDER BY s.id DESC LIMIT ' + limit + ' OFFSET ' + offset;

    const { rows: data } = await pool.query(query, params);
    const { rows: countRes } = await pool.query(countQuery, params);
    const { rows: statsRes } = await pool.query(`
      SELECT 
        COUNT(*)::int as "totalCount",
        COALESCE(SUM(
          GREATEST(
            COALESCE(
              (SELECT SUM(credit) - SUM(debit) FROM "SupplierLedger" WHERE "supplierId" = s.id),
              s.balance,
              0
            ),
            0
          )
        ), 0)::float as "totalOwed",
        COALESCE((SELECT SUM(debit) FROM "SupplierLedger"), 0)::float as "totalPaid"
      FROM "Supplier" s
    `);

    res.json({ 
      data, 
      total: Math.max(0, parseInt(countRes[0].total)), 
      page, 
      totalPages: Math.ceil(Math.max(0, parseInt(countRes[0].total)) / limit),
      summary: statsRes[0] || { totalCount: 0, totalOwed: 0, totalPaid: 0 }
    });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.get('/api/purchases', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const month = req.query.month || '';
    const offset = page * limit;

    let query = 'SELECT * FROM "Purchase"';
    let countQuery = 'SELECT COUNT(*) as total FROM "Purchase"';
    let params = [];
    let whereClauses = [];

    if (search) {
      params.push('%' + search + '%');
      whereClauses.push('("supplierName" ILIKE $' + params.length + ' OR date ILIKE $' + params.length + ' OR id::text ILIKE $' + params.length + ')');
    }
    
    if (month) {
      params.push(month);
      whereClauses.push("to_char(\"date\", 'YYYY-MM') = $" + params.length);
    }
    
    if (whereClauses.length > 0) {
      const whereStr = ' WHERE ' + whereClauses.join(' AND ');
      query += whereStr;
      countQuery += whereStr;
    }

    query += ' ORDER BY id DESC LIMIT ' + limit + ' OFFSET ' + offset;

    const { rows: purchases } = await pool.query(query, params);
    const { rows: countRes } = await pool.query(countQuery, params);
    
    // Add purchaseNumber for backwards compatibility
    const dataWithNumbers = purchases.map(p => ({
      ...p,
      purchaseNumber: 'PUR-' + String(p.id).padStart(4, '0')
    }));

    res.json({ data: dataWithNumbers, total: Math.max(0, parseInt(countRes[0].total)) });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});


app.post('/api/batches', async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await pool.query(
      'INSERT INTO "ProductBatch" ("batchNumber", "productId", "quantity", "costPrice", "expiryDate") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [b.batchNumber, b.productId, b.quantity || 0, b.costPrice || 0, b.expiryDate || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.put('/api/batches/:id', async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await pool.query(
      'UPDATE "ProductBatch" SET "batchNumber" = COALESCE($1, "batchNumber"), quantity = COALESCE($2, quantity), "costPrice" = COALESCE($3, "costPrice"), "expiryDate" = COALESCE($4, "expiryDate") WHERE id = $5 RETURNING *',
      [b.batchNumber, b.quantity, b.costPrice, b.expiryDate, req.params.id]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.delete('/api/batches/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM "ProductBatch" WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
});
app.get('/api/batches', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM "ProductBatch" ORDER BY id DESC');
    res.json({ data: rows });
  } catch (error) { { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
});
app.get('/api/ledger/:supplierId', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM "SupplierLedger" WHERE "supplierId" = $1 ORDER BY id ASC', [req.params.supplierId]);
    res.json({ data: rows });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});



// --- DATABASE SEEDER ---
app.post('/api/seed', async (req, res) => {
  const { productsCount = 0, customersCount = 0, suppliersCount = 0 } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Seed Products
    if (productsCount > 0) {
      let query = 'INSERT INTO "Product" (name, barcode, price, "costPrice", unit) VALUES ';
      let values = [];
      let paramIndex = 1;
      for (let i = 0; i < productsCount; i++) {
        query += `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`;
        if (i < productsCount - 1 && (values.length + 5) < 30000) query += ', ';
        values.push(`Seed Product ${Math.floor(Math.random() * 1000000)}`, `B${Date.now()}${i}`, Math.floor(Math.random() * 1000) + 10, Math.floor(Math.random() * 500) + 5, 'pcs');
        
        // Chunk inserts to avoid query string limits
        if (values.length >= 25000 || i === productsCount - 1) {
          await client.query(query, values);
          if (i < productsCount - 1) {
             query = 'INSERT INTO "Product" (name, barcode, price, "costPrice", unit) VALUES ';
             values = [];
             paramIndex = 1;
          }
        }
      }
    }
    
    // Seed Customers
    if (customersCount > 0) {
      let query = 'INSERT INTO "Customer" (name, phone, address, balance) VALUES ';
      let values = [];
      let paramIndex = 1;
      for (let i = 0; i < customersCount; i++) {
        query += `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`;
        if (i < customersCount - 1 && (values.length + 4) < 30000) query += ', ';
        values.push(`Seed Customer ${Math.floor(Math.random() * 1000000)}`, `555-${Math.floor(Math.random() * 9000)+1000}`, '123 Seed St', 0);
        
        if (values.length >= 25000 || i === customersCount - 1) {
          await client.query(query, values);
          if (i < customersCount - 1) {
             query = 'INSERT INTO "Customer" (name, phone, address, balance) VALUES ';
             values = [];
             paramIndex = 1;
          }
        }
      }
    }

    // Seed Suppliers
    if (suppliersCount > 0) {
      let query = 'INSERT INTO "Supplier" (name, phone, address, balance) VALUES ';
      let values = [];
      let paramIndex = 1;
      for (let i = 0; i < suppliersCount; i++) {
        query += `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`;
        if (i < suppliersCount - 1 && (values.length + 4) < 30000) query += ', ';
        values.push(`Seed Supplier ${Math.floor(Math.random() * 1000000)}`, `555-${Math.floor(Math.random() * 9000)+1000}`, '456 Seed Ave', 0);
        
        if (values.length >= 25000 || i === suppliersCount - 1) {
          await client.query(query, values);
          if (i < suppliersCount - 1) {
             query = 'INSERT INTO "Supplier" (name, phone, address, balance) VALUES ';
             values = [];
             paramIndex = 1;
          }
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Seeding completed' });
  } catch (error) {
    await client.query('ROLLBACK');
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  } finally {
    client.release();
  }
});

// --- SUPPLIERS ---
app.post('/api/suppliers', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, phone, email, address, openingBalance } = req.body;
    const numBal = parseFloat(openingBalance) || 0;
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO "Supplier" (name, phone, email, address, balance) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name ?? null, phone ?? null, email ?? null, address ?? null, numBal]
    );
    const supplier = rows[0];
    if (numBal > 0) {
       await client.query(
         'INSERT INTO "SupplierLedger" ("supplierId", "date", description, credit, debit, balance) VALUES ($1, $2, $3, $4, 0, $5)',
         [supplier.id, new Date().toISOString(), 'Opening Balance', numBal, numBal]
       );
    }
    await client.query('COMMIT');
    supplier.balance = numBal;
    res.status(201).json(supplier);
  } catch (error) { 
    await client.query('ROLLBACK');
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); } 
  } finally {
    client.release();
  }
});

app.get('/api/suppliers/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, 
        COALESCE(
          (SELECT SUM(credit) - SUM(debit) FROM "SupplierLedger" WHERE "supplierId" = s.id),
          s.balance,
          0
        ) as balance
      FROM "Supplier" s WHERE s.id = $1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    res.json(rows[0]);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/suppliers/:id', async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    const { rows } = await pool.query(
      'UPDATE "Supplier" SET name = COALESCE($1, name), phone = COALESCE($2, phone), email = COALESCE($3, email), address = COALESCE($4, address) WHERE id = $5 RETURNING *',
      [name ?? null, phone ?? null, email ?? null, address ?? null, req.params.id]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM "Supplier" WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

// --- SALES ---
app.get('/api/sales', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = page * limit;

    let query = 'SELECT * FROM "Sale"';
    let countQuery = 'SELECT COUNT(*) as total FROM "Sale"';
    let params = [];

    if (search) {
      query += ' WHERE "paymentMethod" ILIKE $1';
      countQuery += ' WHERE "paymentMethod" ILIKE $1';
      params.push('%' + search + '%');
    } else {
      
    }

    query += ' ORDER BY id DESC LIMIT ' + limit + ' OFFSET ' + offset;

    const { rows: data } = await pool.query(query, params);
    const { rows: countRes } = await pool.query(countQuery, params);

    res.json({ data, total: Math.max(0, parseInt(countRes[0].total)), page, totalPages: Math.ceil(Math.max(0, parseInt(countRes[0].total)) / limit) });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.post('/api/sales', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { date, totalAmount, amountPaid, discount, paymentMethod, customerId, items } = req.body;
    
    // Create Sale Record
    const { rows: saleRows } = await client.query(
      'INSERT INTO "Sale" ("date", "totalAmount", "discount", "paymentMethod", "customerId", "items") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [date || new Date().toISOString(), totalAmount ?? 0, discount ?? 0, paymentMethod || 'Cash', customerId ?? null, JSON.stringify(items || [])]
    );
    const sale = saleRows[0];
    
    // Insert Items and Update Inventory
    for (const item of (items || [])) {
      // Get current inventory
      const { rows: invRows } = await client.query('SELECT id, quantity FROM "Inventory" WHERE "productId" = $1', [item.productId]);
      if (invRows.length > 0) {
        await client.query('UPDATE "Inventory" SET quantity = quantity - $1 WHERE "productId" = $2', [item.quantity || item.qty, item.productId]);
      } else {
        await client.query('INSERT INTO "Inventory" ("productId", quantity) VALUES ($1, $2)', [item.productId, -(item.quantity || item.qty)]);
      }
    }
    
    // Ledger logic for credit sales
    if (customerId && amountPaid < totalAmount) {
      const chargeAmt = totalAmount - discount;
      const { rows: balRows } = await client.query('SELECT balance FROM "CustomerLedger" WHERE "customerId" = $1 ORDER BY id DESC LIMIT 1', [customerId]);
      let prevBal = balRows.length > 0 ? balRows[0].balance : 0;
      
      // Charge
      prevBal += chargeAmt;
      await client.query(
        'INSERT INTO "CustomerLedger" ("customerId", "date", "description", "debit", "credit", "balance", "refId") VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [customerId, date, 'Invoice #' + sale.id, chargeAmt, 0, prevBal, sale.id]
      );
      
      // Payment (if partial payment was made)
      if (amountPaid > 0) {
        prevBal -= amountPaid;
        await client.query(
          'INSERT INTO "CustomerLedger" ("customerId", "date", "description", "debit", "credit", "balance", "refId") VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [customerId, date, 'Payment for Invoice #' + sale.id, 0, amountPaid, prevBal, sale.id]
        );
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(sale);
  } catch (error) { 
    await client.query('ROLLBACK');
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); } 
  } finally {
    client.release();
  }
});

app.put('/api/sales/:id', async (req, res) => {
  try {
    const { date, totalAmount, discount, paymentMethod, customerId } = req.body;
    const { rows } = await pool.query(
      'UPDATE "Sale" SET "date" = COALESCE($1, "date"), "totalAmount" = COALESCE($2, "totalAmount"), "discount" = COALESCE($3, "discount"), "paymentMethod" = COALESCE($4, "paymentMethod"), "customerId" = COALESCE($5, "customerId") WHERE id = $6 RETURNING *',
      [date ?? null, totalAmount ?? null, discount ?? null, paymentMethod ?? null, customerId ?? null, req.params.id]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.delete('/api/sales/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM "Sale" WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

// --- EXPENSES ---
app.get('/api/expenses', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const search = (req.query.search || '').trim();
    const category = (req.query.category || '').trim();
    const offset = page * limit;

    let query = 'SELECT *, COALESCE(description, \'\') as title FROM "Expense"';
    let countQuery = 'SELECT COUNT(*) as total FROM "Expense"';
    let params = [];
    let whereClauses = [];

    if (search) {
      params.push('%' + search + '%');
      whereClauses.push(`("description" ILIKE $${params.length} OR "category" ILIKE $${params.length} OR "note" ILIKE $${params.length})`);
    }

    if (category && category !== 'All') {
      params.push(category);
      whereClauses.push(`"category" = $${params.length}`);
    }

    if (whereClauses.length > 0) {
      const whereStr = ' WHERE ' + whereClauses.join(' AND ');
      query += whereStr;
      countQuery += whereStr;
    }

    query += ' ORDER BY id DESC LIMIT ' + limit + ' OFFSET ' + offset;

    const { rows: data } = await pool.query(query, params);
    const { rows: countRes } = await pool.query(countQuery, params);

    const { rows: statsRes } = await pool.query(`
      SELECT 
        COUNT(*)::int as "totalCount",
        COALESCE(SUM("amount"), 0)::float as "totalAmount"
      FROM "Expense"
    `);

    res.json({ 
      data, 
      total: Math.max(0, parseInt(countRes[0].total)), 
      page, 
      totalPages: Math.ceil(Math.max(0, parseInt(countRes[0].total)) / limit),
      summary: statsRes[0] || { totalCount: 0, totalAmount: 0 }
    });
  } catch (error) { 
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const { date, amount, description, title, note, category } = req.body;
    const desc = description || title || '';
    const { rows } = await pool.query(
      'INSERT INTO "Expense" ("date", "amount", "description", "category", "note") VALUES ($1, $2, $3, $4, $5) RETURNING *, COALESCE(description, \'\') as title',
      [date || new Date().toISOString(), parseFloat(amount) || 0, desc, category || 'Other', note || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) { 
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { date, amount, description, title, note, category } = req.body;
    const desc = (description !== undefined ? description : title) ?? null;
    const { rows } = await pool.query(
      'UPDATE "Expense" SET "date" = COALESCE($1, "date"), "amount" = COALESCE($2, "amount"), "description" = COALESCE($3, "description"), "category" = COALESCE($4, "category"), "note" = COALESCE($5, "note") WHERE id = $6 RETURNING *, COALESCE(description, \'\') as title',
      [date ?? null, amount !== undefined ? parseFloat(amount) : null, desc, category ?? null, note ?? null, req.params.id]
    );
    res.json(rows[0]);
  } catch (error) { 
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  }
});

app.delete('/api/expenses/bulk', async (req, res) => {
  try {
    const ids = req.body.ids || [];
    if (!ids.length) return res.json({ message: 'No ids provided' });
    await pool.query('DELETE FROM "Expense" WHERE id = ANY($1::int[])', [ids]);
    res.json({ success: true, message: 'Expenses deleted successfully' });
  } catch (error) { 
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM "Expense" WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { 
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  }
});

// --- LEDGERS ---
app.get('/api/supplierLedger', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 1000;
    const offset = page * limit;

    const { rows: data } = await pool.query('SELECT * FROM "SupplierLedger" ORDER BY id DESC LIMIT $1 OFFSET $2', [limit, offset]);
    
    const { rows: count } = await pool.query(`SELECT COUNT(*) as total FROM "SupplierLedger"`);
    const total = parseInt(count[0].total);

    res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) { { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
});
app.get('/api/customerLedger', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 1000;
    const offset = page * limit;

    const { rows: data } = await pool.query('SELECT * FROM "CustomerLedger" ORDER BY id DESC LIMIT $1 OFFSET $2', [limit, offset]);
    
    const { rows: count } = await pool.query(`SELECT COUNT(*) as total FROM "CustomerLedger"`);
    const total = parseInt(count[0].total);

    res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});


app.get('/api/customers/:id/ledger', async (req, res) => {
  try {
    const page = req.query.page !== undefined ? parseInt(req.query.page) : null;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : null;
    const search = req.query.search || '';

    let query = 'SELECT * FROM "CustomerLedger" WHERE "customerId" = $1';
    let countQuery = 'SELECT COUNT(*) as total FROM "CustomerLedger" WHERE "customerId" = $1';
    let params = [req.params.id];

    if (search) {
      query += ' AND (description ILIKE $2 OR date ILIKE $2)';
      countQuery += ' AND (description ILIKE $2 OR date ILIKE $2)';
      params.push('%' + search + '%');
    }

    query += ' ORDER BY id ASC';

    if (page !== null && limit !== null) {
      const offset = page * limit;
      query += ` LIMIT ${limit} OFFSET ${offset}`;
      const { rows } = await pool.query(query, params);
      const { rows: countRes } = await pool.query(countQuery, params);
      return res.json({
        data: rows,
        total: Math.max(0, parseInt(countRes[0].total)),
        page,
        totalPages: Math.ceil(Math.max(0, parseInt(countRes[0].total)) / limit)
      });
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.post('/api/customers/:id/ledger', async (req, res) => {
  try {
    const { type, amount, description, date } = req.body;
    let debit = 0;
    let credit = 0;
    if (type === 'charge') debit = amount;
    else if (type === 'payment') credit = amount;
    
    // Calculate new balance
    const { rows: lastRow } = await pool.query('SELECT balance FROM "CustomerLedger" WHERE "customerId" = $1 ORDER BY id DESC LIMIT 1', [req.params.id]);
    let prevBalance = 0;
    if (lastRow.length > 0) prevBalance = lastRow[0].balance || 0;
    const newBalance = prevBalance + debit - credit;

    const { rows } = await pool.query(
      'INSERT INTO "CustomerLedger" ("customerId", date, description, debit, credit, balance) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.params.id, date || new Date().toISOString(), description, debit, credit, newBalance]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.get('/api/suppliers/:id/ledger', async (req, res) => {
  try {
    const page = req.query.page !== undefined ? parseInt(req.query.page) : null;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : null;
    const search = req.query.search || '';

    let query = 'SELECT * FROM "SupplierLedger" WHERE "supplierId" = $1';
    let countQuery = 'SELECT COUNT(*) as total FROM "SupplierLedger" WHERE "supplierId" = $1';
    let params = [req.params.id];

    if (search) {
      query += ' AND (description ILIKE $2 OR date ILIKE $2)';
      countQuery += ' AND (description ILIKE $2 OR date ILIKE $2)';
      params.push('%' + search + '%');
    }

    query += ' ORDER BY id ASC';

    if (page !== null && limit !== null) {
      const offset = page * limit;
      query += ` LIMIT ${limit} OFFSET ${offset}`;
      const { rows } = await pool.query(query, params);
      const { rows: countRes } = await pool.query(countQuery, params);
      return res.json({
        data: rows,
        total: Math.max(0, parseInt(countRes[0].total)),
        page,
        totalPages: Math.ceil(Math.max(0, parseInt(countRes[0].total)) / limit)
      });
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.post('/api/suppliers/:id/ledger', async (req, res) => {
  try {
    const { type, amount, description, date } = req.body;
    let debit = 0;
    let credit = 0;
    // For suppliers: charge = credit (we owe them more), payment = debit (we paid them)
    if (type === 'charge') credit = amount;
    else if (type === 'payment') debit = amount;
    
    // Calculate new balance
    const { rows: lastRow } = await pool.query('SELECT balance FROM "SupplierLedger" WHERE "supplierId" = $1 ORDER BY id DESC LIMIT 1', [req.params.id]);
    let prevBalance = 0;
    if (lastRow.length > 0) prevBalance = lastRow[0].balance || 0;
    const newBalance = prevBalance + credit - debit;

    const { rows } = await pool.query(
      'INSERT INTO "SupplierLedger" ("supplierId", date, description, debit, credit, balance) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.params.id, date || new Date().toISOString(), description, debit, credit, newBalance]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});


const crypto = require('crypto');
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUsername = (username || '').trim();
    const hashedAttempt = hashPassword(password);
    
    // Check seed fallback if empty
    const { rows: countRows } = await pool.query('SELECT COUNT(*) as total FROM "User"');
    if (parseInt(countRows[0].total) === 0 && cleanUsername === 'admin' && password === 'admin123') {
      await pool.query('INSERT INTO "User" (username, "passwordHash", role) VALUES ($1, $2, $3)', ['admin', hashPassword('admin123'), 'Admin']);
    }

    const { rows } = await pool.query('SELECT * FROM "User" WHERE username ILIKE $1', [cleanUsername]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid username or password' });
    
    const user = rows[0];
    if (!user.isActive) return res.status(403).json({ error: 'User account is disabled' });
    if (user.passwordHash !== hashedAttempt) return res.status(401).json({ error: 'Invalid username or password' });

    await pool.query('UPDATE "User" SET "lastLogin" = $1 WHERE id = $2', [new Date().toISOString(), user.id]);

    const { rows: roleRows } = await pool.query('SELECT * FROM "Role" WHERE name = $1', [user.role]);
    const permissions = roleRows.length > 0 ? roleRows[0].permissions : {};

    res.json({ id: user.id, username: user.username, role: user.role, permissions });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});


// --- ROLES ---
app.get('/api/roles', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM "Role" ORDER BY id ASC');
    res.json(rows);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.post('/api/roles', async (req, res) => {
  try {
    const { name, permissions, isSystem } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO "Role" (name, permissions, "isSystem") VALUES ($1, $2, $3) RETURNING *',
      [name, permissions || {}, isSystem || false]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.put('/api/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions } = req.body;
    await pool.query(
      'UPDATE "Role" SET name = $1, permissions = $2 WHERE id = $3 AND "isSystem" = false',
      [name, permissions, id]
    );
    res.json({ success: true });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.delete('/api/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM "Role" WHERE id = $1 AND "isSystem" = false', [id]);
    res.json({ success: true });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});


app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, username, role, "isActive", "lastLogin", "fullName", "email", "address", "profilePicture", "createdAt" FROM "User" ORDER BY id ASC');
    res.json(rows);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role, isActive, fullName, email, address, profilePicture } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO "User" (username, "passwordHash", role, "isActive", "fullName", "email", "address", "profilePicture") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, username, role, "isActive", "fullName", "email", "address", "profilePicture"',
      [username ? username.trim() : '', hashPassword(password), role, isActive !== false, fullName, email, address, profilePicture]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      try { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); } catch(e) {}
      res.status(500).json({ error: error.message });
    }
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, isActive, fullName, email, address, profilePicture } = req.body;
    if (password) {
      await pool.query(
        'UPDATE "User" SET username = $1, "passwordHash" = $2, role = $3, "isActive" = $4, "fullName" = $5, "email" = $6, "address" = $7, "profilePicture" = $8 WHERE id = $9',
        [username.trim(), hashPassword(password), role, isActive, fullName, email, address, profilePicture, id]
      );
    } else {
      await pool.query(
        'UPDATE "User" SET username = $1, role = $2, "isActive" = $3, "fullName" = $4, "email" = $5, "address" = $6, "profilePicture" = $7 WHERE id = $8',
        [username.trim(), role, isActive, fullName, email, address, profilePicture, id]
      );
    }
    res.json({ success: true });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

// Start the server

// --- Roles Endpoints ---

app.get('/api/roles', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM "Role" ORDER BY id ASC');
    res.json(rows);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.post('/api/roles', async (req, res) => {
  try {
    const { name, permissions } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO "Role" (name, permissions, "isSystem") VALUES ($1, $2, $3) RETURNING *',
      [name, permissions, false]
    );
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.put('/api/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions } = req.body;
    const { rows } = await pool.query(
      'UPDATE "Role" SET name = COALESCE($1, name), permissions = COALESCE($2, permissions) WHERE id = $3 AND "isSystem" = false RETURNING *',
      [name, permissions, id]
    );
    if (rows.length === 0) {
      const sysRows = await pool.query(
         'UPDATE "Role" SET permissions = $1 WHERE id = $2 RETURNING *',
         [permissions, id]
      );
      if (sysRows.rows.length === 0) return res.status(404).json({ error: 'Role not found' });
      return res.json(sysRows.rows[0]);
    }
    res.json(rows[0]);
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

app.delete('/api/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('DELETE FROM "Role" WHERE id = $1 AND "isSystem" = false RETURNING *', [id]);
    if (rows.length === 0) return res.status(400).json({ error: 'Cannot delete system role or role not found' });
    res.json({ success: true });
  } catch (error) { 
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
    }
  }
});

// --- AUDIT LOGS ---
app.get('/api/audit', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 50;
    const search = (req.query.search || '').trim();
    const offset = page * limit;

    let query = 'SELECT * FROM "AuditLog"';
    let countQuery = 'SELECT COUNT(*) as total FROM "AuditLog"';
    let params = [];

    if (search) {
      params.push('%' + search + '%');
      const clause = ' WHERE ("userName" ILIKE $1 OR "action" ILIKE $1 OR "module" ILIKE $1 OR "details" ILIKE $1)';
      query += clause;
      countQuery += clause;
    }

    query += ' ORDER BY id DESC LIMIT ' + limit + ' OFFSET ' + offset;

    const { rows: data } = await pool.query(query, params);
    const { rows: countRes } = await pool.query(countQuery, params);

    res.json({
      data,
      total: Math.max(0, parseInt(countRes[0]?.total || 0)),
      page,
      totalPages: Math.ceil(Math.max(0, parseInt(countRes[0]?.total || 0)) / limit)
    });
  } catch (error) {
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  }
});

app.post('/api/audit', async (req, res) => {
  try {
    const { userId, userName, action, module, details } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO "AuditLog" ("userId", "userName", "action", "module", "details") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId || null, userName || null, action || 'ACTION', module || 'General', details || '']
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    { require('fs').appendFileSync('backend_error.log', new Date().toISOString() + ' ' + error.stack + '\n'); res.status(500).json({ error: error.message }); }
  }
});


app.get('/api/customers/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, 
        COALESCE((SELECT SUM(debit) - SUM(credit) FROM "CustomerLedger" WHERE "customerId" = c.id), 0) as balance,
        COALESCE((SELECT SUM(credit) FROM "CustomerLedger" WHERE "customerId" = c.id), 0) as "totalPaid",
        COALESCE((SELECT SUM(debit) FROM "CustomerLedger" WHERE "customerId" = c.id), 0) as "totalCharged"
      FROM "Customer" c WHERE c.id = $1`, 
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/suppliers/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, 
        COALESCE((SELECT SUM(credit) - SUM(debit) FROM "SupplierLedger" WHERE "supplierId" = s.id), 0) as balance,
        COALESCE((SELECT SUM(debit) FROM "SupplierLedger" WHERE "supplierId" = s.id), 0) as "totalPaid",
        COALESCE((SELECT SUM(credit) FROM "SupplierLedger" WHERE "supplierId" = s.id), 0) as "totalCharged"
      FROM "Supplier" s WHERE s.id = $1`, 
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    res.json(rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

const server = app.listen(PORT, () => {
  console.log('Backend API Server running on http://localhost:' + PORT + ' (PG RAW MODE)');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('PORT 3001 IS ALREADY IN USE! PLEASE CLOSE OTHER BACKEND PROCESSES!');
    // Keep process alive so the user sees the error
    setInterval(() => {}, 100000);
  }
});

setInterval(() => {}, 1000);

setInterval(() => {}, 100000);
