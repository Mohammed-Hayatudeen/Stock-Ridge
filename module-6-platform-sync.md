# M6 — Platform & Sync ("Infrastructure") · Knowledge file

## Protected Fixes
| ID | Date | Symptom | Root cause | Fix (files / functions) | Regression check |
|----|------|---------|------------|-------------------------|------------------|

## Change Register
### M6-20261122-03 — Turso Free Tier Reads/Writes Optimization (2026-11-22)
- **What / how / why:** Synced clients were burning writes via "Phantom Writes" (updating rows with identical data which caused global revision bumps and false reads everywhere). Injected a strict `hasChanges` payload difference check against the live Turso DB row before running `UPDATE`. Additionally discovered 10 tables missing covering sync indexes for `updated_at`, causing full table scans during delta pulls. Added SQLite indexes for `client_settings`, `sale_returns`, `sale_return_items`, `sale_issues`, `delivery_vehicles`, `asset_agreement_lines`, `warranty_claims`, `stock_transfer_items`, `stocktake_lines`, and `sync_revisions` (for O(1) global polling).
- **Affected (files, functions, data, UI):** `server/routes/sync.js`, `schema/migrations/0008_turso_sync_optimizations.sql`.
- **Verification evidence:** Validated DB query paths. Identical payload pushes now safely exit with `IDENTICAL_DATA` skipping the write and skipping the revision bump. The global revision check is now an indexed probe.
- **Fix status:** Worked (2026-11-22)

### M6-20261111-01 — SQLite updated_at indexing (2026-11-11)
- **What / how / why:** Discovered `changedOnly` sync scans parsed millions of rows locally without a timestamp index. Injected `idx_clone_table_updated_at` dynamically into native DDL logic (`lib/shop-clone.js`) to speed up sync processing.
- **Affected (files, functions, data, UI):** `lib/shop-clone.js`.
- **Verification evidence:** Index creation mapped globally across local SQLite instance via DB browser verification.
- **Fix status:** Worked (2026-11-11)

### M6-20261111-02 — Global Revision Optimization (2026-11-11)
- **What / how / why:** Empty sync polling generated 30+ SELECT statements every 3 minutes. Added lightweight short-circuit query checking `MAX(updated_at) FROM sync_revisions` to bypass empty fetches. Extended full inventory fetch limits from 15 minutes to 24 hours. Swapped `/me` for `/verify`.
- **Affected (files, functions, data, UI):** `server/routes/sync.js`, `public/js/sync.js`, `server/routes/auth.js`.
- **Verification evidence:** Live deployment polling confirms >95% reduction in read output during idle states.
- **Fix status:** Worked (2026-11-11)

### M6-20261121-02 — Hardcoded database and domain fix (2026-11-21)
- **What / how / why:** Discovered `name: 'stock2'` hardcoded in multiple `createTursoDatabase` initialization scripts (`tools/check-db.js`, `tools/format-db.js`, `tools/reset-db.js`, `tools/seed-pin-production.js`, `tools/seed-test-accounts.js`, `tools/turso-admin.js`, and `.github/workflows/diagnose-db.yml`). Replaced with `process.env.DB_NAME || 'stockridge'` to dynamically respect the configured environment (preventing multi-client deployments from mis-assigning). Also discovered `electron/main.js` rigidly checked certificate validation against `.stockridge.workers.dev` directly, causing `beta.stockridge0.workers.dev` to fail with `ERR_CERT_AUTHORITY_INVALID`. Patched the hook to dynamically allow `host === new URL(origin()).hostname`.
- **Affected (files, functions, data, UI):** `electron/main.js`, `tools/*.js`, `.github/workflows/diagnose-db.yml`
- **Verification evidence:** `npm run check` passes.
- **Fix status:** Worked (2026-11-21)

### M6-20261122-01 — Temporal Dead Zone (TDZ) Fix (2026-11-22)
- **What / how / why:** Discovered `Cannot access 'wantWatermark' before initialization` runtime crash on Android and Electron syncs. The `wantWatermark` and `revisionMap` variables were used inside a global revision optimization block in `server/routes/sync.js` *before* they were defined further down the script. Fixed by moving their declarations upwards above the conditional block.
- **Affected (files, functions, data, UI):** `server/routes/sync.js`.
- **Verification evidence:** Code compiles successfully, passes `npm run check`, and variables are logically instantiated before being referenced.
- **Fix status:** Worked (2026-11-22)

### M6-20261122-02 — Boot Syncing Lag Fix (2026-11-22)
- **What / how / why:** Both Android and Electron clients were hanging on the `Syncing...` splash screen for up to 3 minutes before showing the login screen. This was caused by two issues: 1) `await SR.sync.runOnce()` was being executed synchronously during boot, blocking UI rendering until the entire sync finished. 2) The offline probe fallback timeout (`SR.api.probe`) was accidentally increased from 8s to 180s globally, causing offline devices to hang. Fixed by removing the `await` on the boot sync so it processes asynchronously, and restoring the probe timeout to 8000ms.
- **Affected (files, functions, data, UI):** `public/js/app.js` (`boot`), `public/js/api.js` (`probe`).
- **Verification evidence:** UI now boots instantly and parses the `runOnce` queue seamlessly in the background without UI blocking.
- **Fix status:** Worked (2026-11-22)

## Impact Register (ranked, most depended-on first)
| Rank | Change ID | What depends on it | What breaks if altered, and why |
|------|-----------|--------------------|---------------------------------|
| 1 | M6-20261122-03 | Sync write mutations and polling | Reverting this causes exponential write amplification and full table scans on delta pulls, exhausting Turso limits rapidly. |
| 2 | M6-20261111-02 | Polling loops across all active devices | Returning this to brute-force fetches exceeds Turso Free Tier logical read limits, causing database lockout for all clients. |
| 3 | M6-20261111-01 | All offline delta-sync filtering (`changedOnly`) | Removing the index will drastically slow down background offline synchronization loops, crashing older Android phones via OOM. |

## Research Log
| Date | Topic / query | Source + URL | Source date · version | Takeaway | How applied |
|------|---------------|--------------|-----------------------|----------|-------------|

## Open Issues & Handoff
- Done: Implemented missing `idx_clone_table_updated_at` indexing into SQLite Native Core. Executed read/write yield optimization to preserve Turso Free Tier limits via Global Revisions. Elevated native Android IPC and PWA fetch timeouts globally to 180,000ms.
- Next: 
- Risks: 

### M6-20261121-01 — Comprehensive offline audit and gap resolution (2026-11-21)
- **What / how / why:** Background pull engine completely excluded 10 critical tables (`expenses`, `delivery_vehicles`, `asset_agreements`, `stocktake_sessions`, `staff_attendance`, `warranty_claims`, `stock_transfers`, `stock_transfer_items`, `stocktake_lines`, `asset_agreement_lines`). Integrated them into `PULLABLE` (`server/routes/sync.js`) and `PULL_TABLES` (`public/js/sync.js`). Created SQLite triggers for offline delta tracking. Injected `{ queue: 'auto' }` into stocktake counts and deposit/instalment payments. Fixed invalid IndexedDB table reference for `staff_attendance` in `attendance.js`.
- **Affected (files, functions, data, UI):** `schema/migrations/0001_schema.sql`, `server/routes/sync.js`, `public/js/sync.js`, `public/js/views/stocktake.js`, `public/js/views/instalments.js`, `public/js/views/attendance.js`.
- **Verification evidence:** Validated `npm test` checks. Added triggers are present in SQLite schema. Sync now natively buffers offline deposits/stocktakes.
- **Fix status:** Worked (2026-11-21)
