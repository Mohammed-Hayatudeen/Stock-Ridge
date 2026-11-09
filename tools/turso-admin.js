'use strict';
// =====================================================================
// tools/turso-admin.js — TURSO SCHEMA AND READ-ONLY CHECKS
// =====================================================================
// The Worker reads Turso at request time. This tool applies the repository's
// append-only migrations or performs explicit operator-requested checks.
// It has no alternate database source or fallback.
// The token is read from the environment or from .env.deploy. It is never
// printed.
// =====================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createTursoDatabase, splitSql } = require('../worker/src/turso');

const ROOT = path.join(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'schema', 'migrations');

function loadEnvFile() {
  const file = path.join(ROOT, '.env.deploy');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key]) continue;
    const value = raw.replace(/^["']|["']$/g, '');
    if (value) process.env[key] = value;
  }
}

loadEnvFile();

function tursoDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required. Put them in .env.deploy. Do not commit the token.');
  }
  return createTursoDatabase({ url, authToken, name: 'stock2' });
}

function checksum(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex');
}

/**
 * A multi-row INSERT larger than Turso's comfortable request size is split
 * into several INSERTs of the same statement. Quotes and nested parentheses
 * are respected, so a product name that contains a comma stays in its tuple.
 */
function splitLargeInsert(sql, maxBytes = 350000) {
  if (sql.length <= maxBytes) return [sql];
  const valuesAt = sql.search(/\bVALUES\b/i);
  if (valuesAt < 0) return [sql];
  const prefix = sql.slice(0, valuesAt).replace(/\s+$/, '');
  let rest = sql.slice(valuesAt).replace(/^VALUES/i, '').trim().replace(/;\s*$/, '');
  const tuples = [];
  let i = 0;
  while (i < rest.length) {
    while (i < rest.length && /[\s,]/.test(rest[i])) i += 1;
    if (i >= rest.length) break;
    if (rest[i] !== '(') break;
    let depth = 0;
    let state = 'normal';
    const start = i;
    while (i < rest.length) {
      const c = rest[i];
      const n = rest[i + 1];
      if (state === 'sq') {
        if (c === "'" && n === "'") { i += 2; continue; }
        if (c === "'") state = 'normal';
        i += 1;
        continue;
      }
      if (c === "'") { state = 'sq'; i += 1; continue; }
      if (c === '(') depth += 1;
      else if (c === ')') {
        depth -= 1;
        if (depth === 0) { i += 1; break; }
      }
      i += 1;
    }
    tuples.push(rest.slice(start, i));
  }
  if (tuples.length < 2) return [sql];
  const chunks = [];
  let current = [];
  let size = prefix.length + 8;
  for (const tuple of tuples) {
    if (current.length && size + tuple.length + 2 > maxBytes) {
      chunks.push(`${prefix} VALUES\n${current.join(',\n')};`);
      current = [];
      size = prefix.length + 8;
    }
    current.push(tuple);
    size += tuple.length + 2;
  }
  if (current.length) chunks.push(`${prefix} VALUES\n${current.join(',\n')};`);
  return chunks;
}

async function applyTursoMigrations(db = tursoDb()) {
  await db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id          TEXT PRIMARY KEY,
    applied_at  TEXT NOT NULL DEFAULT (datetime('now')),
    checksum    TEXT
  )`);
  const applied = new Map((await db.all('SELECT id, checksum FROM _migrations')).map((r) => [r.id, r.checksum]));
  const renamedFrom = {
    '0002_nigerian_market': '0010_nigerian_market',
    '0003_nafdac_catalog': '0013_nafdac_catalog',
    '0004_mixed_pharmacy_categories': '0014_mixed_pharmacy_categories',
  };
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const result = { applied: [], skipped: [] };
  for (const file of files) {
    const id = file.replace(/\.sql$/, '');
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const sum = checksum(sql);
    const previousId = renamedFrom[id];
    if (!applied.has(id) && previousId && applied.has(previousId)) {
      if (applied.get(previousId) && applied.get(previousId) !== sum) {
        throw new Error(`Migration "${id}" does not match the bytes already applied as "${previousId}". The file was renamed, not edited.`);
      }
      await db.run('UPDATE _migrations SET id = ? WHERE id = ?', [id, previousId]);
      applied.delete(previousId);
      applied.set(id, sum);
    }
    if (applied.has(id)) {
      const squashed = require('../domain/migration-squash').SQUASHED_INTO[id];
      if (applied.get(id) && applied.get(id) !== sum && squashed && squashed.every((part) => applied.has(part))) {
        await db.run('UPDATE _migrations SET checksum = ? WHERE id = ?', [sum, id]);
        for (const part of squashed) {
          await db.run('DELETE FROM _migrations WHERE id = ?', [part]);
          applied.delete(part);
        }
        applied.set(id, sum);
        result.skipped.push(id);
        continue;
      }
      if (applied.get(id) && applied.get(id) !== sum) {
        throw new Error(`Migration "${id}" has CHANGED since it was applied. Never edit an applied migration — add a new one.`);
      }
      result.skipped.push(id);
      continue;
    }
    const statements = splitSql(sql).flatMap((statement) => splitLargeInsert(statement));
    // A table rebuild cannot drop a referenced table while foreign keys are on.
    // The marker is a comment, so it is not itself a statement.
    const rebuild = /turso:\s*foreign_keys\s+off/i.test(sql);
    if (rebuild) {
      const body = statements.filter((statement) => {
        const bare = statement.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '').trim();
        return bare && !/^\s*PRAGMA\b/i.test(bare);
      });
      // Same door as the Node migrator. A drop of branches while a stock view
      // still names it fails the rebuild. Park those views, then put them back.
      const dropsBranches = body.some((statement) => /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?branches\b/i.test(statement));
      let parked = [];
      if (dropsBranches) {
        parked = await db.all("SELECT name, sql FROM sqlite_master WHERE type = 'view' AND sql LIKE '%branches%'");
        parked = (parked || []).filter((view) => view && view.name && view.sql && /\bbranches\b/i.test(view.sql));
        if (parked.length) {
          await db.batch(parked.map((view) => ({ sql: `DROP VIEW IF EXISTS "${String(view.name).replace(/"/g, '')}"` })), { foreignKeys: false, timeoutMs: 60000 });
        }
      }
      process.stdout.write(`      ${id} (rebuild, ${body.length} statement(s), foreign keys off)\n`);
      await db.batch(body.map((statement) => ({ sql: statement })), { foreignKeys: false, timeoutMs: 60000 });
      if (parked.length) {
        await db.batch(parked.map((view) => ({ sql: /;\s*$/.test(view.sql) ? view.sql : `${view.sql};` })), { foreignKeys: false, timeoutMs: 60000 });
      }
    } else {
      process.stdout.write(`      ${id} (${statements.length} statement(s))\n`);
      for (let i = 0; i < statements.length; i += 1) {
        const statement = statements[i];
        const timeoutMs = statement.length > 200000 ? 120000 : 30000;
        await db.pipeline([{ sql: statement }], { timeoutMs });
        if (statements.length > 5 && (i + 1) % 10 === 0) {
          process.stdout.write(`        ${i + 1}/${statements.length}\n`);
        }
      }
    }
    await db.run('INSERT INTO _migrations (id, checksum) VALUES (?, ?)', [id, sum]);
    result.applied.push(id);
  }
  return result;
}

const SKIP_TABLES = new Set([
  '_migrations', 'sqlite_sequence', '__turso_internal_mvcc_meta',
]);

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function counts(db = tursoDb()) {
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const out = [];
  for (const table of tables) {
    if (SKIP_TABLES.has(table.name)) continue;
    const n = await db.scalar(`SELECT COUNT(*) FROM ${quoteIdent(table.name)}`);
    if (Number(n)) out.push({ table: table.name, rows: Number(n) });
  }
  return out;
}

async function main() {
  const command = process.argv[2] || 'migrate';
  const db = tursoDb();
  if (command === 'migrate') {
    const result = await applyTursoMigrations(db);
    console.log(JSON.stringify({ applied: result.applied, skipped: result.skipped.length }));
    return;
  }
  if (command === 'counts') {
    const rows = await counts(db);
    for (const row of rows) console.log(`${row.table}\t${row.rows}`);
    return;
  }
  if (command === 'check' || command === 'probe') {
    const probe = await db.scalar('SELECT 1');
    const migrations = await db.scalar('SELECT COUNT(*) FROM _migrations').catch(() => null);
    console.log(JSON.stringify({ probe, migrations, dialect: db.dialect, location: db.location }));
    return;
  }
  throw new Error(`Unknown command ${command}`);
}

module.exports = { applyTursoMigrations, counts };

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}
