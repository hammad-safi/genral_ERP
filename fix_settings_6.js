const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.jsx', 'utf8');

// There are probably multiple instances of this exact string or similar
content = content.replace(/className=\{h-4 w-4 \}/g, "className=\"h-4 w-4\"");
content = content.replace(/<Download className=\{.*\} strokeWidth=\{2\.5\} \/>/g, '<Download className={h-4 w-4 } strokeWidth={2.5} />');
content = content.replace(/<Upload className=\{.*\} strokeWidth=\{2\.5\} \/>/g, '<Upload className={h-4 w-4 } strokeWidth={2.5} />');

// More direct string replacements
content = content.split('className={h-4 w-4 }').join('className="h-4 w-4"');

fs.writeFileSync('src/pages/Settings.jsx', content);
