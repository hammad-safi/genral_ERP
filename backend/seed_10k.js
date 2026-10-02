const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:danger1718@localhost:5432/shop_erp?schema=public' });

async function seedData() {
  try {
    console.log("Seeding Customers...");
    await pool.query(`
      INSERT INTO "Customer" (name, phone, email, address, balance)
      SELECT 
        'Dummy Customer ' || (currval(pg_get_serial_sequence('"Customer"', 'id')) + seq),
        '555-' || LPAD((seq % 10000)::text, 4, '0'),
        'customer' || seq || '@example.com',
        '123 Dummy St, City ' || (seq % 100),
        ROUND((random() * 1000)::numeric, 2)
      FROM generate_series(1, 10000) seq;
    `).catch(async (e) => {
      // Fallback if sequence fails
      await pool.query(`
        INSERT INTO "Customer" (name, phone, email, address, balance)
        SELECT 
          'Dummy Customer ' || seq,
          '555-' || LPAD((seq % 10000)::text, 4, '0'),
          'customer' || seq || '@example.com',
          '123 Dummy St, City ' || (seq % 100),
          ROUND((random() * 1000)::numeric, 2)
        FROM generate_series(1, 10000) seq;
      `);
    });

    console.log("Seeding Suppliers...");
    await pool.query(`
      INSERT INTO "Supplier" (name, phone, email, address, "createdAt", balance)
      SELECT 
        'Dummy Supplier ' || seq,
        '555-SUP-' || LPAD((seq % 1000)::text, 4, '0'),
        'supplier' || seq || '@example.com',
        '456 Supplier Ave, City ' || (seq % 100),
        NOW() - (random() * interval '365 days'),
        ROUND((random() * 5000)::numeric, 2)
      FROM generate_series(1, 10000) seq;
    `);

    console.log("Seeding Expenses...");
    await pool.query(`
      INSERT INTO "Expense" (date, amount, description, category, "createdAt")
      SELECT 
        to_char(NOW() - (random() * interval '365 days'), 'YYYY-MM-DD'),
        ROUND((random() * 500 + 10)::numeric, 2),
        'Dummy Expense ' || seq,
        (ARRAY['Office Supplies', 'Utilities', 'Maintenance', 'Marketing'])[floor(random()*4)+1],
        NOW() - (random() * interval '365 days')
      FROM generate_series(1, 10000) seq;
    `);

    console.log("Seeding Purchases...");
    await pool.query(`
      INSERT INTO "Purchase" ("supplierId", "supplierName", date, "amountPaid", discount, tax, "totalAmount", items, "createdAt")
      SELECT 
        (seq % 100) + 1,
        'Dummy Supplier ' || ((seq % 100) + 1),
        to_char(NOW() - (random() * interval '365 days'), 'YYYY-MM-DD'),
        ROUND((random() * 1000)::numeric, 2),
        ROUND((random() * 50)::numeric, 2),
        ROUND((random() * 100)::numeric, 2),
        ROUND((random() * 1000 + 150)::numeric, 2),
        '[{"id":1,"name":"Dummy Product","price":10,"quantity":1,"total":10}]'::jsonb,
        NOW() - (random() * interval '365 days')
      FROM generate_series(1, 10000) seq;
    `);

    console.log("Successfully seeded 10,000 records to Customer, Supplier, Expense, and Purchase tables!");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding data:", err);
    process.exit(1);
  }
}

seedData();
