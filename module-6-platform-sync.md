# Module 6: Platform & Sync (The "Infrastructure" Module)

**Scope:** The localized data persistence layer entirely abstracted away from business logic.

- **Data Syncing (sync.js, sync routes):** The heavily optimized SQLite delta synchronization and Turso batch polling.
- **Device Store / State (store.js, store-native.js, state.js):** Electron/Android IPC bridges, offline storage mirroring, and PWA IndexedDB wrappers.

## 🔎 Agent Audit Checkpoint & Module Dependencies
- **Status:** PILOT AUDIT COMPLETED.
- **Dependency Map:** The fundamental structural anchor holding all offline and hybrid modules together.
- **Recent Weakness Addressed:** Missing `idx_clone_table_updated_at` indexing injected into SQLite Native Core (`lib/shop-clone.js`).
- **Known Gaps / Action Items:** 
  1. Native Android IPC `readTimeout` logic requires continuous monitoring across variable cellular architectures to guarantee timeout boundaries do not preempt ongoing valid data synchronization fetches.
