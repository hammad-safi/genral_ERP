require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.xgtfbcsdofunsvdxpvks:Danger%401718hammad@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Creating indexes on Supabase...');
  await pool.query('CREATE INDEX IF NOT EXISTS "idx_inventory_product_id" ON "Inventory"("productId")');
  await pool.query('CREATE INDEX IF NOT EXISTS "idx_inventory_quantity" ON "Inventory"("quantity")');
  await pool.query('CREATE INDEX IF NOT EXISTS "idx_product_barcode" ON "Product"("barcode")');
  await pool.query('CREATE INDEX IF NOT EXISTS "idx_product_category" ON "Product"("category")');
  await pool.query('CREATE INDEX IF NOT EXISTS "idx_product_name" ON "Product"("name")');
  console.log('INDEXES CREATED SUCCESSFULLY!');
  process.exit(0);
}

run().catch(e => {
  console.error('Index Error:', e);
  process.exit(1);
});
