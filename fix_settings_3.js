const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.jsx', 'utf8');

// The replacement script missed this because the backslash was likely interpreted incorrectly.
// Let's use string operations.
content = content.replace("<Download className={h-4 w-4 } strokeWidth={2.5} />", "<Download className={h-4 w-4 } strokeWidth={2.5} />");
content = content.replace("<Upload className={h-4 w-4 } strokeWidth={2.5} />", "<Upload className={h-4 w-4 } strokeWidth={2.5} />");

fs.writeFileSync('src/pages/Settings.jsx', content);
