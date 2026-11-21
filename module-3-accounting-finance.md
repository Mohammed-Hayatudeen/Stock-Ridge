# M3 — Accounting & Finance ("Back Office") · Knowledge file

## Protected Fixes
| ID | Date | Symptom | Root cause | Fix (files / functions) | Regression check |
|----|------|---------|------------|-------------------------|------------------|

## Change Register
### M3-20261107-01 — Negative Bounds Margin Calculation Refactoring (2026-11-07)
- **What / how / why:** Discovered that the reporting aggregation for `grossMarginPct` strictly limited percentage margin calculations to instances where `netRevenue > 0`. In massive enterprise monthly queries experiencing heavy return volumes or negative adjustments, negative bounds were being completely zeroed out instead of rendering an accurate negative margin. Swapped the hard `> 0` guard to a mathematically precise `!== 0` check in `server/routes/reports.js` and `server/routes/dashboard.js`, preserving mathematical rounding precision while correctly mapping negative PnL states.
- **Affected (files, functions, data, UI):** `server/routes/reports.js`, `server/routes/dashboard.js`.
- **Verification evidence:** Margin reduction divisions no longer bypass periods with negative aggregate revenue (due to mass refunds), correctly returning the bounded margin percentages.
- **Fix status:** Worked (2026-11-07)

## Impact Register (ranked, most depended-on first)
| Rank | Change ID | What depends on it | What breaks if altered, and why |
|------|-----------|--------------------|---------------------------------|

## Research Log
| Date | Topic / query | Source + URL | Source date · version | Takeaway | How applied |
|------|---------------|--------------|-----------------------|----------|-------------|

## Open Issues & Handoff
- Done: Pilot audit completed. Resolved ReferenceErrors missing columns (`todayspan`, `branch_safe_ledger`). Safely isolated Gross Margin percentage math against `zero-division / NaN`. Implemented negative aggregate bounds tracking for margin percentages on enterprise queries.
- Next: 
- Risks: 

- **Cross-Reference:** M6-20261121-01 (Expenses table added to offline sync schema).
