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
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN required');
  const db = createTursoDatabase({ url, authToken, name: process.env.DB_NAME || 'stockridge' });

  const biz = [
    { id: idGen(), name: 'AquaRidge', profile: 'WATER', branches: ['AquaRidge', 'Aquakaru'] },
    { id: idGen(), name: 'BakeRidge', profile: 'BAKERY', branches: ['BakeRidge', 'BakeKaru'] },
    { id: idGen(), name: 'ElecRidge', profile: 'ELECTRONICS', branches: ['ElecRidge', 'ElecKaru'] },
    { id: idGen(), name: 'EventRidge', profile: 'RENTAL', branches: ['eventRidge HQ', 'EventKaru'] },
    { id: idGen(), name: 'PharmaRidge', profile: 'PHARMACY', branches: ['pharmaHq', 'pharmakaru'] },
    { id: idGen(), name: 'WareRidge', profile: 'WAREHOUSE', branches: ['wareRidge HQ', 'warekaru'] },
    { id: idGen(), name: 'woodRidge', profile: 'TIMBER', branches: ['woodRidge HQ', 'woodkaru'] }
  ];

  const branchMap = {}; // name -> { id, bizId }

  const existingSettings = await db.first('SELECT id FROM client_settings WHERE id = 1');
  if (!existingSettings) {
    const { DEFAULT_SETTINGS } = require('../domain/planLimits');
    const allCols = Object.keys(DEFAULT_SETTINGS);
    const insertCols = allCols.join(', ') + ', updated_at';
    const insertVals = allCols.map(() => '?').join(', ') + ", datetime('now')";
    const insertParams = allCols.map(k => DEFAULT_SETTINGS[k]);
    await db.run(`INSERT INTO client_settings (${insertCols}) VALUES (${insertVals})`, insertParams);
  }

  console.log('Inserting Businesses and Branches...');
  for (let i = 0; i < biz.length; i++) {
    const b = biz[i];
    await db.batch([{
      sql: 'INSERT INTO businesses (id, name, profile_code, is_active, is_deleted) VALUES (?, ?, ?, 1, 0)',
      params: [b.id, b.name, b.profile]
    }], { foreignKeys: false });

    for (const brName of b.branches) {
      const brId = idGen();
      branchMap[brName.toLowerCase()] = { id: brId, bizId: b.id };
      await db.batch([{
        sql: 'INSERT INTO branches (id, business_id, name, code, is_active, is_deleted) VALUES (?, ?, ?, ?, 1, 0)',
        params: [brId, b.id, brName, brName.replace(/\s+/g, '').toUpperCase().slice(0, 10)]
      }], { foreignKeys: false });
    }
  }

  const users = [
    // Top-Level
    { u: 'ceo', p: '9000', r: 'OWNER', global: true },
    { u: 'cceo', p: '8000', r: 'OWNER', bizAccess: [biz[0].id, biz[1].id, biz[6].id] },
    { u: 'admin', p: '7000', r: 'ADMIN', global: true },
    // GMs
    { u: 'gmaqua', p: '1000', r: 'MANAGER', bizPrimary: biz[0].id },
    { u: 'gmbake', p: '1001', r: 'MANAGER', bizPrimary: biz[1].id },
    { u: 'gmelect', p: '1002', r: 'MANAGER', bizPrimary: biz[2].id },
    { u: 'gmevent', p: '1003', r: 'MANAGER', bizPrimary: biz[3].id },
    { u: 'gmpharma', p: '1004', r: 'MANAGER', bizPrimary: biz[4].id },
    { u: 'gmware', p: '1005', r: 'MANAGER', bizPrimary: biz[5].id },
    { u: 'gmwood', p: '1006', r: 'MANAGER', bizPrimary: biz[6].id },
    // Branches
    // Aqua
    { u: 'astaff2abuja', p: '3210', r: 'STAFF', br: 'aquaridge' },
    { u: 'astaff3abuja', p: '3310', r: 'STAFF', br: 'aquaridge' },
    { u: 'amgr1karu', p: '2120', r: 'MANAGER', br: 'aquakaru' },
    { u: 'astaff2karu', p: '3220', r: 'STAFF', br: 'aquakaru' },
    { u: 'astaff1karu', p: '3120', r: 'STAFF', br: 'aquakaru' },
    { u: 'astaff1abuja', p: '3110', r: 'STAFF', br: 'aquakaru' },
    // Bake
    { u: 'bstaff1abuja', p: '3111', r: 'STAFF', br: 'bakeridge' },
    { u: 'bstaff2abuja', p: '3211', r: 'STAFF', br: 'bakeridge' },
    { u: 'bstaff3abuja', p: '3311', r: 'STAFF', br: 'bakeridge' },
    { u: 'bmgr1karu', p: '2121', r: 'MANAGER', br: 'bakekaru' },
    { u: 'bstaff1karu', p: '3121', r: 'STAFF', br: 'bakekaru' },
    { u: 'bstaff2karu', p: '3221', r: 'STAFF', br: 'bakekaru' },
    // Elec
    { u: 'elstaff1abuja', p: '3112', r: 'STAFF', br: 'elecridge' },
    { u: 'elstaff2abuja', p: '3212', r: 'STAFF', br: 'elecridge' },
    { u: 'elstaff3abuja', p: '3312', r: 'STAFF', br: 'elecridge' },
    { u: 'elmgr1karu', p: '2122', r: 'MANAGER', br: 'eleckaru' },
    { u: 'elstaff1karu', p: '3122', r: 'STAFF', br: 'eleckaru' },
    { u: 'elstaff2karu', p: '3222', r: 'STAFF', br: 'eleckaru' },
    // Event
    { u: 'evstaff1abuja', p: '3113', r: 'STAFF', br: 'eventridge hq' },
    { u: 'evstaff2abuja', p: '3213', r: 'STAFF', br: 'eventridge hq' },
    { u: 'evstaff3abuja', p: '3313', r: 'STAFF', br: 'eventridge hq' },
    { u: 'evmgr1karu', p: '2123', r: 'MANAGER', br: 'eventkaru' },
    { u: 'evstaff1karu', p: '3123', r: 'STAFF', br: 'eventkaru' },
    { u: 'evstaff2karu', p: '3223', r: 'STAFF', br: 'eventkaru' },
    // Pharma
    { u: 'pstaff1abuja', p: '3114', r: 'STAFF', br: 'pharmahq' },
    { u: 'pstaff2abuja', p: '3214', r: 'STAFF', br: 'pharmahq' },
    { u: 'pstaff3abuja', p: '3314', r: 'STAFF', br: 'pharmahq' },
    { u: 'pmgr1karu', p: '2124', r: 'MANAGER', br: 'pharmakaru' },
    { u: 'pstaff1karu', p: '3124', r: 'STAFF', br: 'pharmakaru' },
    { u: 'pstaff2karu', p: '3224', r: 'STAFF', br: 'pharmakaru' },
    // Ware
    { u: 'wastaff1abuja', p: '3115', r: 'STAFF', br: 'wareridge hq' },
    { u: 'wastaff2abuja', p: '3215', r: 'STAFF', br: 'wareridge hq' },
    { u: 'wastaff3abuja', p: '3315', r: 'STAFF', br: 'wareridge hq' },
    { u: 'wamgr1karu', p: '2125', r: 'MANAGER', br: 'warekaru' },
    { u: 'wastaff1karu', p: '3125', r: 'STAFF', br: 'warekaru' },
    { u: 'wastaff2karu', p: '3225', r: 'STAFF', br: 'warekaru' },
    // Wood
    { u: 'wostaff1abuja', p: '3116', r: 'STAFF', br: 'woodridge hq' },
    { u: 'wostaff2abuja', p: '3216', r: 'STAFF', br: 'woodridge hq' },
    { u: 'wostaff3abuja', p: '3316', r: 'STAFF', br: 'woodridge hq' },
    { u: 'womgr1karu', p: '2126', r: 'MANAGER', br: 'woodkaru' },
    { u: 'wostaff1karu', p: '3126', r: 'STAFF', br: 'woodkaru' },
    { u: 'wostaff2karu', p: '3226', r: 'STAFF', br: 'woodkaru' }
  ];

  console.log('Inserting Users...');
  for (const u of users) {
    const uid = idGen();
    const hp = hashPin(u.p);
    
    let bId = null;
    let brId = null;

    if (u.bizPrimary) bId = u.bizPrimary;
    if (u.br) {
      const bmap = branchMap[u.br];
      if (bmap) {
        brId = bmap.id;
        bId = null;
      }
    }

    await db.batch([{
      sql: 'INSERT INTO users (id, full_name, username, pin_hash, role, business_id, branch_id, is_active, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)',
      params: [uid, u.u, u.u, hp, u.r, bId, brId]
    }], { foreignKeys: false });

    if (u.bizAccess) {
      for (const aId of u.bizAccess) {
        await db.batch([{
          sql: 'INSERT INTO user_business_access (id, user_id, business_id, is_deleted) VALUES (?, ?, ?, 0)',
          params: [idGen(), uid, aId]
        }], { foreignKeys: false });
      }
    }
  }

  console.log('✅ DB Seed Complete!');
}

run().catch(console.error);
