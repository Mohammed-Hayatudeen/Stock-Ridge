const fs = require('fs');
const syncJs = fs.readFileSync('public/js/sync.js', 'utf8');
const pullTables = syncJs.match(/const PULL_TABLES = \[\s*([^\]]+)\]/)[1]
  .replace(/['\s\n,]+/g, ' ')
  .trim()
  .split(' ');

const views = fs.readdirSync('public/js/views');
const storeTables = new Set();
for (const view of views) {
  if (!view.endsWith('.js')) continue;
  const content = fs.readFileSync(`public/js/views/${view}`, 'utf8');
  const matches = [...content.matchAll(/store\.all\('([^']+)'/g)];
  for (const match of matches) storeTables.add(match[1]);
}

for (const t of storeTables) {
  if (!pullTables.includes(t)) console.log('Missing from PULL_TABLES:', t);
}
