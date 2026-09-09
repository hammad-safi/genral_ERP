const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.jsx', 'utf8');

// Fix the template literals that lost their backticks
content = content.replace(/<Download className={h-4 w-4 } strokeWidth={2.5} \/>/g, '<Download className={h-4 w-4 } strokeWidth={2.5} />');
content = content.replace(/<Upload className={h-4 w-4 } strokeWidth={2.5} \/>/g, '<Upload className={h-4 w-4 } strokeWidth={2.5} />');
content = content.replace(/importMessage\.type === 'success' \? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'/g, 'importMessage.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"');
content = content.replace(/className={mt-4 p-3 rounded-lg flex items-center gap-2 text-xs font-bold/g, 'className={mt-4 p-3 rounded-lg flex items-center gap-2 text-xs font-bold }');

fs.writeFileSync('src/pages/Settings.jsx', content);
