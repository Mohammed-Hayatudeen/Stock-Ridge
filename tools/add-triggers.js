// PROTOCOL: Always reference the agent.md file before any further fix on this page.
const fs = require('fs');

const file = 'schema/migrations/0001_schema.sql';
let sql = fs.readFileSync(file, 'utf8');

const tables = [
  'expenses',
  'delivery_vehicles',
  'stock_transfers',
  'stock_transfer_items',
  'stocktake_sessions',
  'stocktake_lines',
  'asset_agreements',
  'asset_agreement_lines',
  'warranty_claims'
];

for (const table of tables) {
  if (sql.indexOf(`trg_rev_${table}_ins`) === -1) {
    sql += `
CREATE TRIGGER IF NOT EXISTS trg_rev_${table}_ins
AFTER INSERT ON ${table}
BEGIN
  INSERT INTO sync_revisions (table_name, revision, updated_at)
  VALUES ('${table}', 1, datetime('now'))
  ON CONFLICT(table_name) DO UPDATE SET
    revision = revision + 1,
    updated_at = datetime('now');
END;

CREATE TRIGGER IF NOT EXISTS trg_rev_${table}_upd
AFTER UPDATE ON ${table}
BEGIN
  INSERT INTO sync_revisions (table_name, revision, updated_at)
  VALUES ('${table}', 1, datetime('now'))
  ON CONFLICT(table_name) DO UPDATE SET
    revision = revision + 1,
    updated_at = datetime('now');
END;

CREATE TRIGGER IF NOT EXISTS trg_rev_${table}_del
AFTER DELETE ON ${table}
BEGIN
  INSERT INTO sync_revisions (table_name, revision, updated_at)
  VALUES ('${table}', 1, datetime('now'))
  ON CONFLICT(table_name) DO UPDATE SET
    revision = revision + 1,
    updated_at = datetime('now');
END;
`;
  }
}

fs.writeFileSync(file, sql);
