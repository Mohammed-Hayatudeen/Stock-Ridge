'use strict';

const { newId } = require('../domain/crypto');
const salesService = require('../server/services/salesService');

/** Real specialized workflows against the isolated simulation database. */
async function runSpecialized({ db, app, businesses, owner, settings, scope, secret, token, setClock }) {
  const results = [];
  const errors = [];
  let sequence = 0;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setClock('2026-11-08 12:00:00');
  await db.run('UPDATE client_settings SET serial_tracking_enabled=1 WHERE id=1');
  settings.serial_tracking_enabled = 1;

  async function api(method, requestPath, body = null) {
    sequence += 1;
    const response = await app.fetch(method, requestPath, {
      headers: {
        Authorization: `Bearer ${token}`, 'X-Device-Id': 'sim-owner',
        'Content-Type': 'application/json', 'Idempotency-Key': `special-${runId}-${sequence}`,
      },
      body: body == null ? null : JSON.stringify(body),
      env: { DB: db, db, JWT_SECRET: secret },
    });
    const text = await response.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    if (response.status >= 400) {
      const error = new Error(`${method} ${requestPath}: ${response.status} ${parsed.code || ''} ${parsed.error || ''}`);
      error.response = parsed;
      throw error;
    }
    return parsed;
  }

  async function financialTrace(workflow, sourceType, sourceId) {
    const entries = await db.all(`SELECT id,source_type,source_id FROM gl_journal_entries
      WHERE source_type=? AND source_id=? AND is_deleted=0`, [sourceType, sourceId]);
    const balances = [];
    for (const entry of entries) {
      const balance = await db.first(`SELECT ROUND(SUM(debit),2) AS debit,ROUND(SUM(credit),2) AS credit
        FROM gl_journal_lines WHERE journal_entry_id=?`, [entry.id]);
      balances.push(balance);
    }
    const ok = entries.length > 0 && balances.every((b) => Math.abs(Number(b.debit) - Number(b.credit)) <= 0.02);
    if (!ok) throw new Error(`${workflow}: missing or unbalanced ${sourceType}/${sourceId} journal`);
    return { entries: entries.length, balanced: true };
  }

  async function auditTrace(entityType, entityId) {
    const rows = await db.scalar('SELECT COUNT(*) FROM audit_log WHERE entity_type=? AND entity_id=?', [entityType, entityId]);
    if (!Number(rows)) throw new Error(`${entityType}/${entityId}: missing audit trace`);
    return { auditRows: Number(rows) };
  }

  async function run(name, fn) {
    try {
      const detail = await fn();
      results.push({ workflow: name, ok: true, ...detail });
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
      results.push({ workflow: name, ok: false, error: error.message });
    }
  }

  const primary = businesses[0];
  const branch = primary.branches[0];
  const product = primary.products[0];

  await run('purchase-order-receipt', async () => {
    const supplierId = newId();
    await db.run("INSERT INTO suppliers (id,business_id,name,created_at,updated_at) VALUES (?,?,?,datetime('now'),datetime('now'))",
      [supplierId, primary.id, 'Simulation Supplier']);
    const created = await api('POST', '/api/purchase-orders', {
      branch_id: branch.id, business_id: primary.id, supplier_id: supplierId,
      items: [{ product_id: product.id, quantity: 5, expected_unit_cost: product.cost_price }], wht_code: null,
    });
    const item = await db.first('SELECT * FROM purchase_order_items WHERE purchase_order_id=?', [created.id]);
    const received = await api('POST', `/api/purchase-orders/${created.id}/receive`, {
      receipts: [{ item_id: item.id, quantity_received: item.quantity_in_base, cost_per_unit: product.cost_price }],
      paid_now: 5 * Number(product.cost_price), on_credit: 0,
    });
    return { id: created.id, received: received.ok, books: await financialTrace('purchase', 'PURCHASE', created.id), ...(await auditTrace('PURCHASE_ORDER', created.id)) };
  });

  await run('sale-return-refund', async () => {
    const sale = await db.first("SELECT * FROM sales WHERE status='COMPLETED' ORDER BY created_at LIMIT 1");
    const item = await db.first('SELECT * FROM sale_items WHERE sale_id=? LIMIT 1', [sale.id]);
    const returned = await api('POST', '/api/returns', {
      sale_id: sale.id, reason_code: 'CUSTOMER_CHANGE_OF_MIND', refund_method: 'CASH', restock: true,
      notes: 'Owner-approved simulation return outside the ordinary window',
      items: [{ sale_item_id: item.id, quantity: 1, unit_code: item.unit_code, condition: 'RESALABLE' }],
    });
    return { id: returned.id, books: await financialTrace('return', 'SALE_RETURN', returned.id), ...(await auditTrace('SALE_RETURN', returned.id)) };
  });

  await run('branch-transfer-receive', async () => {
    const created = await api('POST', '/api/transfers', {
      from_branch_id: primary.branches[0].id, to_branch_id: primary.branches[1].id,
      items: [{ product_id: product.id, quantity: 2 }], reference: `SIM-TRF-${Date.now()}`,
    });
    await api('POST', `/api/transfers/${created.id}/receive`, { branch_id: primary.branches[1].id });
    const status = await db.scalar('SELECT status FROM stock_transfers WHERE id=?', [created.id]);
    if (status !== 'RECEIVED') throw new Error(`transfer status ${status}`);
    return { id: created.id, status, books: await financialTrace('transfer', 'TRANSFER', created.id), ...(await auditTrace('STOCK_TRANSFER', created.id)) };
  });

  await run('attendance-clock-review', async () => {
    const clocked = await api('POST', '/api/attendance/clock-in', {
      branch_id: branch.id, device_id: 'sim-attendance', method: 'MANUAL', notes: 'Local simulation attendance',
    });
    await api('POST', '/api/attendance/clock-out', { branch_id: branch.id });
    return { id: clocked.id, ...(await auditTrace('ATTENDANCE', clocked.id)), accounting: 'non-financial; audit trace required' };
  });

  await run('customer-credit-sale', async () => {
    const customerId = newId();
    await db.run("INSERT INTO customers (id,business_id,branch_id,name,phone,credit_limit,created_at,updated_at) VALUES (?,?,?,?,?,100000,datetime('now'),datetime('now'))",
      [customerId, primary.id, branch.id, 'Simulation Credit Customer', '08000000003']);
    const customer = await db.first('SELECT * FROM customers WHERE id=?', [customerId]);
    const params = {
      branch, business: primary, user: owner, settings, scope, customer,
      lines: [{ productId: product.id, quantity: 1 }], saleType: 'WHOLESALE', priceLists: [], payments: [],
    };
    const preview = await salesService.prepare(db, params);
    params.payments = [{ method: 'CREDIT', amount: preview.totals.total }];
    const sale = await salesService.complete(db, params);
    const debtor = await db.scalar("SELECT COUNT(*) FROM debtor_ledger WHERE reference_id=? AND entry_type='SALE'", [sale.saleId]);
    if (!Number(debtor)) throw new Error('Missing debtor ledger entry');
    return { id: sale.saleId, debtorRows: Number(debtor), books: await financialTrace('credit sale', 'SALE', sale.saleId) };
  });

  await run('instalment-plan-payment', async () => {
    await db.run('UPDATE client_settings SET instalment_module_enabled=1 WHERE id=1');
    settings.instalment_module_enabled = 1;
    const customerId = newId();
    await db.run("INSERT INTO customers (id,business_id,branch_id,name,phone,created_at,updated_at) VALUES (?,?,?,?,?,datetime('now'),datetime('now'))",
      [customerId, primary.id, branch.id, 'Simulation Instalment Customer', '08000000002']);
    const plan = await api('POST', '/api/instalments', {
      branch_id: branch.id, business_id: primary.id, customer_id: customerId,
      principal: 1000, deposit_amount: 200, tenure_months: 2, frequency: 'MONTHLY', interest_percent: 10,
      schedule_start: '2026-11-08', guarantor_name: 'Simulation Guarantor',
    });
    const due = await db.first('SELECT * FROM instalment_schedule WHERE plan_id=? ORDER BY seq LIMIT 1', [plan.id]);
    const paid = await api('POST', `/api/instalments/${plan.id}/payments`, { amount: due.amount_due, method: 'CASH' });
    await financialTrace('instalment payment', 'INSTALMENT', paid.id);
    const payment = await db.scalar('SELECT COUNT(*) FROM instalment_payments WHERE plan_id=?', [plan.id]);
    if (!Number(payment)) throw new Error('Missing instalment payment allocation');
    return { id: plan.id, paymentRows: Number(payment), books: await financialTrace('instalment', 'INSTALMENT', plan.id), ...(await auditTrace('INSTALMENT_PLAN', plan.id)) };
  });

  const rentalBusiness = businesses.find((b) => b.profile_code === 'EVENT_RENTAL');
  await run('hire-agreement-return', async () => {
    if (!rentalBusiness) throw new Error('No rental business');
    const rentalProduct = await db.first(`SELECT * FROM products WHERE business_id=? AND offers_hire=1
      AND requires_serial=0 AND tracks_variants=0 AND hire_price_per_day>0 LIMIT 1`, [rentalBusiness.id]);
    const rentalBranch = rentalBusiness.branches[0];
    await db.run(`INSERT INTO stock_batches (id,branch_id,business_id,product_id,cost_price_per_unit,selling_price_per_unit,
      quantity,initial_quantity,status) VALUES (?,?,?,?,?,?,100,100,'ACTIVE')`,
    [newId(), rentalBranch.id, rentalBusiness.id, rentalProduct.id, rentalProduct.cost_price, rentalProduct.selling_price]);
    const params = {
      branch: rentalBranch, business: rentalBusiness, user: owner, settings, scope,
      lines: [{ productId: rentalProduct.id, quantity: 1, channel: 'HIRE', startsOn: '2026-11-10', endsOn: '2026-11-12' }],
      tradeModes: ['HIRE'], saleType: 'RETAIL', priceLists: [], payments: [],
      walkInName: 'Simulation Customer', walkInPhone: '08000000001',
    };
    const preview = await salesService.prepare(db, params);
    params.payments = [{ method: 'CASH', amount: preview.totals.total + Number(preview.depositDue || 0) }];
    const sale = await salesService.complete(db, params);
    const agreement = await db.first('SELECT * FROM asset_agreements WHERE sale_id=?', [sale.saleId]);
    const returned = await api('POST', `/api/agreements/${agreement.id}/return`, { condition: 'GOOD' });
    return { id: agreement.id, returned: returned.ok, books: await financialTrace('hire', 'SALE', agreement.id) };
  });

  const electronics = businesses.find((b) => b.profile_code === 'ELECTRONICS');
  await run('serial-sale-history', async () => {
    if (!electronics) throw new Error('No electronics business');
    const serialProduct = await db.first(`SELECT * FROM products WHERE business_id=? AND requires_serial=1
      AND tracks_variants=0 AND offers_sale=1 LIMIT 1`, [electronics.id]);
    const serialBranch = electronics.branches[0];
    const batchId = newId();
    const serialNo = `SIM-${Date.now()}`;
    await db.run(`INSERT INTO stock_batches (id,branch_id,business_id,product_id,cost_price_per_unit,selling_price_per_unit,
      quantity,initial_quantity,status) VALUES (?,?,?,?,?,?,1,1,'ACTIVE')`,
    [batchId, serialBranch.id, electronics.id, serialProduct.id, serialProduct.cost_price, serialProduct.selling_price]);
    await db.run(`INSERT INTO serial_numbers (id,product_id,serial_no,batch_id,branch_id,status)
      VALUES (?,?,?,?,?,'IN_STOCK')`, [newId(), serialProduct.id, serialNo, batchId, serialBranch.id]);
    const params = {
      branch: serialBranch, business: electronics, user: owner, settings, scope,
      lines: [{ productId: serialProduct.id, quantity: 1, serialNumbers: [serialNo] }],
      saleType: 'RETAIL', priceLists: [], payments: [],
    };
    const preview = await salesService.prepare(db, params);
    params.payments = [{ method: 'CASH', amount: preview.totals.total }];
    const sale = await salesService.complete(db, params);
    const history = await api('GET', `/api/serials/${encodeURIComponent(serialNo)}`);
    return { id: sale.saleId, history: history.ok, books: await financialTrace('serial sale', 'SALE', sale.saleId) };
  });

  const pharmacy = businesses.find((b) => b.profile_code === 'PHARMACEUTICAL');
  await run('controlled-pharmacy-dispense', async () => {
    if (!pharmacy) throw new Error('No pharmacy business');
    const medicine = await db.first(`SELECT * FROM products WHERE business_id=? AND is_controlled=1
      AND requires_serial=0 AND tracks_variants=0 AND offers_sale=1 LIMIT 1`, [pharmacy.id]);
    if (!medicine) throw new Error('No controlled non-serial medicine in seed');
    const pharmacyBranch = pharmacy.branches[0];
    await db.run(`INSERT INTO stock_batches (id,branch_id,business_id,product_id,cost_price_per_unit,selling_price_per_unit,
      quantity,initial_quantity,status) VALUES (?,?,?,?,?,?,10,10,'ACTIVE')`,
    [newId(), pharmacyBranch.id, pharmacy.id, medicine.id, medicine.cost_price, medicine.selling_price]);
    const params = {
      branch: pharmacyBranch, business: pharmacy, user: owner, settings, scope,
      lines: [{ productId: medicine.id, quantity: 1,
        prescription: { prescriber_name: 'Simulation Doctor', prescriber_pcn_or_mdcn_no: 'SIM-001', patient_name: 'Simulation Patient' },
        controlledKyc: { buyer_name: 'Simulation Patient', buyer_phone: '08000000000', buyer_id_type: 'TEST', buyer_id_number: 'SIM-001' } }],
      saleType: 'RETAIL', priceLists: [], payments: [],
    };
    const preview = await salesService.prepare(db, params);
    params.payments = [{ method: 'CASH', amount: preview.totals.total }];
    const sale = await salesService.complete(db, params);
    const register = await db.scalar('SELECT COUNT(*) FROM controlled_substance_register WHERE sale_id=?', [sale.saleId]);
    if (!Number(register)) throw new Error('Missing controlled-substance register');
    return { id: sale.saleId, registerRows: Number(register), books: await financialTrace('pharmacy sale', 'SALE', sale.saleId) };
  });

  return { results, errors };
}

module.exports = { runSpecialized };
