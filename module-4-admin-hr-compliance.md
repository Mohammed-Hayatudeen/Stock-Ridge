# Module 4: Admin, HR & Compliance (The "Governance" Module)

**Scope:** Internal rules, staff management, identity, and statutory requirements.

- **Identity & Roles (users.js, admin.js, auth.js):** Managing credentials (the PBKDF2 PINs), roles (Owner, Manager, Staff), and branch assignments.
- **Attendance (attendance.js):** Clock-in/clock-out tracking for payroll.
- **Compliance (compliance.js):** Managing regulatory rules (e.g., restricted pharmaceutical registrations, NAFDAC IDs, SONCAP, greenbook requirements).

## 🔎 Agent Audit Checkpoint & Module Dependencies
- **Status:** PILOT AUDIT COMPLETED.
- **Dependency Map:** Provides structural access control parameters governing all modules. Independent logic execution.
- **Recent Weakness Addressed:** Repaired legacy PBKDF2 WebCrypto iterations mismatch locally. Seeded remote environments securely mitigating "Invalid PIN" regressions.
- **Known Gaps / Action Items:** 
  1. Cross-branch clock-in states need stricter time-zone boundary synchronization if user timezone jumps between logins.
