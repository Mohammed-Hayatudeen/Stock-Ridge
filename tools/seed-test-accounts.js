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
  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required in the environment or .env.deploy file.');
  }

  const db = createTursoDatabase({ url, authToken, name: 'stock2' });

  const docPath = path.join(__dirname, '..', 'doc', 'test-accounts.md');
  const text = fs.readFileSync(docPath, 'utf8');
  
  const usersToUpdate = [];
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('|') && !line.includes('---|')) {
      const parts = line.split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 5) {
        const username = parts[1];
        let role = parts[2].toUpperCase();
        if (role === 'PROPRIETOR' || role === 'MANUFAC') role = 'OWNER';
        if (role === 'ADMINISTRATOR') role = 'ADMIN';
        if (role === 'GENERAL MANAGER') role = 'MANAGER';
        let pin = parts[parts.length - 1].replace('*', '');
        if (username !== 'Username' && username.length > 0 && /^\d+$/.test(pin)) {
          usersToUpdate.push({ username, pin, role });
        }
      }
    }
  }

  console.log(`Found ${usersToUpdate.length} accounts to process in doc/test-accounts.md.`);

  for (const { username, pin, role } of usersToUpdate) {
    const hashedPin = hashPin(pin);
    try {
      const existing = await db.all('SELECT id FROM users WHERE username = ?', [username]);
      if (existing && existing.length > 0) {
        await db.run('UPDATE users SET pin_hash = ? WHERE username = ?', [hashedPin, username]);
        console.log(`✅ Updated PIN for existing user: ${username}`);
      } else {
        await db.run('INSERT INTO users (username, pin_hash, role, active) VALUES (?, ?, ?, 1)', [username, hashedPin, role]);
        console.log(`✨ Inserted missing user: ${username} (Role: ${role})`);
      }
    } catch (err) {
      console.error(`❌ Failed to process ${username}: ${err.message}`);
    }
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
