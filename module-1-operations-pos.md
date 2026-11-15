# Module 1: Operations & Point of Sale (The "Front Office" Module)

**Scope:** Everything related to directly serving a customer, moving goods out the door, and capturing money at the counter.

- **POS & Cart (pos.js):** The main cashier interface.
- **Sales Ledger (sales.js):** Real-time sales logging, filtering, and printing receipts.
- **Change Owed / Credit (change-owed.js, instalments.js):** Handling split payments, IOUs, and customer credit lines.
- **Returns & After-Sales (returns.js, afterSales.js):** Refund workflows and warranty management.
- **Till Management (till.js):** Shift opening/closing, initial floats, and cashier handovers.

## 🔎 Agent Audit Checkpoint & Module Dependencies
- **Status:** PILOT AUDIT COMPLETED.
- **Dependency Map:** Heavily relies on `Inventory (Module 2)` for `sellableIndex()` resolution and `reorder_level` alarms. Integrates with `Accounting (Module 3)` for real-time COGS calculations.
- **Recent Weakness Addressed:** `U.sellingGroup` reference errors on POS categorization when searching. Fixed by establishing core grouping utility mapping directly into `util.js`.
- **Known Gaps / Action Items:** 
  1. Offline POS search fallback currently assumes pre-fetched stores. Needs explicit try-catch chains to prevent UI stalls if IndexedDB `product_barcodes` store becomes corrupted during sync intervals.
