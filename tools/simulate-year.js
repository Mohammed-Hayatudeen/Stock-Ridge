#!/usr/bin/env node
'use strict';

// Local-only deterministic operational simulation. Fixture JSON arrives on
// stdin so source documents and credentials never become repository fixtures.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { migratedDatabase } = require('../test/helpers/sqlite-db');
const { provisionBusiness, provisionPlatform, recordOpeningFloat } = require('../server/services/provisioningService');
const { hashPin, newId } = require('../domain/crypto');
const { buildScope } = require('../domain/access');
const { getSettings } = require('../domain/planLimits');
const salesService = require('../server/services/salesService');
const { createApp } = require('../server/lib/http');
const { buildRoutes } = require('../server/routes');

function fixture() {
  const input = fs.readFileSync(0, 'utf8');
  const parsed = JSON.parse(input);
  if (!parsed || !Array.isArray(parsed.businesses) || !parsed.businesses.length) throw new Error('Fixture requires businesses.');
  return parsed;
}
function randomPin() { return String(crypto.randomInt(10000000, 99999999)); }
function dateAt(start, day) {
  const date = new Date(start.getTime() + day * 86400000);
  return date.toISOString().slice(0, 10) + ' 10:00:00';
}
function count(map, key, amount = 1) { map.set(key, (map.get(key) || 0) + amount); }

async function main() {
  const input = fixture();
  const started = Date.now();
  const outputDir = path.resolve('.data/simulation');
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, 'one-year.db');
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
  let clock = '2025-01-01 08:00:00';
  const db = await migratedDatabase(file, { now: () => clock });
  const metrics = new Map();
  const errors = [];
  const uiContracts = [];
  try {
    const adminPin = randomPin();
    await provisionPlatform(db, { adminPin, businessName: 'StockRidge local simulation' });
    await db.run(`UPDATE client_settings SET subscription_status='ACTIVE', subscription_plan='Enterprise',
      max_businesses=100, max_branches=100, max_staff=500, serial_tracking_enabled=0 WHERE id=1`);
    const settings = await getSettings(db);
    const businesses = [];
    const ownerFixture = input.owner || null;
    let owner = null;

    for (const item of input.businesses) {
      const businessId = newId();
      await db.run(`INSERT INTO businesses (id,name,legal_name,profile_code,vat_registered,is_active,created_at,updated_at)
        VALUES (?,?,?,?,?,1,datetime('now'),datetime('now'))`, [businessId, item.name, item.name, item.profileCode, item.vatRegistered ? 1 : 0]);
      const business = await db.first('SELECT * FROM businesses WHERE id=?', [businessId]);
      await provisionBusiness(db, business, { withCatalogue: true });
      const record = { ...business, branches: [], users: [], products: [] };
      for (let index = 0; index < item.branches.length; index += 1) {
        const branchId = newId();
        const branchName = item.branches[index];
        await db.run(`INSERT INTO branches (id,business_id,name,code,branch_type,city,state,opening_cash,is_active,created_at,updated_at)
          VALUES (?,?,?,?,?,'Abuja','FCT',50000,1,datetime('now'),datetime('now'))`,
        [branchId, businessId, branchName, `BR-${index + 1}`, 'MIXED']);
        const branch = await db.first('SELECT * FROM branches WHERE id=?', [branchId]);
        record.branches.push(branch);
      }
      for (const account of item.accounts || []) {
        const userId = newId();
        const branch = account.branchName ? record.branches.find((b) => b.name === account.branchName) : null;
        if (account.branchName && !branch) throw new Error(`Unknown branch for ${item.name}`);
        const pin = account.pin == null ? randomPin() : String(account.pin);
        const hashed = await hashPin(pin);
        await db.run(`INSERT INTO users (id,business_id,branch_id,full_name,username,pin_hash,role,job_title,is_active,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?, ?,1,datetime('now'),datetime('now'))`,
        [userId, businessId, branch ? branch.id : null, account.fullName, account.username, hashed.stored,
          account.role, account.role === 'MANAGER' ? (branch ? 'Branch Manager' : 'General Manager') : 'Sales / Cashier']);
        record.users.push({ id: userId, business_id: businessId, branch_id: branch ? branch.id : null, role: account.role, username: account.username, pin });
      }
      const products = await db.all(`SELECT * FROM products WHERE business_id=? AND is_deleted=0 AND is_active=1
        AND offers_sale=1 AND requires_serial=0 AND tracks_variants=0 AND is_controlled=0
        AND dispensing_class IS NULL AND selling_price>0 ORDER BY sku LIMIT 4`, [businessId]);
      if (!products.length) throw new Error(`No simple sellable products for ${item.name}`);
      for (const branch of record.branches) {
        await recordOpeningFloat(db, { businessId, branchId: branch.id, branchName: branch.name, amount: 50000, userId: record.users[0].id });
        for (const product of products) {
          await db.run(`INSERT INTO stock_batches (id,branch_id,business_id,product_id,cost_price_per_unit,
            selling_price_per_unit,quantity,initial_quantity,status,received_at,created_at,updated_at)
            VALUES (?,?,?,?,?,?,100000,100000,'ACTIVE',datetime('now'),datetime('now'),datetime('now'))`,
          [newId(), branch.id, businessId, product.id, product.cost_price, product.selling_price]);
        }
      }
      record.products = products;
      businesses.push(record);
      count(metrics, 'businesses');
      count(metrics, 'branches', record.branches.length);
    }

    if (ownerFixture) {
      const id = newId();
      const pin = ownerFixture.pin == null ? randomPin() : String(ownerFixture.pin);
      const hashed = await hashPin(pin);
      await db.run(`INSERT INTO users (id,business_id,branch_id,full_name,username,pin_hash,role,job_title,is_active,created_at,updated_at)
        VALUES (?,NULL,NULL,?,?,?,'OWNER','Proprietor',1,datetime('now'),datetime('now'))`,
      [id, ownerFixture.fullName, ownerFixture.username, hashed.stored]);
      owner = { id, role: 'OWNER', business_id: null, branch_id: null, username: ownerFixture.username, pin };
    }
    if (!owner) throw new Error('Fixture requires an owner for simulation authority.');
    const ownerScope = buildScope(owner);

    // Prove every supplied known credential through the real login function and
    // discard the returned token immediately. Unknown PDF credentials use random
    // local-only values and are not printed.
    const { login } = require('../server/middleware/auth');
    const secret = crypto.randomBytes(32).toString('hex');
    let logins = 0;
    for (const business of businesses) {
      for (const user of business.users) {
        await login(db, { username: user.username, pin: user.pin, secret, deviceId: `sim-${user.id}` });
        logins += 1;
      }
      delete business.users;
    }
    count(metrics, 'successfulLogins', logins);

    const app = createApp();
    buildRoutes(app, { DB: db, db, JWT_SECRET: secret, jwtSecret: secret });
    const ownerLogin = await login(db, { username: owner.username, pin: owner.pin, secret, deviceId: 'sim-owner' });
    const token = ownerLogin.token;
    delete owner.pin;
    for (const business of businesses) delete business.users;

    const days = Number(input.days || 365);
    const start = new Date('2025-01-01T08:00:00Z');
    const saleIds = [];
    for (let day = 0; day < days; day += 1) {
      clock = dateAt(start, day);
      for (const business of businesses) {
        for (let branchIndex = 0; branchIndex < business.branches.length; branchIndex += 1) {
          const branch = business.branches[branchIndex];
          const product = business.products[(day + branchIndex) % business.products.length];
          const quantity = 1 + ((day + branchIndex) % 3);
          const lines = [{ productId: product.id, quantity }];
          const params = {
            branch, business, user: owner, settings, scope: ownerScope, lines,
            saleType: 'RETAIL', soldAt: clock, priceLists: [], payments: [],
          };
          const preview = await salesService.prepare(db, params);
          params.payments = [{ method: day % 4 === 0 ? 'BANK_TRANSFER' : 'CASH', amount: preview.totals.total }];
          const completed = await salesService.complete(db, params);
          saleIds.push(completed.saleId);
          count(metrics, 'salesCompleted');
          count(metrics, day % 4 === 0 ? 'bankSales' : 'cashSales');
          if (day > 0 && day % 90 === 0 && branchIndex === 0) {
            await salesService.voidSale(db, {
              saleId: completed.saleId, user: owner, settings, scope: ownerScope,
              reason: 'Scheduled simulation reversal of an incorrect receipt', restoreStock: true,
            });
            count(metrics, 'salesVoided');
          }
        }
      }
    }

    const businessId = businesses[0].id;
    const paths = [
      '/api/auth/me', '/api/businesses', '/api/branches',
      `/api/products?business_id=${businessId}`,
      `/api/sales?business_id=${businessId}&from=2025-01-01&to=2025-12-31`,
      `/api/dashboard?business_id=${businessId}&from=2025-01-01&to=2025-12-31`,
      `/api/reports/sales?business_id=${businessId}&from=2025-01-01&to=2025-12-31`,
    ];
    for (const requestPath of paths) {
      if (!app.match('GET', requestPath.split('?')[0])) {
        uiContracts.push({ path: requestPath, status: 'NO_ROUTE' });
        continue;
      }
      const response = await app.fetch('GET', requestPath, {
        headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': 'sim-owner' },
        env: { DB: db, db, JWT_SECRET: secret },
      });
      const body = await response.text();
      uiContracts.push({ path: requestPath, status: response.status, json: body.startsWith('{') || body.startsWith('['), bytes: body.length });
      if (response.status >= 400) errors.push(`UI contract ${requestPath}: ${response.status}`);
      if ((requestPath.startsWith('/api/sales?') || requestPath.startsWith('/api/reports/sales?')) && body.length < 500) {
        errors.push(`UI contract ${requestPath}: simulated year returned no report rows`);
      }
    }

    const { runSpecialized } = require('./simulate-specialized');
    const specialized = await runSpecialized({
      db, app, businesses, owner, settings, scope, secret, token,
      setClock: (iso) => { clock = iso; },
    });
    errors.push(...specialized.errors);

    const integrity = await db.scalar('PRAGMA integrity_check');
    const fk = await db.all('PRAGMA foreign_key_check');
    const unbalanced = await db.scalar(`SELECT COUNT(*) FROM (
      SELECT journal_entry_id FROM gl_journal_lines GROUP BY journal_entry_id
      HAVING ABS(SUM(debit)-SUM(credit))>0.02)`);
    const negativeStock = await db.scalar('SELECT COUNT(*) FROM stock_batches WHERE quantity<0 OR quantity_reserved<0 OR quantity_reserved>quantity');
    const invalidSales = await db.scalar('SELECT COUNT(*) FROM sales WHERE ABS(total-(amount_paid+balance_due))>0.02');
    const counts = {};
    for (const table of ['businesses','branches','users','products','stock_batches','sales','sale_items','sale_payments','gl_journal_entries','gl_journal_lines']) {
      counts[table] = await db.scalar(`SELECT COUNT(*) FROM ${table}`);
    }
    if (integrity !== 'ok') errors.push(`SQLite integrity ${integrity}`);
    if (fk.length) errors.push(`${fk.length} foreign key violations`);
    if (Number(unbalanced)) errors.push(`${unbalanced} unbalanced journals`);
    if (Number(negativeStock)) errors.push(`${negativeStock} invalid stock batches`);
    if (Number(invalidSales)) errors.push(`${invalidSales} invalid sale totals`);

    const summary = {
      ok: errors.length === 0,
      period: { start: '2025-01-01', days, end: clock.slice(0, 10) },
      metrics: Object.fromEntries(metrics), counts, uiContracts, specialized,
      integrity: { sqlite: integrity, foreignKeyViolations: fk.length, unbalancedJournals: Number(unbalanced), invalidStockBatches: Number(negativeStock), invalidSales: Number(invalidSales) },
      durationSeconds: Math.round((Date.now() - started) / 100) / 10,
      databaseBytes: fs.statSync(file).size,
      errors,
    };
    fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally {
    await db.close();
  }
}

main().catch((error) => { console.error(error.stack); process.exit(1); });
