const fs = require('fs');
let content = fs.readFileSync('src/pages/Sales.jsx', 'utf8');

// Remove POS container - it's the big flex container before the section
const startStr = '<div className="flex bg-slate-100 rounded-xl overflow-hidden shadow-sm border border-slate-200 mb-6"';
const sectionStr = '<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">';

const startIndex = content.indexOf(startStr);
const sectionIndex = content.indexOf(sectionStr);

if (startIndex !== -1 && sectionIndex !== -1) {
    // Remove the POS UI
    content = content.substring(0, startIndex) + content.substring(sectionIndex);
    fs.writeFileSync('src/pages/Sales.jsx', content);
}
