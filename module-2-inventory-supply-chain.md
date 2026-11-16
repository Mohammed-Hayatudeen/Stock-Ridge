# M2 — Inventory & Supply Chain ("Warehouse") · Knowledge file

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
- Done: Pilot audit completed. Implemented offline-catalogue scoping by `business_id` rather than `user_id`. Fixed `U.sellingGroup` ReferenceErrors.
- Next: Negative stock quantity prevention relies heavily on local sync states. Needs tighter remote validation locking during heavy concurrent transaction volumes across multiple branches.
- Risks: 
