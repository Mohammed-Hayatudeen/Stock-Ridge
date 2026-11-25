# M2 — Inventory & Supply Chain ("Warehouse") · Knowledge file

## Protected Fixes
| ID | Date | Symptom | Root cause | Fix (files / functions) | Regression check |
|----|------|---------|------------|-------------------------|------------------|

## Change Register
### M2-20261125-01 — Catalogue UI Organization & Sticky Filters (2026-11-25)
- **What / how / why:** Improved the Catalogue UI mapping to resolve screen crowding and fixed broken search interactions. The top filtering toolbar (Search & Category Dropdown) was converted to a sticky `.section-dock.row` to remain accessible while scrolling. The Search `qInput` lacked an event listener, causing searches to fail silently; injected `ui.debounceInput` to trigger live `load()` renders. Finally, re-architected the `paintShelves()` category cards—which previously stacked vertically, taking up massive viewport space—into a clean, horizontal Tab list (`role='tablist'`) synchronized bidirectionally with the Category Dropdown.
- **Affected (files, functions, data, UI):** `public/js/views/products.js` (toolbar, qInput, catSel, paintShelves, addTab).
- **Verification evidence:** `npm test` validates. The UI logically collapses category views behind functional tabs, and scrolling keeps the filter bar docked safely below the native header.
- **Fix status:** Worked (2026-11-25)

### M2-20261123-02 — Complete Removal of UI Pharmaceutical Category Exclusions (2026-11-23)
- **What / how / why:** Discovered that despite adding NAFDAC drugs to the Pharmaceutical category, they were forcibly hidden from the category dropdowns in POS, Reporting, Sales, and Accounting views because the UI actively filtered out `PHARMACEUTICALS` natively (e.g. `!['PHARMACEUTICALS', 'NON_PHARMACEUTICALS'].includes(...)`). Re-wrote the exclusions across `pos.js`, `accounting.js`, `reports.js`, and `stock.js` to only exclude `NON_PHARMACEUTICALS`, restoring NAFDAC product visibility across all inventory routing nodes. Also fixed a backend bug where selecting "All categories" hijacked the product payload and queried only the greenbook list.
- **Affected (files, functions, data, UI):** `public/js/views/pos.js`, `public/js/views/accounting.js`, `public/js/views/reports.js`, `public/js/views/sales.js`, `public/js/views/stock.js`, `server/routes/catalog.js`.
- **Verification evidence:** Validated search and fetch exclusions natively. `Pharmaceuticals` is now correctly parsed and selectable.
- **Fix status:** Worked (2026-11-23)

### M2-20261123-01 — Category UI Simplification & Pharmaceutical Pinning (2026-11-23)
- **What / how / why:** Removed legacy explanatory text from the UI ("One list. A category counts as pharmaceuticals or as others...") because it was confusing and obsolete. Replaced it with cleaner phrasing explaining that NAFDAC drugs are automatically anchored to the Pharmaceutical category, which is automatically provided for the Pharmacy business vertical. Also removed the UI filter that hid the Pharmaceutical category from manual product edits and the offline index cache, ensuring that the pharmacy vertical consistently displays the category.
- **Affected (files, functions, data, UI):** `public/js/views/products.js`.
- **Verification evidence:** Code updated successfully. NAFDAC drugs and normal catalog definitions now share cleaner UI rules regarding category classifications.
- **Fix status:** Worked (2026-11-23)

### M2-20261107-02 — Product Category Field Refactoring (2026-11-07)
- **What / how / why:** The category creation and edit modals contained an extraneous "Counts as" (`selling_group`) field meant to separate "Pharmaceuticals" from "Others". Because NAFDAC adoptions inherently bypass this manual UI via the fixed `PHARMACEUTICALS` category creation (`ensurePharmaceuticalCategory`) and the `U.sellingGroup()` logic uses `nafdac_catalog_id` directly, the manual UI field was redundant and mathematically ignored on the backend. Removed `selling_group` entirely from the product view modals to satisfy the strict two-field constraint (Business Vertical + Category Name).
- **Affected (files, functions, data, UI):** `public/js/views/products.js` (`createCategory`, `editCategory`).
- **Verification evidence:** UI now restricts category creation strictly to Business Vertical and Name. NAFDAC products seamlessly retain their "Pharmaceuticals" label because `U.sellingGroup(row)` inherently detects `nafdac_catalog_id` independent of any manual category flags.
- **Fix status:** Worked (2026-11-07)

### M2-20261107-01 — Strict Negative Stock Remote Validation Locks (2026-11-07)
- **What / how / why:** Discovered that heavy concurrent transaction volume could force `stock_batches` into negative quantities or negative available stock (quantity - reserved). Because Turso executes queued UPDATE statements within an atomic transaction without throwing application errors if 0 rows are affected (due to a failed WHERE clause `quantity - reserved >= ?`), race-condition sales were succeeding without deducting stock. Created migration `0005_strict_stock_locking.sql` implementing a `BEFORE UPDATE` trigger on `stock_batches` that executes a `RAISE(ABORT)` constraint if quantity drops below zero, strictly enforcing remote validation locks at the SQLite engine layer.
- **Affected (files, functions, data, UI):** `schema/migrations/0005_strict_stock_locking.sql` (Database Engine layer), `server/routes/sales.js`.
- **Verification evidence:** Checked against Turso transaction behavior; `RAISE(ABORT)` guarantees absolute atomic rollback of the entire HTTP batch transaction if stock falls below limits.
- **Fix status:** Worked (2026-11-07)

### M2-20261118-01 — Simplified Product Category Creation (2026-11-18)
- **What / how / why:** To enforce allocated entity limits and simplify the UI, the Product Category creation flow was updated to exactly two fields: "Business Vertical" and "Category Name". The frontend previously asked for a specific "Business", creating cognitive dissonance because categories are actually replicated across the entire Business Vertical (`profile_code`). Mapped the input strictly to available verticals and updated the descriptor to ensure NAFDAC catalogues strictly align automatically with the Pharmaceutical vertical without breaking downstream flows.
- **Affected (files, functions, data, UI):** `public/js/views/products.js`.
- **Verification evidence:** The `addCategory` UI now strictly displays only exactly two fields ("Business Vertical" and "Category Name"). 
- **Fix status:** Worked (2026-11-18)

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
