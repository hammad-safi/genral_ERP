const db = require('./db');
db.query('SELECT COUNT(p.*) as total FROM "Product" p WHERE p."category" IN ($1)', ['10'])
  .then(res => { console.log("Category 10 count:", res.rows[0].total); })
  .then(() => db.query('SELECT COUNT(p.*) as total FROM "Product" p WHERE p."category" IN ($1)', ['abc']))
  .then(res => { console.log("Category abc count:", res.rows[0].total); process.exit(0); });
