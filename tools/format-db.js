'use strict';
const fs = require('fs');
const path = require('path');
const { createTursoDatabase } = require('../worker/src/turso');

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
  
  const db = createTursoDatabase({ url, authToken, name: 'stock2' });

  console.log('🚀 FORMATTING TURSO DATABASE (Wiping Users, Businesses, Branches, Access)...');

  const tables = [
    'user_business_access',
    'user_sessions',
    'users',
    'branches',
    'businesses'
  ];

  // We explicitly use raw batches with foreignKeys: false to bypass constraint blocks
  // that were silently preventing the deletions in Turso.
  for (const table of tables) {
    try {
      await db.batch([{ sql: `DELETE FROM ${table}` }], { foreignKeys: false });
      console.log(`Cleared table: ${table}`);
    } catch (e) {
      console.error(`Failed to clear ${table}:`, e.message);
    }
  }

  const bizCount = await db.scalar('SELECT COUNT(*) FROM businesses');
  const branchCount = await db.scalar('SELECT COUNT(*) FROM branches');
  const userCount = await db.scalar('SELECT COUNT(*) FROM users');

  console.log(`✅ FORMAT COMPLETE. Remaining -> Businesses: ${bizCount}, Branches: ${branchCount}, Users: ${userCount}`);
}

run().catch(console.error);
