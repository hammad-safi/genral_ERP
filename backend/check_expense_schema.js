const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:danger1718@localhost:5432/shop_erp?schema=public' });

async function check() {
  const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Expense'");
  console.log('Expense schema:', r.rows);
  const sample = await pool.query('SELECT * FROM "Expense" LIMIT 1');
  console.log('Sample row:', sample.rows[0]);
  process.exit(0);
}
check();
