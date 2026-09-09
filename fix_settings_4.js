const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.jsx', 'utf8');

// Find all occurrences of the broken classnames and fix them
content = content.replace(/className=\{h-4 w-4 \}/g, "className={h-4 w-4 }");

fs.writeFileSync('src/pages/Settings.jsx', content);
