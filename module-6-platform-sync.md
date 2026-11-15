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

### Agent Audit: Infrastructure Read/Write Yield Optimization
- **Status:** PILOT PERFORMANCE REFACTOR COMPLETE.
- **Weakness Addressed:** Analyzed codebase explicitly to protect Turso Free Tier logical read limitations. The delta-sync system was highly inefficient at idle, consuming hundreds of thousands of reads over 24 hours due to executing 30+ table queries every 3 minutes per active device, paired with a 15-minute brute-force full table reload for inventory/stock.
- **Actions Taken:** 
  1. Implemented **Global Revision Optimization** (`server/routes/sync.js`): Sync queries now initially perform a lightweight aggregate (`SELECT MAX(updated_at) FROM sync_revisions`). If no tables changed, it intercepts the query cycle, fully skipping all 30+ delta queries per 3-minute poll.
  2. Bypassed 15-minute 12,000-row brute force fetches (`public/js/sync.js`): Extended `SHELF_FULL_MS` bounds to 24H since delta processing is fully robust, cutting massive database egress bottlenecks.
  3. Optimized `watchSession()` polling overhead (`auth.js/app.js`): Decreased session probe intervals (15s -> 45s) and swapped heavy relational queries (`/me`) for a lightweight JWT cache validator (`/verify`).
