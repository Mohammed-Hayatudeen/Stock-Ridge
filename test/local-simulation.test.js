'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
let migratedDatabase = null;
try { ({ migratedDatabase } = require('./helpers/sqlite-db')); } catch (error) { /* CI installs native wrappers without build scripts. */ }
const nativeOptions = migratedDatabase ? {} : { skip: 'native SQLite is unavailable in this runtime' };

test('local simulation adapter applies immutable schema and commits collector transactions', nativeOptions, async () => {
  const db = await migratedDatabase(':memory:', { now: '2025-06-01 12:00:00' });
  try {
    await db.transaction(async (tx) => {
      tx.queue("INSERT INTO businesses (id,name,created_at,updated_at) VALUES (?,?,datetime('now'),datetime('now'))", [tx.idFor('business'), 'Simulation']);
    });
    const row = await db.first('SELECT name,created_at FROM businesses');
    assert.equal(row.name, 'Simulation');
    assert.equal(row.created_at, '2025-06-01 12:00:00');
    assert.equal(await db.scalar('PRAGMA integrity_check'), 'ok');
    assert.deepEqual(await db.all('PRAGMA foreign_key_check'), []);
  } finally { await db.close(); }
});

test('local simulation collector rolls back all statements on constraint failure', nativeOptions, async () => {
  const db = await migratedDatabase(':memory:');
  try {
    await assert.rejects(db.transaction(async (tx) => {
      tx.queue("INSERT INTO businesses (id,name) VALUES ('same','First')");
      tx.queue("INSERT INTO businesses (id,name) VALUES ('same','Duplicate')");
    }), /UNIQUE constraint/);
    assert.equal(await db.scalar("SELECT COUNT(*) FROM businesses WHERE id='same'"), 0);
  } finally { await db.close(); }
});
