-- ============================================
-- Shopify Integration Setup
-- ============================================
-- This migration adds tables for Shopify store data.
-- Follows existing RLS patterns from the codebase.
--
-- Tables created:
-- 1. shopify_orders_daily - Daily aggregated order metrics
--
-- Note: Shopify settings are stored in clients.settings.shopify (JSONB)
-- ============================================

-- ============================================
-- Table: shopify_orders_daily
-- ============================================
-- Stores daily aggregated order metrics from Shopify

CREATE TABLE IF NOT EXISTS shopify_orders_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL,

  -- Date
  date DATE NOT NULL,

  -- Order metrics
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  average_order_value DECIMAL(10, 2) DEFAULT 0,

  -- Customer metrics
  total_customers INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  returning_customers INTEGER DEFAULT 0,

  -- Refund metrics
  refund_count INTEGER DEFAULT 0,
  refund_amount DECIMAL(12, 2) DEFAULT 0,

  -- Product insights (top 5 products)
  top_products JSONB DEFAULT '[]'::jsonb,

  -- Currency
  currency TEXT DEFAULT 'EUR',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for upserts
  CONSTRAINT shopify_orders_unique UNIQUE (client_id, store_id, date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_shopify_orders_client_date
  ON shopify_orders_daily(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_store_date
  ON shopify_orders_daily(store_id, date DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE shopify_orders_daily ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can only see data for clients they have access to
CREATE POLICY "shopify_orders_select_policy" ON shopify_orders_daily
  FOR SELECT
  USING (
    has_client_access(client_id, 'viewer')
  );

-- INSERT: Editors and above can insert
CREATE POLICY "shopify_orders_insert_policy" ON shopify_orders_daily
  FOR INSERT
  WITH CHECK (
    has_client_access(client_id, 'editor')
  );

-- UPDATE: Editors and above can update
CREATE POLICY "shopify_orders_update_policy" ON shopify_orders_daily
  FOR UPDATE
  USING (
    has_client_access(client_id, 'editor')
  )
  WITH CHECK (
    has_client_access(client_id, 'editor')
  );

-- DELETE: Admins only
CREATE POLICY "shopify_orders_delete_policy" ON shopify_orders_daily
  FOR DELETE
  USING (
    has_client_access(client_id, 'admin')
  );

-- ============================================
-- Updated_at Trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_shopify_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shopify_orders_updated_at
  BEFORE UPDATE ON shopify_orders_daily
  FOR EACH ROW
  EXECUTE FUNCTION update_shopify_updated_at();

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE shopify_orders_daily IS 'Daily aggregated order metrics from Shopify stores';
COMMENT ON COLUMN shopify_orders_daily.store_id IS 'Shopify store identifier (e.g., "my-store" from my-store.myshopify.com)';
COMMENT ON COLUMN shopify_orders_daily.top_products IS 'Array of top selling products with title, quantity, and revenue';

-- ============================================
-- Update alerts channel enum (add shopify)
-- ============================================
-- Note: The channel column in alerts table uses TEXT, so we just need to
-- handle 'shopify' as a valid channel in the application code.
-- No schema change needed for the alerts table.
