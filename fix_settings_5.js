const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.jsx', 'utf8');

// Use precise substring matching instead of Regex due to escaping issues
content = content.replace("<Download className={h-4 w-4 } strokeWidth={2.5} />", "<Download className={h-4 w-4 } strokeWidth={2.5} />");
content = content.replace("<Upload className={h-4 w-4 } strokeWidth={2.5} />", "<Upload className={h-4 w-4 } strokeWidth={2.5} />");

// In case the space is different
content = content.replace("className={h-4 w-4 }", "className={h-4 w-4 }");
content = content.replace("className={h-4 w-4 }", "className={h-4 w-4 }");

fs.writeFileSync('src/pages/Settings.jsx', content);
