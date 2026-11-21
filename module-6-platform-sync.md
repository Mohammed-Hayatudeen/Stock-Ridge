# M6 — Platform & Sync ("Infrastructure") · Knowledge file

## Protected Fixes
| ID | Date | Symptom | Root cause | Fix (files / functions) | Regression check |
|----|------|---------|------------|-------------------------|------------------|

## Change Register
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

## Impact Register (ranked, most depended-on first)
| Rank | Change ID | What depends on it | What breaks if altered, and why |
|------|-----------|--------------------|---------------------------------|
| 1 | M6-20261111-02 | Polling loops across all active devices | Returning this to brute-force fetches exceeds Turso Free Tier logical read limits, causing database lockout for all clients. |
| 2 | M6-20261111-01 | All offline delta-sync filtering (`changedOnly`) | Removing the index will drastically slow down background offline synchronization loops, crashing older Android phones via OOM. |

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
