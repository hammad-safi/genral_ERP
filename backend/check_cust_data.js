const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:danger1718@localhost:5432/shop_erp?schema=public' });

async function check() {
  const c = await pool.query('SELECT COUNT(*) as count, SUM(balance) as sum_bal FROM "Customer"');
  console.log('Customer table:', c.rows);
  const l = await pool.query('SELECT COUNT(*) as count, SUM(debit) as deb, SUM(credit) as cred FROM "CustomerLedger"');
  console.log('CustomerLedger table:', l.rows);
  const sample = await pool.query('SELECT * FROM "Customer" ORDER BY id DESC LIMIT 3');
  console.log('Customer sample:', sample.rows);
  process.exit(0);
}
check();
