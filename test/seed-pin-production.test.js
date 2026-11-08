'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
let migratedDatabase = null;
try { ({ migratedDatabase } = require('./helpers/sqlite-db')); } catch (error) { /* Native wrappers are not built in CI. */ }
const nativeOptions = migratedDatabase ? {} : { skip: 'native SQLite is unavailable in this runtime' };
const { DEFINITIONS, accountsFor, seedPinData } = require('../tools/seed-pin-production');

test('PDF runtime fixture has seven businesses and forty-two unique non-persisted accounts', () => {
  const accounts = DEFINITIONS.flatMap(accountsFor);
  assert.equal(DEFINITIONS.length, 7);
  assert.equal(accounts.length, 42);
  assert.equal(new Set(accounts.map((a) => a.username)).size, 42);
  for (const account of accounts) assert.match(account.pin, /^\d{4}$/);
});

test('production seed is idempotent and preserves an existing account PIN', nativeOptions, async () => {
  const db = await migratedDatabase(':memory:');
  try {
    await db.run(`INSERT INTO users (id,full_name,username,pin_hash,role,is_active)
      VALUES ('sentinel','Existing user','astaff1abuja','preserved-pin-hash','STAFF',1)`);
    const first = await seedPinData(db);
    const second = await seedPinData(db);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.deepEqual(second.readBack, { businesses: 7, branches: 14, users: 42 });
    assert.equal(second.businessesCreated, 0);
    assert.equal(second.branchesCreated, 0);
    assert.equal(second.usersCreated, 0);
    assert.equal(second.businessesPreserved, 7);
    assert.equal(second.branchesPreserved, 14);
    assert.equal(second.usersPreserved, 42);
    assert.equal(await db.scalar("SELECT pin_hash FROM users WHERE username='astaff1abuja'"), 'preserved-pin-hash');
    assert.equal(await db.scalar('PRAGMA integrity_check'), 'ok');
    assert.deepEqual(await db.all('PRAGMA foreign_key_check'), []);
  } finally { await db.close(); }
});
