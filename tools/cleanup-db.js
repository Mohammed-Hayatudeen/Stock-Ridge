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

  // Delete duplicates keeping oldest
  const businesses = await db.all('SELECT id, name, profile_code FROM businesses ORDER BY created_at ASC');
  const seenNames = new Set();
  const toDeleteBiz = [];
  const keptBiz = [];
  
  for (const biz of businesses) {
    const key = biz.name.trim().toLowerCase();
    if (seenNames.has(key)) {
      toDeleteBiz.push(biz.id);
    } else {
      seenNames.add(key);
      keptBiz.push(biz);
    }
  }

  if (toDeleteBiz.length > 0) {
    console.log(`Deleting ${toDeleteBiz.length} duplicate businesses...`);
    for (const id of toDeleteBiz) {
      await db.run('DELETE FROM businesses WHERE id = ?', [id]);
      await db.run('DELETE FROM branches WHERE business_id = ?', [id]);
      await db.run('DELETE FROM users WHERE business_id = ? OR branch_business_id = ?', [id, id]);
    }
  }

  // Also trim branches if there are duplicates inside a business
  for (const biz of keptBiz) {
    const branches = await db.all('SELECT id, name FROM branches WHERE business_id = ? ORDER BY created_at ASC', [biz.id]);
    const seenBranch = new Set();
    for (const branch of branches) {
      const key = branch.name.trim().toLowerCase();
      if (seenBranch.has(key)) {
        await db.run('DELETE FROM branches WHERE id = ?', [branch.id]);
        await db.run('DELETE FROM users WHERE branch_id = ?', [branch.id]);
      } else {
        seenBranch.add(key);
      }
    }
  }

  // Also trim duplicate users based on username
  const users = await db.all('SELECT id, username FROM users ORDER BY created_at ASC');
  const seenUser = new Set();
  for (const u of users) {
    const key = u.username.trim().toLowerCase();
    if (seenUser.has(key)) {
      await db.run('DELETE FROM users WHERE id = ?', [u.id]);
    } else {
      seenUser.add(key);
    }
  }

  const branchCount = await db.scalar('SELECT COUNT(*) FROM branches');
  const userCount = await db.scalar('SELECT COUNT(*) FROM users');
  console.log(`Remaining businesses: ${keptBiz.length}, branches: ${branchCount}, users: ${userCount}`);

  // Generate test-accounts.md
  const allUsers = await db.all(`
    SELECT u.username, u.role, b.name as branch_name, biz.name as biz_name 
    FROM users u 
    LEFT JOIN branches b ON u.branch_id = b.id 
    LEFT JOIN businesses biz ON u.business_id = biz.id OR b.business_id = biz.id
    ORDER BY u.role, u.username
  `);

  let md = '# Remaining Test Accounts\n\n| Username | Role | Business/Branch |\n|---|---|---|\n';
  for (const u of allUsers) {
    const loc = u.branch_name ? u.branch_name : (u.biz_name ? u.biz_name : 'Global');
    md += `| ${u.username} | ${u.role} | ${loc} |\n`;
  }

  fs.writeFileSync(path.join(__dirname, '..', 'doc', 'test-accounts.md'), md);
  console.log('Updated doc/test-accounts.md');
}

run().catch(console.error);
