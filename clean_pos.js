const fs = require('fs');
let content = fs.readFileSync('src/pages/POS.jsx', 'utf8');

// Remove Recent Sales Section
content = content.replace(/<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">[\s\S]*?<\/section>/, '');

// Remove viewSale modal
content = content.replace(/{viewSale && \([\s\S]*?<\/div>\n      \)}/, '');

// Remove sales report hidden div
content = content.replace(/{\/\* Hidden Sales Report for Printing \*\/}[\s\S]*?<\/div>\n      <\/div>/, '');

// Remove BulkDeleteBar
content = content.replace(/<BulkDeleteBar[\s\S]*?\/>/, '');

// Remove confirmBulkDelete modal
content = content.replace(/<ConfirmDialog\s+open={confirmBulkDelete}[\s\S]*?\/>/, '');

// Remove confirmReturnSale modal
content = content.replace(/<ConfirmDialog\s+open={confirmReturnSale}[\s\S]*?\/>/, '');

// Remove returnAlreadyProcessedMessage modal
content = content.replace(/<ConfirmDialog\s+open={!!returnAlreadyProcessedMessage}[\s\S]*?\/>/, '');

// Remove returnSuccessMessage
content = content.replace(/{returnSuccessMessage && \([\s\S]*?<\/div>\n      \)}/, '');

fs.writeFileSync('src/pages/POS.jsx', content);
