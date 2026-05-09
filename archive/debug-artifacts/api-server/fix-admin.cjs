const fs = require('fs');
let content = fs.readFileSync('src/routes/admin.ts', 'utf-8');
content = content.replace(/parseInt\(req\.params\.id, 10\)/g, 'parseInt(req.params.id as string, 10)');
content = content.replace(/tx =>/g, 'tx: any =>');
content = content.replace(/\(tx\) =>/g, '(tx: any) =>');
fs.writeFileSync('src/routes/admin.ts', content);
