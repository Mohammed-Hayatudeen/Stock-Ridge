const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');

// Mock all tables so we can prepare statements
const tables = [
  'sales', 'sale_items', 'sale_payments', 'stock_batches', 'products', 'branches', 
  'product_categories', 'users', 'customers', 'till_sessions', 'compliance_reviews',
  'branch_safe_ledger', 'businesses', 'expenses', 'delivery_jobs', 'branch_devices',
  'staff_attendance', 'asset_agreements', 'debtor_ledger'
];
for (const table of tables) {
  try { db.exec(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY)`); } catch(e){}
}

const COUNTS = "s.id = 0 AND s.id <> 0";
const sc = { sql: '', params: [] };
const todaySpan = { sql: 's.id = ?', params: [1] };
const yesterdaySpan = { sql: 's.id = ?', params: [1] };
const periodSpan = { sql: 's.id = ?', params: [1] };
const lowStockClause = '';
const commitmentWhere = '';
const tillWhere = '';

const statements = [
  { sql: `SELECT COUNT(*) AS count,
      COALESCE(SUM(s.total),0) AS gross, COALESCE(SUM(s.vat_amount),0) AS vat,
      COALESCE(SUM(s.balance_due),0) AS outstanding, COALESCE(SUM(s.delivery_fee),0) AS delivery,
      COALESCE(AVG(s.total),0) AS average
    FROM sales s WHERE ${COUNTS} AND ${todaySpan.sql} ${sc.sql}` },
  { sql: `SELECT COUNT(*) AS count, COALESCE(SUM(s.total),0) AS gross
    FROM sales s WHERE ${COUNTS} AND ${yesterdaySpan.sql} ${sc.sql}` },
  { sql: `SELECT COALESCE(SUM(si.cost_price_snapshot * si.quantity_in_base),0) AS cogs
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE si.id = 0 AND ${COUNTS} AND ${todaySpan.sql} ${sc.sql}` },
  { sql: `SELECT COUNT(*) AS count, COALESCE(SUM(s.total),0) AS value
    FROM sales s WHERE s.id = 0 AND s.id = 0 AND ${todaySpan.sql} ${sc.sql}` },
  { sql: `SELECT p.id, COALESCE(SUM(p.id),0) AS amount, COUNT(*) AS count
    FROM sale_payments p JOIN sales s ON s.id = p.id
    WHERE p.id = 0 AND ${COUNTS} AND ${todaySpan.sql} ${sc.sql}
    GROUP BY p.id ORDER BY amount DESC` },
  { sql: `SELECT COUNT(*) AS count, COALESCE(SUM(s.total),0) AS gross,
      COALESCE(SUM(s.vat_amount),0) AS vat, COALESCE(SUM(s.balance_due),0) AS outstanding
    FROM sales s WHERE ${COUNTS} AND ${periodSpan.sql} ${sc.sql}` },
  { sql: `SELECT COALESCE(SUM(si.cost_price_snapshot * si.quantity_in_base),0) AS cogs
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE si.id = 0 AND ${COUNTS} AND ${periodSpan.sql} ${sc.sql}` },
  { sql: `SELECT date(s.id) AS day, COUNT(*) AS count,
      COALESCE(SUM(s.total),0) AS gross, COALESCE(SUM(s.vat_amount),0) AS vat
    FROM sales s WHERE ${COUNTS} AND ${periodSpan.sql} ${sc.sql}
    GROUP BY day ORDER BY day ASC` },
];

for (const stmt of statements) {
  try {
    db.prepare(stmt.sql);
    console.log('OK:', stmt.sql.replace(/\n/g, ' ').slice(0, 50));
  } catch (e) {
    console.error('ERROR in:', stmt.sql);
    console.error(e.message);
  }
}
