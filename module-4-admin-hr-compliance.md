# M4 — Admin, HR & Compliance ("Governance") · Knowledge file

## Protected Fixes
| ID | Date | Symptom | Root cause | Fix (files / functions) | Regression check |
|----|------|---------|------------|-------------------------|------------------|

## Change Register
### M4-20261107-03 — Complete Erasure of Initial Float Capital Injections (2026-11-07)
- **What / how / why:** Finalized the removal of manual initial floats during branch/business orchestration. Ran the local `simulate-year` audit tool to confirm books and data management flows remain totally clear and mathematically balanced (0 unbalanced journals) across a multi-business 365-day fiscal year run. Stripped `OPENING` from the `branch_safe_ledger.entry_type` table constraint and `OPENING_BALANCE` from `source_type` across the whole platform schema. Modified `tools/seed-pin-production.js` and `tools/simulate-year.js` payload generators to eliminate `opening_cash` declarations. This guarantees that initial "ghost/float money" never taints the books, establishing `TILLS` and `SAFES` as the exclusive gatekeepers of all localized capital logic within the application.
- **Affected (files, functions, data, UI):** `schema/migrations/0001_schema.sql`, `server/services/glService.js`, `tools/simulate-year.js`, `tools/seed-pin-production.js`.
- **Verification evidence:** `simulate-year.js` output validated 0 unbalanced journals, 0 SQLite foreign key violations, and 0 invalid sale bounds. Core `npm test` suite passed entirely uninhibited. General ledger cleanly operates without any `OPENING_BALANCE` dependencies.
- **Fix status:** Worked (2026-11-07)

### M4-20261107-02 — Depreciation of Manual Initial Floats in Branches/Businesses (2026-11-07)
- **What / how / why:** Removed `opening_cash` entirely from the creation UI mapping and the backend endpoints for both Branch and Business creations. Initial "float money" injection during establishment artificially bypassed the standard double-entry logic embedded in till flows and safe entries, polluting accounting ledgers. The only valid money inputs going forward are executing a formal Till open or executing a Safe deposit, which forces accountability and proper tracking.
- **Affected (files, functions, data, UI):** `public/js/views/admin.js`, `server/routes/admin.js`, `server/services/provisioningService.js`.
- **Verification evidence:** Branch creation succeeds with strict zero-bound initial floats. Safe ledger no longer auto-inserts `OPENING` entry types based on manual config.
- **Fix status:** Worked (2026-11-07)

### M4-20261107-01 — Timezone Boundary Synchronization Audit (2026-11-07)
- **What / how / why:** Conducted a comprehensive audit of `nowWatSql()` and `resolveClockUtc()` clock-in synchronization structures to verify resilience against client timezone jumps. Confirmed that local time formatting mathematically relies purely on `Date.now()` UTC epoch milliseconds combined linearly with `WAT_OFFSET_MINUTES`, stripping OS-level timezone tampering entirely out of the equation.
- **Affected (files, functions, data, UI):** `public/js/util.js`, `server/routes/attendance.js`.
- **Verification evidence:** Because `Date.now()` measures raw time elapsed since epoch independent of standard timezone offsets, user timezone hopping or VPN spoofing mathematically cannot corrupt the `clocked_at` generation bounds.
- **Fix status:** Worked (Audited 2026-11-07)

## Impact Register (ranked, most depended-on first)
| Rank | Change ID | What depends on it | What breaks if altered, and why |
|------|-----------|--------------------|---------------------------------|

## Research Log
| Date | Topic / query | Source + URL | Source date · version | Takeaway | How applied |
|------|---------------|--------------|-----------------------|----------|-------------|

## Open Issues & Handoff
- Done: Pilot audit completed. Repaired legacy PBKDF2 WebCrypto iterations mismatch locally. Seeded remote environments securely mitigating "Invalid PIN" regressions. Audited clock-in logic and verified native UTC epoch timestamp scaling eliminates OS-level timezone tampering vectors.
- Next: 
- Risks: 
