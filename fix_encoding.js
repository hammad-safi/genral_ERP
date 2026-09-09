const fs = require('fs');
let content = fs.readFileSync('src/pages/Sales.jsx', 'utf8');

content = content.replace('className="w-[380px] bg-white flex flex-col shrink-0"', 'className="w-[450px] bg-white flex flex-col shrink-0"');

// Fix minus sign
content = content.replace(/transition-colors">.*?<\/button>\s*<input/g, 'transition-colors">-</button>\n                      <input');

// Fix View text (match anything before "View" inside the button)
content = content.replace(/>[^<]*?View\s*<\/button>/g, '>View</button>');

// Fix Return text
content = content.replace(/>[^<]*?Return\s*<\/button>/g, '>Return</button>');

// Fix Make Return text
content = content.replace(/'[^']*?Make Return'/g, "'Make Return'");

fs.writeFileSync('src/pages/Sales.jsx', content, 'utf8');
console.log("Patched successfully");
