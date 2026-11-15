# Module 2: Inventory & Supply Chain (The "Warehouse" Module)

**Scope:** Physical goods moving into the business, cataloging, moving between branches, and auditing.

- **Catalogue / Products (products.js, catalog.js):** Master data management (unit ladders, variants, base margins, selling groups).
- **Stock & Batches (stock.js):** Real-time on-hand quantities, expiry tracking, serial numbers, and reorder levels.
- **Purchase Orders & Suppliers (purchase-orders.js, suppliers.js):** Interfacing with vendors and forecasting.
- **Internal Transfers (transfers.js):** Moving goods between branches (e.g., from HQ warehouse to Karu branch).
- **Stocktake (stocktake.js):** Physical inventory counts and shrinkage adjustments.

## 🔎 Agent Audit Checkpoint & Module Dependencies
- **Status:** PILOT AUDIT COMPLETED.
- **Dependency Map:** Upstream dependent on `Admin (Module 4)` for Role guards (Only Owners/Managers can authorize manual shrinkage or `cost_price` overrides). 
- **Recent Weakness Addressed:** Implemented offline-catalogue scoping by `business_id` rather than `user_id` to prevent multi-cashier catalogue drops.
- **Known Gaps / Action Items:** 
  1. Negative stock quantity prevention relies heavily on local sync states. Needs tighter remote validation locking during heavy concurrent transaction volumes across multiple branches.
