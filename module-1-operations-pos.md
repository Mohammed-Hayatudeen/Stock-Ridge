# M1 — Operations & Point of Sale ("Front Office") · Knowledge file

## Protected Fixes
| ID | Date | Symptom | Root cause | Fix (files / functions) | Regression check |
|----|------|---------|------------|-------------------------|------------------|

## Change Register
### M1-20261107-01 — IndexedDB Product Barcodes and Customers UI Stalls (2026-11-07)
- **What / how / why:** Added explicit `.catch(() => null)` and `.catch(() => [])` chains to `SR.store.get('products')` and `SR.store.all('customers')` inside POS scanning and fallback queries. Previously, if the IndexedDB connection was interrupted or data was corrupted during a background sync interval, a failed `get` or `all` promise would remain uncaught, silently stalling the entire POS interface.
- **Affected (files, functions, data, UI):** `public/js/views/pos.js` (`scanMirror`, `customerSelect`).
- **Verification evidence:** Code review confirms POS gracefully handles offline IndexedDB failures by yielding `null` or `[]` instead of throwing an Uncaught Promise rejection.
- **Fix status:** Worked (2026-11-07)

## Impact Register (ranked, most depended-on first)
| Rank | Change ID | What depends on it | What breaks if altered, and why |
|------|-----------|--------------------|---------------------------------|

## Research Log
| Date | Topic / query | Source + URL | Source date · version | Takeaway | How applied |
|------|---------------|--------------|-----------------------|----------|-------------|

## Open Issues & Handoff
- Done: Pilot audit completed. Verified POS search fallback boundaries. Added explicit try-catch chains to prevent UI stalls if IndexedDB `product_barcodes` store becomes corrupted during sync intervals.
- Next: 
- Risks: 
