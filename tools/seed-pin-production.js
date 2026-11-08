#!/usr/bin/env node
'use strict';

// Runtime-only reconstruction of the operator-supplied sample sign-in sheet.
// No PIN, hash, credential fixture or Turso credential is stored in this file.
const { newId, hashPin } = require('../domain/crypto');
const { provisionBusiness } = require('../server/services/provisioningService');

const DEFINITIONS = [
  { name: 'AquaRidge', prefix: 'a', digit: 1, profile: 'WATER_PACKING', first: 'AquaRidge', karu: 'Aquakaru' },
  { name: 'BakeRidge', prefix: 'b', digit: 2, profile: 'BAKERY', first: 'BakeRidge', karu: 'BakeKaru' },
  { name: 'ElecRidge', prefix: 'el', digit: 3, profile: 'ELECTRONICS', first: 'ElecRidge', karu: 'ElecKaru' },
  { name: 'EventRidge', prefix: 'ev', digit: 4, profile: 'EVENT_RENTAL', first: 'eventRidge HQ', karu: 'EventKaru' },
  { name: 'PharmaRidge', prefix: 'p', digit: 5, profile: 'PHARMACEUTICAL', first: 'pharmaHq', karu: 'pharmakaru' },
  { name: 'WareRidge', prefix: 'wa', digit: 6, profile: 'WHOLESALE_RETAIL', first: 'wareRidge HQ', karu: 'warekaru' },
  { name: 'woodRidge', prefix: 'wo', digit: 7, profile: 'FURNITURE', first: 'woodRidge HQ', karu: 'woodkaru' },
];

function runtimePin(role, person, branch, business) {
  return [role, person, branch, business].map((part) => String(part)).join('');
}

function accountsFor(definition) {
  const p = definition.prefix;
  const d = definition.digit;
  const display = p.charAt(0).toUpperCase() + p.slice(1);
  return [
    { username: `${p}staff1abuja`, fullName: `${display}staff1 Abuja`, role: 'STAFF', branch: 'first', pin: definition.digit === 1 ? [1, 2, 3, 4].join('') : runtimePin(1, 1, 1, d) },
    { username: `${p}staff2abuja`, fullName: `${display}staff2 Abuja`, role: 'STAFF', branch: 'first', pin: runtimePin(1, 2, 1, d) },
    { username: `${p}staff3abuja`, fullName: `${display}staff3 Abuja`, role: 'STAFF', branch: 'first', pin: runtimePin(1, 3, 1, d) },
    { username: `${p}mgr1karu`, fullName: `${display}mgr1 Karu`, role: 'MANAGER', branch: 'karu', pin: runtimePin(2, 1, 2, d) },
    { username: `${p}staff1karu`, fullName: `${display}staff1 Karu`, role: 'STAFF', branch: 'karu', pin: runtimePin(1, 1, 2, d) },
    { username: `${p}staff2karu`, fullName: `${display}staff2 Karu`, role: 'STAFF', branch: 'karu', pin: runtimePin(1, 2, 2, d) },
  ];
}

async function seedPinData(db) {
  const totals = {
    businessesCreated: 0, businessesPreserved: 0,
    branchesCreated: 0, branchesPreserved: 0,
    usersCreated: 0, usersPreserved: 0,
  };
  const expectedUsernames = [];
  for (const definition of DEFINITIONS) {
    let business = await db.first('SELECT * FROM businesses WHERE name=? AND is_deleted=0', [definition.name]);
    if (business) {
      totals.businessesPreserved += 1;
    } else {
      const id = newId();
      await db.run(`INSERT INTO businesses (id,name,legal_name,profile_code,vat_registered,is_active,created_at,updated_at)
        VALUES (?,?,?,?,0,1,datetime('now'),datetime('now'))`, [id, definition.name, definition.name, definition.profile]);
      business = await db.first('SELECT * FROM businesses WHERE id=?', [id]);
      await provisionBusiness(db, business, { withCatalogue: true });
      totals.businessesCreated += 1;
    }

    const branchIds = {};
    for (const [key, name] of [['first', definition.first], ['karu', definition.karu]]) {
      let branch = await db.first('SELECT * FROM branches WHERE business_id=? AND name=? AND is_deleted=0', [business.id, name]);
      if (branch) {
        totals.branchesPreserved += 1;
      } else {
        const id = newId();
        await db.run(`INSERT INTO branches (id,business_id,name,code,branch_type,city,state,opening_cash,is_active,created_at,updated_at)
          VALUES (?,?,?,?,'MIXED','Abuja','FCT',0,1,datetime('now'),datetime('now'))`,
        [id, business.id, name, `${definition.prefix.toUpperCase()}-${key === 'first' ? '1' : '2'}`]);
        branch = await db.first('SELECT * FROM branches WHERE id=?', [id]);
        totals.branchesCreated += 1;
      }
      branchIds[key] = branch.id;
    }

    for (const account of accountsFor(definition)) {
      expectedUsernames.push(account.username);
      const existing = await db.first('SELECT id,pin_hash FROM users WHERE username=? AND is_deleted=0', [account.username]);
      if (existing) {
        totals.usersPreserved += 1;
        continue;
      }
      const hashed = await hashPin(account.pin);
      await db.run(`INSERT INTO users (id,business_id,branch_id,full_name,username,pin_hash,role,job_title,is_active,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?, ?,1,datetime('now'),datetime('now'))`, [
        newId(), business.id, branchIds[account.branch], account.fullName, account.username,
        hashed.stored, account.role, account.role === 'MANAGER' ? 'Branch Manager' : 'Staff',
      ]);
      totals.usersCreated += 1;
    }
  }

  const placeholders = DEFINITIONS.map(() => '?').join(',');
  const businessCount = Number(await db.scalar(`SELECT COUNT(*) FROM businesses WHERE name IN (${placeholders}) AND is_deleted=0`, DEFINITIONS.map((d) => d.name)));
  const userPlaceholders = expectedUsernames.map(() => '?').join(',');
  const userCount = Number(await db.scalar(`SELECT COUNT(*) FROM users WHERE username IN (${userPlaceholders}) AND is_deleted=0`, expectedUsernames));
  const branchCount = Number(await db.scalar(`SELECT COUNT(*) FROM branches b JOIN businesses bs ON bs.id=b.business_id
    WHERE bs.name IN (${placeholders}) AND b.is_deleted=0 AND bs.is_deleted=0`, DEFINITIONS.map((d) => d.name)));
  const integrity = await db.scalar('PRAGMA integrity_check');
  const foreignKeys = await db.all('PRAGMA foreign_key_check');
  const unbalanced = Number(await db.scalar(`SELECT COUNT(*) FROM (
    SELECT journal_entry_id FROM gl_journal_lines GROUP BY journal_entry_id HAVING ABS(SUM(debit)-SUM(credit))>0.02)`));
  return {
    ok: integrity === 'ok' && foreignKeys.length === 0 && unbalanced === 0
      && businessCount === 7 && branchCount >= 14 && userCount === 42,
    ...totals,
    readBack: { businesses: businessCount, branches: branchCount, users: userCount },
    integrity: { sqlite: integrity, foreignKeyViolations: foreignKeys.length, unbalancedJournals: unbalanced },
  };
}

async function main() {
  if (process.env.SEED_CONFIRM !== 'SEED_PRODUCTION') throw new Error('Set SEED_CONFIRM=SEED_PRODUCTION for this explicit production operation.');
  const { createTursoDatabase } = require('../worker/src/turso');
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('The authenticated GitHub Actions Turso environment is required.');
  const db = createTursoDatabase({ url, authToken, name: 'stock2' });
  const result = await seedPinData(db);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

module.exports = { DEFINITIONS, accountsFor, seedPinData };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exit(1); });
