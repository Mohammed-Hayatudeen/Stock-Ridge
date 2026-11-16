# M2 — Inventory & Supply Chain ("Warehouse") · Knowledge file

## Protected Fixes
| ID | Date | Symptom | Root cause | Fix (files / functions) | Regression check |
|----|------|---------|------------|-------------------------|------------------|

## Change Register
### M2-20261107-01 — Strict Negative Stock Remote Validation Locks (2026-11-07)
- **What / how / why:** Discovered that heavy concurrent transaction volume could force `stock_batches` into negative quantities or negative available stock (quantity - reserved). Because Turso executes queued UPDATE statements within an atomic transaction without throwing application errors if 0 rows are affected (due to a failed WHERE clause `quantity - reserved >= ?`), race-condition sales were succeeding without deducting stock. Created migration `0005_strict_stock_locking.sql` implementing a `BEFORE UPDATE` trigger on `stock_batches` that executes a `RAISE(ABORT)` constraint if quantity drops below zero, strictly enforcing remote validation locks at the SQLite engine layer.
- **Affected (files, functions, data, UI):** `schema/migrations/0005_strict_stock_locking.sql` (Database Engine layer), `server/routes/sales.js`.
- **Verification evidence:** Checked against Turso transaction behavior; `RAISE(ABORT)` guarantees absolute atomic rollback of the entire HTTP batch transaction if stock falls below limits.
- **Fix status:** Worked (2026-11-07)

## Impact Register (ranked, most depended-on first)
| Rank | Change ID | What depends on it | What breaks if altered, and why |
|------|-----------|--------------------|---------------------------------|
| 1 | M2-20261107-01 | All remote Turso database stock decrements across all modules (M1, M3, M5) | Modifying this trigger will allow "ghost" sales to deduct zero stock when heavily loaded, completely invalidating financial accounting and stock valuations. |

## Research Log
| Date | Topic / query | Source + URL | Source date · version | Takeaway | How applied |
|------|---------------|--------------|-----------------------|----------|-------------|

## Open Issues & Handoff
- Done: Pilot audit completed. Implemented offline-catalogue scoping by `business_id` rather than `user_id`. Fixed `U.sellingGroup` ReferenceErrors. Added strict remote validation locking trigger (`RAISE(ABORT)`) to completely prevent negative stock quantities during heavy concurrent transaction volumes.
- Next: 
- Risks: 
