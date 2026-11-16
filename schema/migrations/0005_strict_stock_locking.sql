-- 0005_strict_stock_locking — Strict remote validation locking for inventory
--
-- This migration guarantees absolute remote validation locking on stock quantities.
-- Because Turso/libsql batch execution processes UPDATE statements inside an atomic 
-- transaction without throwing an error if 0 rows are affected, race conditions
-- could occur during heavy concurrent sales volume across multiple branches where
-- stock drops below zero but the transaction succeeds. 
--
-- This trigger enforces that any UPDATE to stock_batches which would result in
-- negative quantity (or negative available quantity after reservations) immediately
-- aborts the transaction at the SQLite engine level with a strict constraint error.

CREATE TRIGGER IF NOT EXISTS prevent_negative_stock
BEFORE UPDATE OF quantity, quantity_reserved ON stock_batches
WHEN NEW.quantity < 0 OR (NEW.quantity - NEW.quantity_reserved) < 0
BEGIN
  SELECT RAISE(ABORT, 'Insufficient stock levels to complete this transaction.');
END;
