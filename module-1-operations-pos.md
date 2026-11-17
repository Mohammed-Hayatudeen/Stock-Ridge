# M1 — Operations & Point of Sale ("Front Office") · Knowledge file

## Protected Fixes
| ID | Date | Symptom | Root cause | Fix (files / functions) | Regression check |
|----|------|---------|------------|-------------------------|------------------|

## Change Register
### M1-20261107-02 — 3-Day Autonomous Offline Till & Safe Resilience (2026-11-07)
- **What / how / why:** Cashiers attempting to operate 2-3 days strictly offline were hitting blocking UI faults when trying to open/close tills or execute safe drops, because these routes lacked offline queue fallback params and demanded immediate server UUID generation. Bridged Tills (`TILL_OPEN`, `TILL_CLOSE`, `TILL_REVIEW`) and Safes (`SAFE_ENTRY`, `SAFE_RECONCILE`) into the IndexedDB Outbox via `{ queue: 'auto' }`. Generated local UUIDs using `SR.util.localId()` so IndexedDB stores relations correctly. Server modified to accept pre-generated client UUIDs. Mutated `till_sessions` locally upon outbox ejection to seamlessly decouple the frontend UI till-view dependency from live server states.
- **Affected (files, functions, data, UI):** `public/js/views/till.js`, `public/js/api.js` (`classify`), `server/routes/sync.js` (`REPLAYABLE`), `server/routes/till.js` (ID assignment).
- **Verification evidence:** Cashiers can now continuously rotate and close shifts, record safe drops, and execute reconciliations flawlessly on 0 bars of cell service. Local IndexedDB correctly segregates the sessions, and outbox flushes accurately to the cloud upon network restoration.
- **Fix status:** Worked (2026-11-07)

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
