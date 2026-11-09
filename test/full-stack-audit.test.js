'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApp, matchPath } = require('../server/lib/http');
const { buildRoutes, isPublicPath } = require('../server/routes');
const money = require('../domain/money');
const access = require('../domain/access');
const { copyDue } = require('../lib/sync-budget');
const { applyHolds, linesFromSale } = require('../lib/stock-hold');
const { signReplay, trustedReplay } = require('../server/lib/replay');

const root = path.resolve(__dirname, '..');
function apiApp() {
  const app = createApp();
  buildRoutes(app, {});
  return app;
}
function concretePath(pattern) {
  return pattern.replace(/:[A-Za-z0-9_]+/g, 'audit-id').replace(/\*$/, 'audit-id');
}

test('route inventory is unique and every guarded endpoint rejects an anonymous call', async () => {
  const app = apiApp();
  assert.ok(app.routes.length >= 240, `expected full API, got ${app.routes.length}`);
  const unique = new Set(app.routes.map((route) => `${route.method} ${route.pattern}`));
  assert.equal(unique.size, app.routes.length, 'duplicate method/path registrations');
  for (const route of app.routes) {
    if (isPublicPath(route.method, route.pattern)) continue;
    const response = await app.fetch(route.method, concretePath(route.pattern));
    assert.equal(response.status, 401, `${route.method} ${route.pattern} bypassed authentication`);
  }
});

test('static browser API literals resolve to registered backend paths', () => {
  const app = apiApp();
  const literals = new Set();
  for (const name of fs.readdirSync(path.join(root, 'public/js'), { recursive: true })) {
    if (!name.endsWith('.js')) continue;
    const source = fs.readFileSync(path.join(root, 'public/js', name), 'utf8');
    for (const match of source.matchAll(/['"`](\/api\/[^'"`?\s]+)['"`]/g)) {
      if (!match[1].includes('${')) literals.add(match[1]);
    }
  }
  assert.ok(literals.size >= 100, `expected broad browser coverage, got ${literals.size}`);
  for (const literal of literals) {
    const pathname = literal.replace(/\/$/, '');
    assert.ok(app.routes.some((route) => matchPath(route.compiled, pathname)), `browser has no backend route for ${literal}`);
  }
});

test('money rounding is symmetric for charges and refunds and allocations foot', () => {
  assert.equal(money.round2(1.005), 1.01);
  assert.equal(money.round2(-1.005), -1.01);
  assert.equal(money.roundTo(-1250.005, 2), -1250.01);
  for (const total of [100, -100, 0.03, -0.03]) {
    const parts = money.allocate(total, [1, 1, 1]);
    assert.equal(money.sum(parts), total);
  }
});

test('mutation scope never silently emits a missing required branch or business', () => {
  const manager = access.buildScope(
    { id: 'manager', role: 'MANAGER', business_id: 'business-1', branch_id: null },
    { businessIds: ['business-1'], allBranchIds: [
      { id: 'branch-1', business_id: 'business-1' },
      { id: 'branch-2', business_id: 'business-1' },
    ] },
  );
  assert.throws(() => access.resolveMutationBranchId(manager, null), (error) => error.code === 'BRANCH_REQUIRED');
  assert.equal(access.resolveMutationBranchId(manager, 'branch-2'), 'branch-2');
  assert.throws(() => access.resolveMutationBranchId(manager, 'branch-outside'), (error) => error.code === 'BRANCH_SCOPE_VIOLATION');

  const grantOnly = access.buildScope(
    { id: 'grant-user', role: 'MANAGER', business_id: null, branch_id: null },
    { businessIds: ['business-a', 'business-b'], allBranchIds: [] },
  );
  assert.throws(() => access.resolveMutationBusinessId(grantOnly, null), (error) => error.code === 'BUSINESS_REQUIRED');
  const oneGrant = access.buildScope(
    { id: 'grant-user', role: 'MANAGER', business_id: null, branch_id: null },
    { businessIds: ['business-a'], allBranchIds: [] },
  );
  assert.equal(access.resolveMutationBusinessId(oneGrant, null), 'business-a');
});

test('sync copy schedule treats SQL timestamps as UTC in every local timezone', () => {
  const lastAt = '2026-01-01 00:00:00';
  const utc = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(copyDue(lastAt, utc + 59_999, 60_000), false);
  assert.equal(copyDue(lastAt, utc + 60_000, 60_000), true);
});

test('stock holds consume available room once and reject malformed sale lines', () => {
  const held = applyHolds([
    { product_id: 'p1', quantity: 10, quantity_reserved: 2 },
    { product_id: 'p1', quantity: 5, quantity_reserved: 0 },
  ], { p1: 10 });
  assert.equal(held[0].quantity_reserved, 10);
  assert.equal(held[1].quantity_reserved, 2);
  assert.equal(held[1].hub_hold, 2);
  assert.deepEqual(linesFromSale({ lines: [
    { product_id: 'p1', quantity: 2 }, { product_id: '', quantity: 4 },
    { product_id: 'p2', quantity: -1 }, { product_id: 'p3', quantity: 'bad' },
  ] }), [{ product_id: 'p1', qty: 2 }]);
});

test('sync replay signatures are bound to secret and idempotency key', async () => {
  const env = { JWT_SECRET: 'audit-secret-that-is-long-enough-for-tests' };
  const signature = await signReplay(env, 'logical-action-1');
  const context = (token, key = 'logical-action-1') => ({
    env,
    req: { header: (name) => name.toLowerCase() === 'x-sync-replay' ? token : key },
  });
  assert.equal(await trustedReplay(context(signature)), true);
  assert.equal(await trustedReplay(context(signature, 'different-action')), false);
  assert.equal(await trustedReplay(context('1')), false);
});
