const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/erp_db' });
pool.query('SELECT id, name, category FROM "Product" LIMIT 5').then(res => { console.log(res.rows); process.exit(0); });
