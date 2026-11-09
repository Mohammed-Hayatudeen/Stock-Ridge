#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const assets = [...index.matchAll(/(?:src|href)="(\/[^"?#]+)/g)]
  .map((match) => match[1])
  .filter((url) => !url.startsWith('/api/'));
const missing = assets.filter((url) => !fs.existsSync(path.join(root, 'public', url)));

const forbidden = [];
for (const dir of ['worker', 'tools', 'schema']) {
  for (const name of fs.readdirSync(path.join(root, dir), { recursive: true })) {
    const file = path.join(root, dir, name);
    if (!fs.statSync(file).isFile() || !/\.(?:js|mjs|toml|sql)$/.test(name) || file === __filename) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (/\bd1_databases\b|\bcreateD1Database\b|copy-from-d1|wrangler\s+d1/i.test(text)) forbidden.push(path.relative(root, file));
  }
}

for (const file of ['worker/src/index.mjs', 'worker/src/turso.js', 'electron/main.js', 'electron/preload.js']) {
  const checked = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (checked.status !== 0) {
    console.error(checked.stderr);
    process.exit(1);
  }
}

if (forbidden.length) {
  console.error(`Legacy database configuration remains in: ${forbidden.join(', ')}`);
  process.exitCode = 1;
}
if (missing.length) {
  console.error('The uploaded source export is incomplete. Missing browser assets referenced by public/index.html:');
  for (const url of missing) console.error(`  public${url}`);
  console.error('Restore these original source files before producing a client build. No placeholder UI has been substituted.');
  process.exitCode = 1;
}
if (!process.exitCode) console.log(`Source check passed: ${assets.length} browser assets, Turso-only Worker, wrapper entry points valid.`);
