# M3 — Accounting & Finance ("Back Office") · Knowledge file

## Protected Fixes
| ID | Date | Symptom | Root cause | Fix (files / functions) | Regression check |
|----|------|---------|------------|-------------------------|------------------|

## Change Register

## Impact Register (ranked, most depended-on first)
| Rank | Change ID | What depends on it | What breaks if altered, and why |
|------|-----------|--------------------|---------------------------------|

## Research Log
| Date | Topic / query | Source + URL | Source date · version | Takeaway | How applied |
|------|---------------|--------------|-----------------------|----------|-------------|

## Open Issues & Handoff
- Done: Pilot audit completed. Resolved ReferenceErrors missing columns (`todayspan`, `branch_safe_ledger`). Safely isolated Gross Margin percentage math against `zero-division / NaN`.
- Next: `grossMarginPct` rounding accuracy logic could compound discrepancies across massive enterprise monthly queries. Needs aggregate bounds auditing.
- Risks: 
