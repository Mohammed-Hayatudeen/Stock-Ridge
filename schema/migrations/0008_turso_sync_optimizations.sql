-- PROTOCOL: Always reference the agent.md file before any further fix on this page.
-- 0008_turso_sync_optimizations.sql
-- Optimizing Turso Free Tier reads by adding covering indexes for sync delta polling

CREATE INDEX IF NOT EXISTS idx_sync_client_settings_optim ON client_settings(updated_at, id);
CREATE INDEX IF NOT EXISTS idx_sync_sale_returns_optim ON sale_returns(branch_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_sync_sale_return_items_optim ON sale_return_items(updated_at, id);
CREATE INDEX IF NOT EXISTS idx_sync_sale_issues_optim ON sale_issues(branch_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_sync_delivery_vehicles_optim ON delivery_vehicles(branch_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_sync_asset_agreement_lines_optim ON asset_agreement_lines(created_at, id);
CREATE INDEX IF NOT EXISTS idx_sync_warranty_claims_optim ON warranty_claims(branch_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_sync_stock_transfer_items_optim ON stock_transfer_items(updated_at, id);
CREATE INDEX IF NOT EXISTS idx_sync_stocktake_lines_optim ON stocktake_lines(updated_at, id);

-- Speed up MAX(updated_at) global revision check
CREATE INDEX IF NOT EXISTS idx_sync_revisions_updated_at ON sync_revisions(updated_at);
