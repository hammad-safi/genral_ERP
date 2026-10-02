const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.xgtfbcsdofunsvdxpvks:Danger%401718hammad@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres'
});

async function applyIndexes() {
  const client = await pool.connect();
  try {
    console.log('Applying database indexes to Supabase...');

    const indexes = [
      `CREATE INDEX IF NOT EXISTS "idx_sale_date" ON "Sale"("date" DESC)`,
      `CREATE INDEX IF NOT EXISTS "idx_sale_customer_id" ON "Sale"("customerId")`,
      `CREATE INDEX IF NOT EXISTS "idx_purchase_date" ON "Purchase"("date" DESC)`,
      `CREATE INDEX IF NOT EXISTS "idx_purchase_supplier_id" ON "Purchase"("supplierId")`,
      `CREATE INDEX IF NOT EXISTS "idx_customer_ledger_cust_date" ON "CustomerLedger"("customerId", "date")`,
      `CREATE INDEX IF NOT EXISTS "idx_supplier_ledger_supp_date" ON "SupplierLedger"("supplierId", "date")`,
      `CREATE INDEX IF NOT EXISTS "idx_expense_date" ON "Expense"("date")`,
      `CREATE INDEX IF NOT EXISTS "idx_product_batch_prod_id" ON "ProductBatch"("productId")`,
      `CREATE INDEX IF NOT EXISTS "idx_price_history_prod_id" ON "PriceHistory"("productId")`,
      `CREATE INDEX IF NOT EXISTS "idx_customer_name" ON "Customer"("name")`,
      `CREATE INDEX IF NOT EXISTS "idx_supplier_name" ON "Supplier"("name")`
    ];

    for (const sql of indexes) {
      const t0 = Date.now();
      await client.query(sql);
      console.log(`Executed: ${sql} (${Date.now() - t0}ms)`);
    }

    console.log('All indexes created successfully!');
  } catch (err) {
    console.error('Error applying indexes:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

applyIndexes();
