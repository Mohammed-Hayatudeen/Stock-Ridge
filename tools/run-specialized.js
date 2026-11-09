#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { LocalDatabase } = require('../test/helpers/sqlite-db');
const { createApp } = require('../server/lib/http');
const { buildRoutes } = require('../server/routes');
const { buildScope } = require('../domain/access');
const { getSettings } = require('../domain/planLimits');
const { runSpecialized } = require('./simulate-specialized');

(async () => {
  const { secret } = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (!secret) throw new Error('A transient JWT secret is required on stdin.');
  const file = path.resolve('.data/simulation/one-year.db');
  if (!fs.existsSync(file)) throw new Error('Run the one-year local simulation first.');
  const db = new LocalDatabase(file);
  try {
    const app = createApp();
    buildRoutes(app);
    const owner = await db.first("SELECT * FROM users WHERE role='OWNER' AND is_deleted=0 LIMIT 1");
    const settings = await getSettings(db);
    const scope = buildScope(owner);
    const rows = await db.all('SELECT * FROM businesses WHERE is_deleted=0 ORDER BY created_at');
    const businesses = [];
    for (const business of rows) {
      businesses.push({ ...business,
        branches: await db.all('SELECT * FROM branches WHERE business_id=? AND is_deleted=0', [business.id]),
        products: await db.all('SELECT * FROM products WHERE business_id=? AND is_deleted=0', [business.id]) });
    }
    const { token } = await require('../server/middleware/auth').startSession(db, owner, secret, {
      deviceId: 'sim-owner', userAgent: 'local-specialized-simulation', remember: false,
    });
    const result = await runSpecialized({
      db, app, businesses, owner, settings, scope, secret, token,
      setClock: () => {},
    });
    const output = { ok: result.errors.length === 0, ...result };
    fs.writeFileSync('.data/simulation/specialized.json', JSON.stringify(output, null, 2) + '\n');
    console.log(JSON.stringify(output, null, 2));
    if (result.errors.length) process.exitCode = 1;
  } finally { await db.close(); }
})().catch((error) => { console.error(error.stack); process.exit(1); });
