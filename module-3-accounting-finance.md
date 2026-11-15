# Module 3: Accounting & Finance (The "Back Office" Module)

**Scope:** Deep financial tracking, ledgers, and profit calculations removed from daily operations.

- **General Ledger (accounting.js):** Tracking revenue, cost of goods sold (COGS), chart of accounts, and gross margins.
- **Expenses (expenses.js, finance.js):** Operational costs, salaries, fuel, and branch-specific overhead logging.
- **Reporting (reports.js, dashboard.js):** Analytical engines compiling tax, profit/loss, and end-of-day snapshots across branches.

## 🔎 Agent Audit Checkpoint & Module Dependencies
- **Status:** PILOT AUDIT COMPLETED.
- **Dependency Map:** Consumes payloads downstream from `Front Office (Module 1)` and `Inventory (Module 2)`.
- **Recent Weakness Addressed:** Resolved ReferenceErrors mapping SQL parameters `todayspan` and `branch_safe_ledger` missing columns. Safely isolated and guarded Gross Margin percentage math against `zero-division / NaN`.
- **Known Gaps / Action Items:** 
  1. `grossMarginPct` rounding accuracy logic could compound discrepancies across massive enterprise monthly queries. Needs aggregate bounds auditing.
