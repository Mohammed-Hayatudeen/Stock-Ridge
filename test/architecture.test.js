'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('Worker has one required Turso adapter and no legacy binding', () => {
  const entry = fs.readFileSync(path.join(root, 'worker/src/index.mjs'), 'utf8');
  const config = fs.readFileSync(path.join(root, 'worker/wrangler.toml'), 'utf8');
  assert.match(entry, /createTursoDatabase/);
  assert.match(entry, /if \(!url \|\| !token\)/);
  assert.doesNotMatch(entry, /createLegacyDatabase|env\.DB\b/);
  assert.doesNotMatch(config, /legacy_databases|migrations_dir/);
  assert.match(config, /run_worker_first = \["\/api\/\*", "\/diagnose"\]/);
});

test('shared API route table and all relative modules load in Node', () => {
  const routes = require('../server/routes');
  assert.equal(typeof routes.buildRoutes, 'function');
  assert.equal(typeof routes.isPublicPath, 'function');
  assert.equal(routes.isPublicPath('POST', '/api/auth/login'), true);
  assert.equal(routes.isPublicPath('GET', '/api/sales'), false);
});

test('Turso URL normalization and SQL splitter preserve trigger bodies', () => {
  const { httpUrl, splitSql } = require('../worker/src/turso');
  assert.equal(httpUrl('libsql://example.turso.io/'), 'https://example.turso.io');
  const statements = splitSql("CREATE TABLE x(id TEXT); CREATE TRIGGER t AFTER INSERT ON x BEGIN INSERT INTO x VALUES ('a;b'); END; SELECT 1;");
  assert.equal(statements.length, 3);
  assert.match(statements[1], /END$/);
});

test('single-repository Electron root resolves to this checkout', () => {
  const { stockridgeRoot, workerOrigin } = require('../electron/paths');
  assert.equal(stockridgeRoot({ dirname: path.join(root, 'electron') }), root);
  assert.equal(workerOrigin({ envOrigin: 'https://client.example.com' }), 'https://client.example.com');
});

test('desktop install UI stripping preserves the rest of the document', () => {
  const { stripInstallMarkup } = require('../electron/hide-install');
  const result = stripInstallMarkup('<html><head></head><body><button id="install-btn">Install</button><main>Shop</main></body></html>');
  assert.doesNotMatch(result, /id="install-btn"/);
  assert.match(result, /<main>Shop<\/main>/);
});

test('Android launcher supports Windows batch files and release tasks', () => {
  const { gradleInvocation } = require('../tools/android-build');
  const windows = gradleInvocation({ platform: 'win32' });
  assert.match(windows.command, /gradlew\.bat$/);
  assert.deepEqual(windows.args, ['assembleDebug']);
  assert.equal(windows.options.shell, true);
  const linuxRelease = gradleInvocation({ platform: 'linux', release: true });
  assert.deepEqual(linuxRelease.args, ['assembleRelease']);
  assert.equal(linuxRelease.options.shell, false);
});

test('Git metadata names only the current repository', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.repository.url, 'git+https://github.com/Mohammed-Hayatudeen/Stock-Ridge.git');
  for (const file of ['package.json', 'README.md', '.env.example']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(text, /legacy-account|legacy-checkout/i);
  }
});
