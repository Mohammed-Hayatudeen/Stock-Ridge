'use strict';
const path = require('path');
const { createTursoDatabase } = require('../worker/src/turso');

async function run() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('Creds missing');
  
  const db = createTursoDatabase({ url, authToken, name: 'stock2' });

  const u = await db.scalar('SELECT COUNT(*) FROM users');
  const ub = await db.scalar('SELECT COUNT(*) FROM businesses');
  const ubr = await db.scalar('SELECT COUNT(*) FROM branches');
  
  console.log(`Users: ${u}, Businesses: ${ub}, Branches: ${ubr}`);
}
run().catch(console.error);
