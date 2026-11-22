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

  console.log('Wiping tables...');
  await db.batch([
    { sql: 'DELETE FROM user_business_access' },
    { sql: 'DELETE FROM user_sessions' },
    { sql: 'DELETE FROM users' },
    { sql: 'DELETE FROM branches' },
    { sql: 'DELETE FROM businesses' }
  ], { foreignKeys: false });

  const biz = [
    { id: idGen(), name: 'AquaRidge', profile: 'WATER', branches: ['AquaRidge', 'Aquakaru'] },
    { id: idGen(), name: 'BakeRidge', profile: 'BAKERY', branches: ['BakeRidge', 'BakeKaru'] },
    { id: idGen(), name: 'ElecRidge', profile: 'ELECTRONICS', branches: ['ElecRidge', 'ElecKaru'] },
    { id: idGen(), name: 'EventRidge', profile: 'RENTAL', branches: ['eventRidge HQ', 'EventKaru'] },
    { id: idGen(), name: 'PharmaRidge', profile: 'PHARMACY', branches: ['pharmaHq', 'pharmakaru'] },
    { id: idGen(), name: 'WareRidge', profile: 'WAREHOUSE', branches: ['wareRidge HQ', 'warekaru'] },
    { id: idGen(), name: 'woodRidge', profile: 'TIMBER', branches: ['woodRidge HQ', 'woodkaru'] },
    { id: idGen(), name: 'BuildRidge', profile: 'BUILDING_MATERIALS', branches: ['BuildRidge HQ', 'BuildKaru'] },
    { id: idGen(), name: 'EquipRidge', profile: 'EQUIPMENT_RENTAL', branches: ['EquipRidge HQ', 'EquipKaru'] },
    { id: idGen(), name: 'LeaseRidge', profile: 'LEASING', branches: ['LeaseRidge HQ', 'LeaseKaru'] },
    { id: idGen(), name: 'SellLeaseRidge', profile: 'SELL_AND_LEASE', branches: ['SellLeaseRidge HQ', 'SellLeaseKaru'] },
    { id: idGen(), name: 'FabricRidge', profile: 'PROVISIONS_FABRICS', branches: ['FabricRidge HQ', 'FabricKaru'] },
    { id: idGen(), name: 'MarketRidge', profile: 'SUPERMARKET', branches: ['MarketRidge HQ', 'MarketKaru'] },
    { id: idGen(), name: 'GeneralRidge', profile: 'GENERAL_RETAIL', branches: ['GeneralRidge HQ', 'GeneralKaru'] }
  ];

  const branchMap = {}; // name -> { id, bizId }

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
    { u: 'gmbuild', p: '1007', r: 'MANAGER', bizPrimary: biz[7].id },
    { u: 'gmequip', p: '1008', r: 'MANAGER', bizPrimary: biz[8].id },
    { u: 'gmlease', p: '1009', r: 'MANAGER', bizPrimary: biz[9].id },
    { u: 'gmselllease', p: '1010', r: 'MANAGER', bizPrimary: biz[10].id },
    { u: 'gmfabric', p: '1011', r: 'MANAGER', bizPrimary: biz[11].id },
    { u: 'gmmarket', p: '1012', r: 'MANAGER', bizPrimary: biz[12].id },
    { u: 'gmgeneral', p: '1013', r: 'MANAGER', bizPrimary: biz[13].id },
    
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
    { u: 'wostaff2karu', p: '3226', r: 'STAFF', br: 'woodkaru' },
    
    // Build
    { u: 'bmstaff1abuja', p: '1118', r: 'STAFF', br: 'buildridge hq' },
    { u: 'bmstaff2abuja', p: '1218', r: 'STAFF', br: 'buildridge hq' },
    { u: 'bmstaff3abuja', p: '1318', r: 'STAFF', br: 'buildridge hq' },
    { u: 'bmmgr1karu', p: '2128', r: 'MANAGER', br: 'buildkaru' },
    { u: 'bmstaff1karu', p: '1128', r: 'STAFF', br: 'buildkaru' },
    { u: 'bmstaff2karu', p: '1228', r: 'STAFF', br: 'buildkaru' },
    
    // Equip
    { u: 'eqstaff1abuja', p: '1119', r: 'STAFF', br: 'equipridge hq' },
    { u: 'eqstaff2abuja', p: '1219', r: 'STAFF', br: 'equipridge hq' },
    { u: 'eqstaff3abuja', p: '1319', r: 'STAFF', br: 'equipridge hq' },
    { u: 'eqmgr1karu', p: '2129', r: 'MANAGER', br: 'equipkaru' },
    { u: 'eqstaff1karu', p: '1129', r: 'STAFF', br: 'equipkaru' },
    { u: 'eqstaff2karu', p: '1229', r: 'STAFF', br: 'equipkaru' },
    
    // Lease
    { u: 'lestaff1abuja', p: '11110', r: 'STAFF', br: 'leaseridge hq' },
    { u: 'lestaff2abuja', p: '12110', r: 'STAFF', br: 'leaseridge hq' },
    { u: 'lestaff3abuja', p: '13110', r: 'STAFF', br: 'leaseridge hq' },
    { u: 'lemgr1karu', p: '21210', r: 'MANAGER', br: 'leasekaru' },
    { u: 'lestaff1karu', p: '11210', r: 'STAFF', br: 'leasekaru' },
    { u: 'lestaff2karu', p: '12210', r: 'STAFF', br: 'leasekaru' },
    
    // SellLease
    { u: 'slstaff1abuja', p: '11111', r: 'STAFF', br: 'sellleaseridge hq' },
    { u: 'slstaff2abuja', p: '12111', r: 'STAFF', br: 'sellleaseridge hq' },
    { u: 'slstaff3abuja', p: '13111', r: 'STAFF', br: 'sellleaseridge hq' },
    { u: 'slmgr1karu', p: '21211', r: 'MANAGER', br: 'sellleasekaru' },
    { u: 'slstaff1karu', p: '11211', r: 'STAFF', br: 'sellleasekaru' },
    { u: 'slstaff2karu', p: '12211', r: 'STAFF', br: 'sellleasekaru' },
    
    // Fabric
    { u: 'pfstaff1abuja', p: '11112', r: 'STAFF', br: 'fabricridge hq' },
    { u: 'pfstaff2abuja', p: '12112', r: 'STAFF', br: 'fabricridge hq' },
    { u: 'pfstaff3abuja', p: '13112', r: 'STAFF', br: 'fabricridge hq' },
    { u: 'pfmgr1karu', p: '21212', r: 'MANAGER', br: 'fabrickaru' },
    { u: 'pfstaff1karu', p: '11212', r: 'STAFF', br: 'fabrickaru' },
    { u: 'pfstaff2karu', p: '12212', r: 'STAFF', br: 'fabrickaru' },
    
    // Market
    { u: 'sustaff1abuja', p: '11113', r: 'STAFF', br: 'marketridge hq' },
    { u: 'sustaff2abuja', p: '12113', r: 'STAFF', br: 'marketridge hq' },
    { u: 'sustaff3abuja', p: '13113', r: 'STAFF', br: 'marketridge hq' },
    { u: 'sumgr1karu', p: '21213', r: 'MANAGER', br: 'marketkaru' },
    { u: 'sustaff1karu', p: '11213', r: 'STAFF', br: 'marketkaru' },
    { u: 'sustaff2karu', p: '12213', r: 'STAFF', br: 'marketkaru' },
    
    // General
    { u: 'grstaff1abuja', p: '11114', r: 'STAFF', br: 'generalridge hq' },
    { u: 'grstaff2abuja', p: '12114', r: 'STAFF', br: 'generalridge hq' },
    { u: 'grstaff3abuja', p: '13114', r: 'STAFF', br: 'generalridge hq' },
    { u: 'grmgr1karu', p: '21214', r: 'MANAGER', br: 'generalkaru' },
    { u: 'grstaff1karu', p: '11214', r: 'STAFF', br: 'generalkaru' },
    { u: 'grstaff2karu', p: '12214', r: 'STAFF', br: 'generalkaru' }
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
      sql: 'INSERT INTO users (id, username, pin_hash, role, business_id, branch_id, is_active, is_deleted) VALUES (?, ?, ?, ?, ?, ?, 1, 0)',
      params: [uid, u.u, hp, u.r, bId, brId]
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

  console.log('✅ DB Migration & Seed Complete!');
}

run().catch(console.error);
