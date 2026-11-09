'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3-multiple-ciphers');
const { newId } = require('../../domain/crypto');

/** Async facade over local SQLite matching the Worker storage contract. */
class LocalDatabase {
  constructor(file = ':memory:', { now = null } = {}) {
    this.handle = new Database(file);
    this.handle.pragma('foreign_keys = ON');
    this.handle.pragma('busy_timeout = 5000');
    this.now = now;
    this.dialect = 'sqlite';
  }

  sqlAtClock(sql) {
    if (!this.now) return sql;
    const clock = typeof this.now === 'function' ? this.now() : this.now;
    if (!clock) return sql;
    const stamp = String(clock).replace('T', ' ').slice(0, 19);
    return String(sql)
      .replace(/\b(datetime|date|julianday|unixepoch)\('now'/g, `$1('${stamp}'`)
      .replace(/CURRENT_TIMESTAMP/g, `'${stamp}'`);
  }

  async run(sql, params = []) {
    try {
      const result = this.handle.prepare(this.sqlAtClock(sql)).run(...params);
      return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
    } catch (error) {
      error.message += ` [SQL: ${String(sql).slice(0, 240)}]`;
      throw error;
    }
  }

  async all(sql, params = []) {
    return this.handle.prepare(this.sqlAtClock(sql)).all(...params);
  }

  async first(sql, params = []) {
    return this.handle.prepare(this.sqlAtClock(sql)).get(...params) || null;
  }

  async scalar(sql, params = []) {
    const row = await this.first(sql, params);
    if (!row) return null;
    const keys = Object.keys(row);
    return keys.length ? row[keys[0]] : null;
  }

  async transaction(callback) {
    const statements = [];
    const ids = new Map();
    const tx = {
      queue(sql, params = []) { statements.push({ sql, params }); },
      idFor(key) {
        if (!ids.has(key)) ids.set(key, newId());
        return ids.get(key);
      },
      peek(key) { return ids.get(key); },
    };
    const result = await callback(tx);
    this.handle.transaction(() => {
      for (const statement of statements) {
        this.handle.prepare(this.sqlAtClock(statement.sql)).run(...statement.params);
      }
    })();
    return result;
  }

  async close() { this.handle.close(); }
}

async function migratedDatabase(file = ':memory:', options = {}) {
  const db = new LocalDatabase(file, options);
  const migrations = path.resolve(__dirname, '../../schema/migrations');
  for (const name of fs.readdirSync(migrations).filter((n) => n.endsWith('.sql')).sort()) {
    db.handle.exec(fs.readFileSync(path.join(migrations, name), 'utf8'));
  }
  return db;
}

module.exports = { LocalDatabase, migratedDatabase };
