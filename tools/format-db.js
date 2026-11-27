// PROTOCOL: Always reference the agent.md file before any further fix on this page.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createTursoDatabase } = require('../worker/src/turso');

function bytesToBase64url(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(String(pin), salt, 1000, 32, 'sha256');
  return `pbkdf2$sha256$1000$${bytesToBase64url(salt)}$${derived.toString('hex')}`;
}

const idGen = () => crypto.randomBytes(8).toString('hex');

function loadEnvFile() {
  const file = path.join(__dirname, '..', '.env.deploy');
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

async function run() {
  loadEnvFile();
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
  
  const db = createTursoDatabase({ url, authToken, name: process.env.DB_NAME || 'stockridge' });

  console.log('🚀 FORMATTING TURSO DATABASE (Leaving only admin credentials)...');

  // Get tables
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_\\_%' ESCAPE '\\' AND name != '_migrations' AND name != 'nafdac_catalog' AND name != 'sync_revisions'");
  
  const batches = [];
  for (const t of tables) {
     if (t.name.startsWith('__')) continue;
     batches.push({ sql: `DELETE FROM "${t.name}"` });
  }
  await db.batch(batches, { foreignKeys: false });

  // Insert default settings
  console.log('Inserting default client settings...');
  const { DEFAULT_SETTINGS } = require('../domain/planLimits');
  const allCols = Object.keys(DEFAULT_SETTINGS);
  const insertCols = allCols.join(', ') + ', updated_at';
  const insertVals = allCols.map(() => '?').join(', ') + ", datetime('now')";
  const insertParams = allCols.map(k => DEFAULT_SETTINGS[k]);
  try {
    await db.run(`INSERT INTO client_settings (${insertCols}) VALUES (${insertVals})`, insertParams);
  } catch (err) {
    console.log("Client settings insert error:", err.message);
  }

  // Insert Admin
  console.log('Inserting admin credentials...');
  const adminId = idGen();
  try {
    await db.run(
      "INSERT INTO users (id, username, full_name, role, pin_hash, is_active, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 0, datetime('now'), datetime('now'))",
      [adminId, 'admin', 'admin', 'ADMIN', hashPin('7000')]
    );
  } catch(err) {
    console.log("Admin insert error:", err.message);
    throw err;
  }

  console.log('✅ FORMAT COMPLETE. Admin user ready.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
