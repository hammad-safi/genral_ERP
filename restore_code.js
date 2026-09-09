const fs = require('fs');
let content = fs.readFileSync('src/pages/Sales.jsx', 'utf8');

const targetStr = `                <span className="text-xs text-slate-400">
                  {sale.items?.map((item) => item.productName).join(', ')}
                </span>
      </section>`;

const replacementStr = `                <span className="text-xs text-slate-400">
                  {sale.items?.map((item) => item.productName).join(', ')}
                </span>
              </td>
              <td className="py-3 px-4 text-sm">{sale.customerName}</td>
              <td className="py-3 px-4 text-sm font-medium">{formatCurrency(sale.totalAmount, currency)}</td>
              <td className="py-3 px-4">
                <div className="flex gap-2">
                  <button
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
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      </section>`;

// Strip out carriage returns to make matching easier
let normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetStr.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
    normalizedContent = normalizedContent.replace(normalizedTarget, replacementStr.replace(/\r\n/g, '\n'));
    fs.writeFileSync('src/pages/Sales.jsx', normalizedContent, 'utf8');
    console.log("Successfully restored code.");
} else {
    console.log("Could not find target string.");
}
