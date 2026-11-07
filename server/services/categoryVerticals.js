'use strict';

// Category definitions are shared by businesses of the same profile, while
// each business retains its own category row/ID for products and sale-time
// snapshots. This keeps ordinary business scope intact and prevents a
// category from one vertical leaking into another.

const { newId } = require('../../domain/crypto');

async function businessesForProfile(db, profileCode) {
  return db.all(
    'SELECT id, profile_code FROM businesses WHERE profile_code = ? AND is_deleted = 0 ORDER BY id',
    [String(profileCode || '').toUpperCase()],
  );
}

async function profileForBusiness(db, businessId) {
  if (!businessId) return null;
  return db.first(
    'SELECT id, profile_code FROM businesses WHERE id = ? AND is_deleted = 0',
    [String(businessId)],
  );
}

async function ensurePharmaceuticalCategory(db, businessId) {
  const business = await profileForBusiness(db, businessId);
  if (!business || String(business.profile_code).toUpperCase() !== 'PHARMACEUTICAL') return null;
  const rows = await db.all(
    `SELECT id, name, is_deleted, parent_id, is_active, sort_order FROM product_categories
      WHERE business_id = ? AND code = 'PHARMACEUTICALS'
      ORDER BY is_deleted, id`,
    [String(business.id)],
  );
  let row = rows.find((item) => !Number(item.is_deleted)) || rows[0] || null;
  if (row) {
    if (String(row.name) !== 'Pharmaceuticals' || row.parent_id != null || Number(row.is_active) !== 1
        || Number(row.is_deleted) !== 0 || Number(row.sort_order) !== 0) {
      await db.run(
        `UPDATE product_categories
            SET name = 'Pharmaceuticals', parent_id = NULL, is_active = 1, is_deleted = 0,
                sort_order = 0, updated_at = datetime('now')
          WHERE id = ?`,
        [String(row.id)],
      );
    }
    return { id: String(row.id), business_id: String(business.id), code: 'PHARMACEUTICALS', name: 'Pharmaceuticals' };
  }
  const id = newId();
  await db.run(
    `INSERT INTO product_categories
       (id, business_id, code, name, parent_id, sort_order, is_active, created_at, updated_at)
     VALUES (?,?,'PHARMACEUTICALS','Pharmaceuticals',NULL,0,1,datetime('now'),datetime('now'))`,
    [id, String(business.id)],
  );
  return { id, business_id: String(business.id), code: 'PHARMACEUTICALS', name: 'Pharmaceuticals' };
}

async function replicateCategory(db, { profileCode, code, name, sortOrder = 1, fixed = false }) {
  const profile = String(profileCode || '').toUpperCase();
  const key = String(code || '').toUpperCase();
  if (!profile || !key || key === 'NON_PHARMACEUTICALS') return [];
  const businesses = await businessesForProfile(db, profile);
  const result = [];
  for (const business of businesses) {
    if (key === 'PHARMACEUTICALS' && profile !== 'PHARMACEUTICAL') continue;
    if (key === 'PHARMACEUTICALS' || fixed) {
      const row = await ensurePharmaceuticalCategory(db, business.id);
      if (row) result.push(row);
      continue;
    }
    const rows = await db.all(
      `SELECT id, name, is_deleted FROM product_categories
        WHERE business_id = ? AND code = ? ORDER BY is_deleted, id`,
      [String(business.id), key],
    );
    const row = rows.find((item) => !Number(item.is_deleted)) || rows[0] || null;
    if (row) {
      await db.run(
        `UPDATE product_categories
            SET name = ?, parent_id = NULL, sort_order = ?, is_active = 1, is_deleted = 0,
                updated_at = datetime('now')
          WHERE id = ?`,
        [String(name), Math.max(1, Number(sortOrder) || 1), String(row.id)],
      );
      result.push({ id: String(row.id), business_id: String(business.id), code: key, name: String(name) });
      continue;
    }
    const id = newId();
    await db.run(
      `INSERT INTO product_categories
         (id, business_id, code, name, parent_id, sort_order, is_active, created_at, updated_at)
       VALUES (?,?,?, ?,NULL,?,1,datetime('now'),datetime('now'))`,
      [id, String(business.id), key, String(name), Math.max(1, Number(sortOrder) || 1)],
    );
    result.push({ id, business_id: String(business.id), code: key, name: String(name) });
  }
  return result;
}

/**
 * Called only when a vertical's category definitions are intentionally
 * provisioned or changed, never on ordinary reads. Most recently updated
 * category name wins for a code; edits through the category endpoint update all
 * same-profile rows together.
 */
async function syncProfileCategories(db, profileCode) {
  const profile = String(profileCode || '').toUpperCase();
  if (!profile) return [];
  const rows = await db.all(
    `SELECT c.code, c.name, c.sort_order, c.updated_at, c.id
       FROM product_categories c
       JOIN businesses b ON b.id = c.business_id
      WHERE b.profile_code = ? AND b.is_deleted = 0 AND c.is_deleted = 0
        AND c.code <> 'NON_PHARMACEUTICALS'
      ORDER BY c.updated_at DESC, c.id`,
    [profile],
  );
  const canonical = new Map();
  for (const row of rows) {
    const code = String(row.code || '').toUpperCase();
    if (!code || (code === 'PHARMACEUTICALS' && profile !== 'PHARMACEUTICAL') || canonical.has(code)) continue;
    canonical.set(code, row);
  }
  if (profile === 'PHARMACEUTICAL') {
    canonical.set('PHARMACEUTICALS', { code: 'PHARMACEUTICALS', name: 'Pharmaceuticals', sort_order: 0 });
  } else {
    canonical.delete('PHARMACEUTICALS');
  }
  const businesses = await businessesForProfile(db, profile);
  for (const [code, definition] of canonical) {
    await replicateCategory(db, {
      profileCode: profile,
      code,
      name: code === 'PHARMACEUTICALS' ? 'Pharmaceuticals' : definition.name,
      sortOrder: code === 'PHARMACEUTICALS' ? 0 : definition.sort_order,
      fixed: code === 'PHARMACEUTICALS',
    });
  }
  return businesses;
}

module.exports = {
  businessesForProfile,
  profileForBusiness,
  ensurePharmaceuticalCategory,
  replicateCategory,
  syncProfileCategories,
};
