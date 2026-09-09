const fs = require('fs');
let content = fs.readFileSync('src/pages/Products.jsx', 'utf8');

const descRegex = /\{\/\* Description \*\/\}(.|\n)*?<\/label>/;
const match = content.match(descRegex);
if (!match) {
  console.log('Description block not found');
  process.exit(1);
}

content = content.replace(match[0], '');

const targetStr = '            </div>\n          </div>\n            \n          <div className="col-span-full';
content = content.replace(targetStr, '              \n              ' + match[0] + '\n            </div>\n          </div>\n            \n          <div className="col-span-full');

fs.writeFileSync('src/pages/Products.jsx', content);
