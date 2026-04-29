const fs = require('fs');
let content = fs.readFileSync('src/routes/admin.ts', 'utf-8');

// Replace standard callbacks with 'any' types
content = content.replace(/\(t\) =>/g, '(t: any) =>');
content = content.replace(/\(r\) =>/g, '(r: any) =>');
content = content.replace(/\(p\) =>/g, '(p: any) =>');
content = content.replace(/\(s\) =>/g, '(s: any) =>');
content = content.replace(/\(a\) =>/g, '(a: any) =>');

// Replace { order, user } in map
content = content.replace(/\({ order, user }\) =>/g, '({ order, user }: any) =>');

fs.writeFileSync('src/routes/admin.ts', content);
