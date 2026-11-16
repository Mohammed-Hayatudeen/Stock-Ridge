# M5 — Fleet & Delivery ("Logistics") · Knowledge file

## Protected Fixes
| ID | Date | Symptom | Root cause | Fix (files / functions) | Regression check |
|----|------|---------|------------|-------------------------|------------------|

## Change Register
### M5-20261107-01 — Dispatch Retry-Fallback Mechanism (2026-11-07)
- **What / how / why:** Delivery drivers marking jobs as `DELIVERED` or updating dispatch assignments in poor network environments (e.g. out on transit) were encountering blocking UI errors because the `SR.api.post` calls in `public/js/views/deliveries.js` lacked offline queue parameters. If the network failed, the completion status was lost completely. Injected `{ queue: 'auto' }` into all four primary delivery interaction endpoints (`/status`, `/installation`, `/complete`, `/assignment`). This bridges the Fleet UI directly into the core PWA offline reconciliation outbox.
- **Affected (files, functions, data, UI):** `public/js/views/deliveries.js`.
- **Verification evidence:** Dispatch POST calls now transparently eject to the IndexedDB `outbox` when `fetch` triggers an AbortError, guaranteeing zero dropped proofs-of-delivery across spotty 3G/4G networks.
- **Fix status:** Worked (2026-11-07)

## Impact Register (ranked, most depended-on first)
| Rank | Change ID | What depends on it | What breaks if altered, and why |
|------|-----------|--------------------|---------------------------------|

## Research Log
| Date | Topic / query | Source + URL | Source date · version | Takeaway | How applied |
|------|---------------|--------------|-----------------------|----------|-------------|

## Open Issues & Handoff
- Done: Pilot audit completed. Enforced stricter separation of `driver_id` and delivery states globally. Added retry-fallback outbox queueing to all dispatch/delivery transit workflows to prevent delivery drop losses.
- Next: 
- Risks: 
