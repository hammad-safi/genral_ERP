const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:danger1718@localhost:5432/shop_erp?schema=public' });

async function testStats() {
  const start = Date.now();
  const { rows } = await pool.query(`
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
  console.log('Stats:', rows[0], 'took', Date.now() - start, 'ms');
  process.exit(0);
}
testStats();
