const fs = require('fs');
let content = fs.readFileSync('server/routes/sync.js', 'utf8');

const readBatchFunc = `
async function readBatch(db, statements) {
  const list = statements || [];
  if (!list.length) return [];
  if (typeof db.readBatch === 'function') return db.readBatch(list);
  const rows = [];
  for (const statement of list) rows.push(await db.all(statement.sql, statement.params));
  return rows;
}
`;

if (!content.includes('async function readBatch')) {
    content = content.replace('function stockScope(', readBatchFunc + '\nfunction stockScope(');
}

// Now replace the sequential query loop with batching
// This requires careful replacement. Let's find the loop.
const loopStart = `    let stockGate = null;`;
const newLoopStart = `    let stockGate = null;
    const needsStockGate = requested.some((t) => PULLABLE[t] && PULLABLE[t].onStock);
    if (needsStockGate) {
      const held = stockScope(scope, { includeAllBusinesses, includeAllBranches, biz, branch });
      const hit = await db.first(
        \`SELECT 1 AS ok FROM stock_batches WHERE \${held.where.join(' AND ')} LIMIT 1\`,
        held.params,
      );
      stockGate = { any: Boolean(hit), held };
    }

    const statements = [];
    const tableOrder = [];`;

content = content.replace(loopStart, newLoopStart);

// We need to modify the stockGate block inside the loop
const oldStockGateBlock = `      if (spec.onStock) {
        if (!stockGate) {
          const held = stockScope(scope, { includeAllBusinesses, includeAllBranches, biz, branch });
          const hit = await db.first(
            \`SELECT 1 AS ok FROM stock_batches WHERE \${held.where.join(' AND ')} LIMIT 1\`,
            held.params,
          );
          stockGate = { any: Boolean(hit), held };
        }
        if (!stockGate.any) {
          out[table] = { rows: [], count: 0, truncated: false };
          continue;
        }
      }`;
const newStockGateBlock = `      if (spec.onStock) {
        if (!stockGate || !stockGate.any) {
          out[table] = { rows: [], count: 0, truncated: false };
          continue;
        }
      }`;
content = content.replace(oldStockGateBlock, newStockGateBlock);

// Replace db.all inside the loop
const oldQueryBlock = `      let rows;
      try {
        rows = await db.all(\`SELECT \${cols} FROM \${table} WHERE \${where.join(' AND ')} ORDER BY \${order} LIMIT ?\`, [...params, tableLimit]);
      } catch (e) {
        out[table] = { error: e.message, rows: [] };
        continue;
      }
      if (table === 'stock_batches' && rows.length) rows = await attachStockProductNames(db, rows);
      out[table] = { rows, count: rows.length, truncated: rows.length >= tableLimit };
      totalRows += rows.length;`;

const newQueryBlock = `      const sql = \`SELECT \${cols} FROM \${table} WHERE \${where.join(' AND ')} ORDER BY \${order} LIMIT ?\`;
      statements.push({ sql, params: [...params, tableLimit] });
      tableOrder.push({ table, tableLimit });`;

content = content.replace(oldQueryBlock, newQueryBlock);

// Insert batch execution after the loop
const afterLoop = `    // client_settings is a single global row`;
const batchExecution = `    let batchResults = [];
    if (statements.length > 0) {
      try {
        batchResults = await readBatch(db, statements);
      } catch (e) {
        throw new Error('Sync batch read failed: ' + e.message);
      }
      for (let i = 0; i < tableOrder.length; i++) {
        const { table, tableLimit } = tableOrder[i];
        let rows = batchResults[i] || [];
        if (table === 'stock_batches' && rows.length) rows = await attachStockProductNames(db, rows);
        out[table] = { rows, count: rows.length, truncated: rows.length >= tableLimit };
        totalRows += rows.length;
      }
    }

    // client_settings is a single global row`;
content = content.replace(afterLoop, batchExecution);

fs.writeFileSync('server/routes/sync.js', content);
console.log('patched server/routes/sync.js');
