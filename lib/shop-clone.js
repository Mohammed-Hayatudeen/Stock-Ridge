'use strict';

// The till does not talk to Turso. When a download has saved, the usable
// rows are written into these tables, with the same columns the shop uses
// for stock in hand. A later screen reads that SQL. It does not invent a
// second total from a JSON blob and a hold.
//
// Secrets are not columns. A missing parent row does not reject the save:
// there are no foreign keys on this copy.

const SECRET = new Set(['pin_hash', 'jwt_secret', 'password', 'password_hash', 'secret']);

const TABLES = {
  businesses: ['id','name','legal_name','profile_code','profile_overrides_json','cac_reg_no','tin','vat_registered','currency_code','default_price_list_id','contact_name','contact_phone','contact_email','address','is_active','created_at','updated_at','is_deleted'],
  branches: ['id','business_id','name','code','branch_type','address','city','state','lga','phone','email','latitude','longitude','geofence_radius_meters','attendance_mode','is_active','created_at','updated_at','is_deleted'],
  users: ['id','business_id','branch_id','full_name','username','pin_hash','role','job_title','email','phone','nin','bvn_last4','bank_name','bank_account_no','employment_started','employment_ended','commission_rate_pct','is_active','last_login_at','created_at','updated_at','is_deleted'],
  customer_classes: ['id','business_id','code','name','default_price_list_id','discount_pct','credit_allowed','default_credit_limit','payment_terms_days','is_system','is_active','created_at','updated_at','is_deleted'],
  customers: ['id','business_id','branch_id','customer_class_id','customer_type','name','company_name','phone','alt_phone','email','address','city','state','tin','cac_reg_no','credit_limit','credit_balance','payment_terms_days','price_list_id','loyalty_points','notes','is_active','created_at','updated_at','is_deleted'],
  product_categories: ['id','business_id','code','name','parent_id','sort_order','is_active','created_at','updated_at','is_deleted'],
  products: ['id','business_id','category_id','sku','name','brand','model_no','description','registration_no','requires_serial','tracks_variants','warranty_months','warranty_type','is_bulky','requires_installation','has_expiry','is_age_restricted','is_fragile','is_returnable','return_window_days','base_unit_name','cost_price','selling_price','selling_price_pack','selling_price_carton','reorder_level','reorder_quantity','min_margin_pct','weight_kg','dimensions_cm','barcode','image_url','valuation_method','is_active','created_at','updated_at','is_deleted'],
  product_units: ['id','product_id','level','code','name','plural_name','quantity_in_base','is_sellable','is_default_sell','default_barcode','created_at','updated_at','is_deleted'],
  product_variants: ['id','product_id','sku','name','attributes_json','barcode','cost_price','selling_price','weight_kg','dimensions_cm','is_active','sort_order','created_at','updated_at','is_deleted'],
  product_barcodes: ['id','product_id','variant_id','barcode','unit_code','label','is_primary','created_at','updated_at','is_deleted'],
  price_lists: ['id','business_id','name','code','priority','valid_from','valid_to','is_active','created_at','updated_at','is_deleted'],
  price_list_items: ['id','price_list_id','product_id','variant_id','unit_code','price','min_quantity','valid_from','valid_to','created_at','updated_at','is_deleted'],
  product_price_overrides: ['id','branch_id','product_id','variant_id','default_selling_price','pack_price','carton_price','updated_by','created_at','updated_at','is_deleted'],
  suppliers: ['id','business_id','name','contact_person','phone','alt_phone','email','address','city','state','country','tin','cac_reg_no','is_manufacturer','bank_name','bank_account_no','bank_account_name','credit_limit','payment_terms_days','rating','notes','created_at','updated_at','is_deleted'],
  stock_batches: ['id','branch_id','business_id','product_id','variant_id','batch_no','supplier_id','purchase_order_id','cost_price_per_unit','selling_price_per_unit','selling_price_pack','selling_price_carton','quantity','quantity_reserved','initial_quantity','manufacture_date','expiry_date','received_at','received_by','status','warehouse_zone','notes','created_at','updated_at','is_deleted'],
  purchase_orders: ['id','branch_id','business_id','po_number','supplier_id','status','ordered_by','ordered_at','expected_date','currency_code','fx_rate','subtotal','discount_total','freight_total','vat_total','wht_code','wht_percent','wht_amount','total','notes','updated_at','is_deleted'],
  purchase_order_items: ['id','purchase_order_id','product_id','variant_id','unit_code','quantity_ordered','quantity_in_base','quantity_received','expected_unit_cost','expected_total_cost','freight_allocation','notes','created_at','updated_at','is_deleted'],
  product_measures: ['id','product_id','axis','sell_unit_code','sell_unit_base_factor','base_unit_code','allows_fraction','min_quantity','step_quantity','created_at','updated_at','is_deleted'],
  deposits: ['id','branch_id','business_id','customer_id','product_id','variant_id','batch_id','serial_id','deposit_type','quantity','unit_code','quantity_in_base','unit_price','total_price','deposit_amount','balance_due','expires_at','status','completed_sale_id','forfeit_amount','created_by','notes','created_at','updated_at','is_deleted'],
  instalment_plans: ['id','plan_no','branch_id','business_id','customer_id','sale_id','deposit_id','principal','interest_percent','interest_amount','total_payable','deposit_amount','tenure_months','frequency','schedule_start','status','guarantor_name','guarantor_phone','guarantor_address','guarantor_id_type','guarantor_id_no','next_due_date','amount_paid','outstanding','days_overdue','approved_by','created_by','notes','created_at','updated_at','is_deleted'],
  delivery_jobs: ['id','job_no','branch_id','business_id','sale_id','customer_id','zone_id','vehicle_id','driver_name','driver_phone','delivery_address','delivery_city','delivery_state','scheduled_at','status','fee','fee_collected','fuel_cost','distance_km','attempts','delivered_at','delivered_to','proof_of_delivery','notes','created_by','created_at','updated_at','is_deleted'],
  client_settings: ['id','business_name','logo_data_url','primary_business_id','max_businesses','max_branches','max_staff','subscription_status','subscription_plan','subscription_renewal_date','attendance_module_enabled','warranty_module_enabled','instalment_module_enabled','delivery_module_enabled','multi_branch_enabled','multi_business_enabled','serial_tracking_enabled','offline_sync_enabled','vat_enabled','vat_rate_percent','managers_can_void_sales','managers_can_approve_expenses','managers_can_edit_prices','managers_can_override_credit_limit','staff_can_void_sales','staff_void_window_minutes','staff_can_adjust_stock','staff_adjustment_max_units','staff_can_adjust_stock_value','staff_can_sell_on_credit','staff_credit_max','staff_discount_max_pct','staff_can_spend_from_safe','staff_safe_spend_max','instalment_max_interest_pct','instalment_max_tenure_months','instalment_min_deposit_pct','credit_max_days','layaway_max_days','layaway_min_deposit_pct','change_owed_expiry_days','return_window_days_default','low_stock_alert_enabled','expiry_alert_days','compliance_alert_days','receipt_footer_text','admin_contact_name','admin_contact_phone','admin_contact_email','notes','data_reset_at','updated_at','updated_by'],
  branch_compliance_records: ['id','branch_id','record_type','record_number','issued_by','issued_date','expiry_date','document_url','notes','created_by','created_at','updated_at','is_deleted'],
  branch_safe_ledger: ['id','branch_id','business_id','entry_type','amount','balance_after','reference_type','reference_id','till_session_id','reason','approved_by','created_by','created_at','updated_at','is_deleted'],
  sales: ['id','business_id','branch_id','till_session_id','receipt_no','customer_id','customer_name','customer_phone','sale_type','salesperson_id','status','subtotal','discount_amount','order_discount_amount','discount_reason','vat_enabled','vat_rate_percent','vat_amount','total','amount_paid','balance_due','cash_tendered','change_given','payment_method','currency_code','fx_rate','due_date','delivery_required','delivery_address','delivery_fee','notes','voided_at','voided_by','void_reason','sold_at','created_at','updated_at','is_deleted'],
  sale_items: ['id','sale_id','product_id','variant_id','batch_id','category_id','product_name','sku','serial_no','unit_code','quantity','quantity_in_base','unit_price','price_source','price_list_id','discount_amount','discount_reason','vat_amount','line_total','cost_price_snapshot','margin','margin_pct','notes','created_at','updated_at','is_deleted'],
  sale_payments: ['id','sale_id','branch_id','till_session_id','method','amount','reference','bank_name','settled_at','status','cash_tendered','change_given','recorded_by','notes','created_at','updated_at','is_deleted'],
  sale_serials: ['id','sale_id','sale_item_id','serial_id','serial_no','branch_id','created_at'],
  sale_returns: ['id','sale_id','branch_id','business_id','return_no','customer_id','reason_code','status','refund_method','refund_amount','restock','approved_by','approved_at','processed_by','processed_at','notes','created_at','updated_at','is_deleted'],
  sale_return_items: ['id','sale_return_id','sale_item_id','product_id','variant_id','quantity','quantity_in_base','unit_code','refund_amount','condition','serial_no','restocked_batch_id','created_at','updated_at','is_deleted'],
  customer_bills: ['id','business_id','branch_id','bill_no','status','customer_id','customer_name','customer_phone','sale_type','subtotal','discount_amount','discount_reason','delivery_fee','delivery_required','delivery_address','vat_amount','total','currency_code','lines_json','notes','valid_until','raised_by','raised_at','payment_started_at','paid_sale_id','paid_at','paid_by','cancelled_at','cancelled_by','cancel_reason','created_at','updated_at','is_deleted'],
  bill_holds: ['id','bill_id','batch_id','quantity_base','created_at'],
  sale_issues: ['id','business_id','branch_id','sale_id','client_id','source_id','code','summary','detail','status','detected_at','cleared_at','cleared_by','clear_note','corrected_at','corrected_by','correction','created_at','updated_at'],
  change_owed: ['id','branch_id','business_id','sale_id','customer_id','customer_name','customer_phone','amount','claim_code','status','redeemed_at','redeemed_by','expires_at','notes','created_by','created_at','updated_at','is_deleted'],
  till_sessions: ['id','branch_id','business_id','user_id','device_id','status','opened_at','closed_at','opening_cash','expected_cash','counted_cash','variance','variance_reason','cash_sales_total','pos_total','transfer_total','mobile_money_total','cheque_total','credit_total','other_total','grand_total','refund_total','sale_count','void_count','notes','reviewed_by','reviewed_at','created_at','updated_at','is_deleted'],
  serial_numbers: ['id','product_id','variant_id','serial_no','imei','batch_id','branch_id','status','warranty_starts_at','warranty_ends_at','sold_at','sale_id','customer_id','notes','created_at','updated_at','is_deleted'],
  expenses: ['id','branch_id','business_id','category','gl_account_id','supplier_id','description','amount','vat_amount','wht_code','wht_percent','wht_amount','net_amount','expense_date','payment_method','reference','receipt_url','status','approved_by','approved_at','paid_from','created_by','notes','created_at','updated_at','is_deleted'],
  delivery_vehicles: ['id','business_id','branch_id','name','plate_no','capacity_kg','capacity_m3','cost_per_km','is_active','created_at','updated_at','is_deleted'],
  stock_transfers: ['id','reference','from_branch_id','to_branch_id','from_business_id','to_business_id','is_intercompany','transfer_price','status','initiated_by','initiated_at','dispatched_at','received_by','received_at','courier_name','courier_phone','vehicle_id','notes','created_at','updated_at','is_deleted'],
  stocktake_sessions: ['id','branch_id','business_id','reference','scope','scope_filter_json','status','opened_by','opened_at','committed_by','committed_at','total_variance_value','notes','created_at','updated_at','is_deleted'],
  asset_agreements: ['id','business_id','branch_id','customer_id','customer_name','customer_phone','sale_id','kind','status','starts_on','ends_on','periods','period_unit','fee_total','deposit_due','deposit_held','deposit_method','venue','notes','returned_at','return_condition','damage_charge','late_days','late_charge','amount_owed','buyout_price','bought_out_sale_id','created_by','created_at','updated_at','is_deleted'],
  asset_agreement_lines: ['id','agreement_id','product_id','variant_id','sale_item_id','product_name','sku','serial_no','quantity','quantity_in_base','unit_code','rate','deposit','asset_cost','created_at','is_deleted'],
  warranty_claims: ['id','claim_no','business_id','branch_id','sale_id','sale_item_id','serial_id','product_id','variant_id','customer_id','status','fault_reported','fault_found','resolution','resolution_notes','in_warranty','warranty_ends_at','supplier_id','supplier_claim_ref','supplier_recovery_amount','cost_to_business','replacement_serial_id','opened_by','opened_at','resolved_by','resolved_at','closed_at','notes','created_at','updated_at','is_deleted'],
  staff_attendance: ['id','user_id','branch_id','business_id','clock_in_at','clock_out_at','clock_in_method','clock_in_lat','clock_in_lng','clock_in_device_id','location_status','distance_meters','device_status','flagged','flag_reason','reviewed_by','reviewed_at','override_by','override_reason','hours_worked','notes','created_at','updated_at','is_deleted'],
  stock_transfer_items: ['id','transfer_id','product_id','variant_id','from_batch_id','to_batch_id','unit_code','quantity_sent','quantity_sent_base','quantity_received','unit_cost','unit_transfer_price','received_at','received_by','discrepancy_note','created_at','updated_at','is_deleted'],
  stocktake_lines: ['id','stocktake_id','product_id','variant_id','batch_id','warehouse_zone','system_qty','counted_qty','variance','counted_by','counted_at','recount_qty','recount_by','notes','created_at','updated_at','is_deleted'],
};

const SPECS = {};
for (const [table, names] of Object.entries(TABLES)) {
  const columns = names.map((name) => {
    const numeric = /quantity|price|cost|amount|balance|level|priority|rate|total|factor|reorder|nafdac_catalog_id|is_|has_|offers_|requires_|tracks_/.test(name);
    return [name, numeric ? 'REAL' : 'TEXT'];
  });
  SPECS[table] = { columns };
}

function quote(name) {
  if (!/^[a-z_]+$/.test(name)) throw new Error('That table is not part of the offline copy.');
  return name;
}

function ddl() {
  const parts = [];
  for (const [table, spec] of Object.entries(SPECS)) {
    const body = spec.columns.map(([name, type]) => `${name} ${type}`).join(', ');
    parts.push(`CREATE TABLE IF NOT EXISTS ${table} (id_key TEXT PRIMARY KEY, ${body}, row_json TEXT NOT NULL);`);
    if (spec.columns.some(([name]) => name === 'product_id')) {
      parts.push(`CREATE INDEX IF NOT EXISTS idx_clone_${table}_product ON ${table}(product_id);`);
    }
    if (spec.columns.some(([name]) => name === 'branch_id')) {
      parts.push(`CREATE INDEX IF NOT EXISTS idx_clone_${table}_branch ON ${table}(branch_id);`);
    if (spec.columns.some(([name]) => name === 'updated_at')) {
      parts.push(`CREATE INDEX IF NOT EXISTS idx_clone_${table}_updated_at ON ${table}(updated_at COLLATE NOCASE);`);
    }
    }
  }
  return parts.join('\n');
}

function columnName(name) {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error('That column is not part of the offline copy.');
  return name;
}

// CREATE TABLE IF NOT EXISTS does not change a till file that already exists.
// Naming a column the old file does not have throws "no column named …" and
// the screen then says Part saved, even when the catalogue count already matches.
let aligning = false;

function align(db) {
  if (aligning) return;
  aligning = true;
  try {
    db.exec(ddl());
    for (const [table, spec] of Object.entries(SPECS)) {
      const have = new Set(db.prepare(`PRAGMA table_info(${quote(table)})`).all().map((row) => row.name));
      let added = false;
      for (const [name, type] of spec.columns) {
        if (have.has(name)) continue;
        db.exec(`ALTER TABLE ${quote(table)} ADD COLUMN ${columnName(name)} ${type}`);
        added = true;
      }
      // A new column is null until the stored row is written again. Do that
      // once here, so a later catch-up can skip a row whose stamp did not change.
      const probe = db.prepare('SELECT 1');
      if (added && probe && typeof probe.get === 'function') {
        const rows = read(db, table);
        if (rows.length) writeRows(db, table, rows);
      }
    }
  } finally {
    aligning = false;
  }
}

function ensure(db) {
  align(db);
}

function has(table) {
  return Object.prototype.hasOwnProperty.call(SPECS, String(table));
}

function names() {
  return Object.keys(SPECS);
}

function count(db, table) {
  if (!has(table)) return 0;
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${quote(table)}`).get();
  return row ? row.n : 0;
}

function clear(db, table) {
  if (!has(table)) return 0;
  return db.prepare(`DELETE FROM ${quote(table)}`).run().changes;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function columnValue(type, value) {
  if (value == null || value === '') return null;
  if (type === 'REAL') return num(value);
  return String(value);
}

function writeRows(db, table, rows) {
  const spec = SPECS[table];
  const names = spec.columns.map(([name]) => name);
  const sql = `INSERT INTO ${quote(table)} (id_key, ${names.join(', ')}, row_json)
    VALUES (${['?'].concat(names.map(() => '?'), '?').join(', ')})
    ON CONFLICT(id_key) DO UPDATE SET
      ${names.map((name) => `${name} = excluded.${name}`).join(', ')},
      row_json = excluded.row_json`;
  const write = db.prepare(sql);
  const executeMany = db.transaction((items) => {
    let n = 0;
    for (const raw of items || []) {
      if (!raw || raw.id == null) continue;
      const row = Object.assign({}, raw);
      for (const field of SECRET) delete row[field];
      if (row.is_deleted == null) row.is_deleted = 0;
      if (table === 'stock_batches') {
        if (row.status == null || row.status === '') row.status = 'ACTIVE';
        if (row.quantity == null) row.quantity = 0;
        if (row.quantity_reserved == null) row.quantity_reserved = 0;
      }
      const values = spec.columns.map(([name, type]) => columnValue(type, row[name]));
      write.run(String(row.id), ...values, JSON.stringify(row));
      n += 1;
    }
    return n;
  });
  return executeMany(rows);
}

function upsert(db, table, rows) {
  if (!has(table)) return 0;
  align(db);
  return writeRows(db, table, rows);
}

function read(db, table) {
  if (!has(table) || !count(db, table)) return [];
  const spec = SPECS[table];
  return db.prepare(`SELECT * FROM ${quote(table)}`).all().map((hit) => {
    let row = {};
    try { row = JSON.parse(hit.row_json) || {}; } catch (err) { row = {}; }
    const merged = Object.assign({}, row);
    for (const [name, type] of spec.columns) {
      if (hit[name] == null) continue;
      merged[name] = type === 'REAL' ? Number(hit[name]) : hit[name];
    }
    if (merged.id == null) merged.id = hit.id_key;
    return merged;
  });
}


function get(db, table, id) {
  if (!has(table)) return null;
  const spec = SPECS[table];
  let hit = null;
  try {
    hit = db.prepare(`SELECT * FROM ${quote(table)} WHERE id_key = ?`).get(String(id));
  } catch (e) { return null; }
  if (!hit) return null;
  let row = {};
  try { row = JSON.parse(hit.row_json) || {}; } catch (err) { row = {}; }
  const merged = Object.assign({}, row);
  for (const [name, type] of spec.columns) {
    if (hit[name] == null) continue;
    merged[name] = type === 'REAL' ? Number(hit[name]) : hit[name];
  }
  if (merged.id == null) merged.id = hit.id_key;
  return merged;
}


function changedOnly(db, table, rows) {
  if (!has(table)) return rows;
  const spec = SPECS[table];
  const hasCol = spec.columns.some(([name]) => name === 'updated_at');
  const out = [];
  let stmt = null;
  try {
    if (hasCol) {
      stmt = db.prepare(`SELECT updated_at FROM ${quote(table)} WHERE id_key = ?`);
    } else {
      stmt = db.prepare(`SELECT row_json FROM ${quote(table)} WHERE id_key = ?`);
    }
  } catch (e) {
    return rows;
  }
  
  for (const row of rows || []) {
    if (!row || row.id == null) continue;
    const next = row.updated_at == null || row.updated_at === '' ? null : String(row.updated_at);
    if (!next) { out.push(row); continue; }
    
    const hit = stmt.get(String(row.id));
    if (!hit) { out.push(row); continue; }
    
    let prev = null;
    if (hasCol && hit.updated_at !== undefined) {
      prev = hit.updated_at != null && hit.updated_at !== '' ? String(hit.updated_at) : null;
    } else {
      let local = {};
      try { local = JSON.parse(hit.row_json) || {}; } catch (e) {}
      prev = local.updated_at != null && local.updated_at !== '' ? String(local.updated_at) : null;
    }
    
    if (prev !== next) out.push(row);
  }
  return out;
}

function syncJson(db, table, id) {
  if (!has(table)) return null;
  const hit = db.prepare(`SELECT * FROM ${quote(table)} WHERE id_key = ?`).get(String(id));
  if (!hit) return null;
  let row = {};
  try { row = JSON.parse(hit.row_json) || {}; } catch (err) { row = {}; }
  for (const [name, type] of SPECS[table].columns) {
    if (hit[name] == null) continue;
    row[name] = type === 'REAL' ? Number(hit[name]) : hit[name];
  }
  row.id = hit.id_key;
  db.prepare(`UPDATE ${quote(table)} SET row_json = ? WHERE id_key = ?`).run(JSON.stringify(row), hit.id_key);
  return row;
}

// The shop's on-hand query. Quantity is base units. Quarantine and expired
// batches are not in hand. A bill's reserved units stay in on_shelf and come
// out of available. This till's own queued sale is already in quantity.
const ON_HAND_SQL = `
  SELECT p.id AS product_id,
         sb.branch_id AS branch_id,
         p.sku AS sku,
         p.name AS name,
         p.base_unit_name AS base_unit_name,
         p.reorder_level AS reorder_level,
         p.selling_price AS selling_price,
         p.cost_price AS book_cost,
         p.requires_serial AS requires_serial,
         p.tracks_variants AS tracks_variants,
         p.has_expiry AS has_expiry,
         p.nafdac_catalog_id AS nafdac_catalog_id,
         c.name AS category_name,
         c.code AS category_code,
         (SELECT parent.code FROM product_categories parent
           WHERE parent.id_key = c.parent_id AND parent.is_deleted = 0) AS category_parent_code,
         COALESCE(SUM(sb.quantity), 0) AS on_shelf,
         COALESCE(SUM(sb.quantity_reserved), 0) AS reserved,
         COALESCE(SUM(sb.quantity - sb.quantity_reserved), 0) AS available,
         COALESCE(SUM(sb.quantity * COALESCE(sb.cost_price_per_unit, 0)), 0) AS stock_value,
         COUNT(sb.id_key) AS batch_count,
         MIN(sb.expiry_date) AS next_expiry
    FROM stock_batches sb
    JOIN products p ON p.id_key = sb.product_id AND p.is_deleted = 0
    LEFT JOIN product_categories c ON c.id_key = p.category_id
   WHERE sb.is_deleted = 0
     AND sb.status NOT IN ('QUARANTINED', 'EXPIRED')
     AND (? = '' OR sb.branch_id = ?)
   GROUP BY p.id_key
   ORDER BY p.name`;

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function stockOnHand(db, branchId) {
  ensure(db);
  if (!count(db, 'stock_batches') || !count(db, 'products')) return [];
  const asked = branchId == null || branchId === '' ? '' : String(branchId);
  let rows = db.prepare(ON_HAND_SQL).all(asked, asked);
  if (!rows.length && asked) {
    const present = db.prepare(`SELECT DISTINCT branch_id AS id FROM stock_batches WHERE is_deleted = 0 AND branch_id IS NOT NULL`).all();
    if (present.length === 1 && present[0].id) rows = db.prepare(ON_HAND_SQL).all(String(present[0].id), String(present[0].id));
  }
  return rows.map((row) => ({
    product_id: row.product_id,
    branch_id: row.branch_id,
    sku: row.sku,
    name: row.name,
    base_unit_name: row.base_unit_name,
    reorder_level: Number(row.reorder_level) || 0,
    selling_price: Number(row.selling_price) || 0,
    book_cost: Number(row.book_cost) || 0,
    requires_serial: row.requires_serial,
    tracks_variants: row.tracks_variants,
    has_expiry: row.has_expiry,
    nafdac_catalog_id: row.nafdac_catalog_id,
    category_name: row.category_name,
    category_code: row.category_code,
    category_parent_code: row.category_parent_code,
    on_shelf: round2(row.on_shelf),
    reserved: round2(row.reserved),
    available: round2(row.available),
    stock_value: round2(row.stock_value),
    batch_count: Number(row.batch_count) || 0,
    next_expiry: row.next_expiry || null,
  }));
}

// The sell screen's "on hand" is not every batch. The shop counts only stock
// that arrived on a received purchase order, still active, still free.
const RECEIVED_SQL = `
  SELECT p.id_key AS product_id,
         COALESCE(SUM(sb.quantity - sb.quantity_reserved), 0) AS on_hand
    FROM stock_batches sb
    JOIN products p ON p.id_key = sb.product_id AND p.is_deleted = 0
    JOIN purchase_orders po ON po.id_key = sb.purchase_order_id
     AND po.is_deleted = 0
     AND po.status IN ('PARTIALLY_RECEIVED', 'RECEIVED')
   WHERE sb.is_deleted = 0
     AND sb.status = 'ACTIVE'
     AND (? = '' OR sb.branch_id = ?)
   GROUP BY p.id_key`;

function receivedOnHand(db, branchId) {
  ensure(db);
  if (!count(db, 'purchase_orders') || !count(db, 'stock_batches')) return null;
  const asked = branchId == null || branchId === '' ? '' : String(branchId);
  let rows = db.prepare(RECEIVED_SQL).all(asked, asked);
  if (!rows.length && asked) {
    const present = db.prepare(`SELECT DISTINCT branch_id AS id FROM stock_batches WHERE is_deleted = 0 AND branch_id IS NOT NULL`).all();
    if (present.length === 1 && present[0].id) rows = db.prepare(RECEIVED_SQL).all(String(present[0].id), String(present[0].id));
  }
  return rows.map((row) => ({ product_id: row.product_id, on_hand: round2(row.on_hand) }));
}

module.exports = {
  ensure,
  has,
  names,
  count,
  clear,
  upsert,
  read,
  get,
  changedOnly,
  syncJson,
  stockOnHand,
  receivedOnHand,
  ddl,
};
