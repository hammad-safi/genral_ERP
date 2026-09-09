const fs = require('fs');

const contentFile = fs.readFileSync('scratch/replace_reports.js', 'utf-8');
const match = contentFile.indexOf('const content = `');
const matchEnd = contentFile.lastIndexOf('`;\n\nconst fileStr');

if (match !== -1 && matchEnd !== -1) {
  const content = contentFile.slice(match + 17, matchEnd);
  
  const fileStr = fs.readFileSync('src/pages/Reports.jsx', 'utf-8');
  const lines = fileStr.split('\n');
  
  let index = -1;
  for(let i=lines.length-1; i>=0; i--) {
    if(lines[i].includes('return (')) { index = i; break; }
  }
  
  if (index !== -1) {
    const newStr = lines.slice(0, index).join('\n') + '\n' + content;
    fs.writeFileSync('src/pages/Reports.jsx', newStr);
    console.log('Success, replaced from line ' + index);
  } else {
    console.log('return ( not found');
  }
} else {
  console.log('Could not slice content');
}
