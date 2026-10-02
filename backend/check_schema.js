const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:danger1718@localhost:5432/shop_erp?schema=public' });

async function checkSchema() {
  const tables = ['Purchase', 'Customer', 'Supplier', 'Expense'];
  for (const table of tables) {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [table]);
    console.log(`\nTable: ${table}`);
    console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  }
  process.exit(0);
}
checkSchema();
