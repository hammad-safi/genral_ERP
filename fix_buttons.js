const fs = require('fs');
let content = fs.readFileSync('src/pages/Sales.jsx', 'utf8');

const oldViewReturn = `                  <button
                    onClick={() =>View</button>
                  <button
                    onClick={() =>Return</button>`;

const newViewReturn = `                  <button
                    onClick={() => setViewSale(sale)}
                    className="text-blue-600 text-xs border border-blue-200 px-2 py-1 rounded hover:bg-blue-50"
                  >
                    View
                  </button>
                  <button
                    onClick={() => returnSale(sale)}
                    className={\`text-sm rounded px-2 py-1 \${sale.returned ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' : 'border border-red-200 text-red-600 hover:bg-red-50'}\`}
                    disabled={sale.returned}
                  >
                    Return
                  </button>`;

content = content.replace(oldViewReturn, newViewReturn);

// Fix Print Sales Report
content = content.replace(/â‰¡Æ’Ã»Â¿ Print Sales Report/g, 'Print Sales Report');
// Fix Print Receipt
content = content.replace(/â‰¡Æ’Ã»Â¿ Print Receipt/g, 'Print Receipt');
// Fix multiply character
content = content.replace(/â”œÃ¹/g, 'x');

fs.writeFileSync('src/pages/Sales.jsx', content, 'utf8');
console.log("Fixed View and Return buttons");
