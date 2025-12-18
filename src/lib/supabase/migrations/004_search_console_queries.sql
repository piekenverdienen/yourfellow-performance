-- Migration: Search Console Queries & Analytics
-- Description: Tables for storing Search Console data, branded keywords, topic clusters, and content groups
-- Created: 2024-12-17

-- ============================================
-- 1. Search Console Queries (main table)
-- ============================================
CREATE TABLE IF NOT EXISTS search_console_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  query TEXT NOT NULL,

  -- Aggregated metrics (latest sync)
  unique_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  best_position DECIMAL(5,2),
  average_ctr DECIMAL(5,4),

  -- Page count
  page_count INTEGER DEFAULT 1,

  -- Query classification
  is_question BOOLEAN DEFAULT FALSE,
  is_buyer_keyword BOOLEAN DEFAULT FALSE,
  is_comparison_keyword BOOLEAN DEFAULT FALSE,
  is_branded BOOLEAN DEFAULT FALSE,

  -- Tracking
  is_watching BOOLEAN DEFAULT FALSE,
  has_relevant_page BOOLEAN DEFAULT FALSE,
  mention_count INTEGER DEFAULT 0,

  -- Metadata
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id, query)
);

-- ============================================
-- 2. Query History (for trends over time)
-- ============================================
CREATE TABLE IF NOT EXISTS search_console_query_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES search_console_queries(id) ON DELETE CASCADE,

  -- Date range for this snapshot
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,

  -- Metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  position DECIMAL(5,2),
  ctr DECIMAL(5,4),

  synced_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(query_id, date_start, date_end)
);

-- ============================================
-- 3. Query-Page Mappings
-- ============================================
CREATE TABLE IF NOT EXISTS search_console_query_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES search_console_queries(id) ON DELETE CASCADE,

  page_url TEXT NOT NULL,

  -- Page-specific metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  position DECIMAL(5,2),
  ctr DECIMAL(5,4),

  -- Content analysis
  mention_count INTEGER DEFAULT 0,
  in_title BOOLEAN DEFAULT FALSE,
  in_h1 BOOLEAN DEFAULT FALSE,
  in_h2 BOOLEAN DEFAULT FALSE,

  last_analyzed_at TIMESTAMPTZ,

  UNIQUE(query_id, page_url)
);

-- ============================================
-- 4. Branded Keywords
-- ============================================
CREATE TABLE IF NOT EXISTS branded_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  keyword TEXT NOT NULL,
  match_type TEXT DEFAULT 'contains', -- 'contains', 'exact', 'starts_with'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id, keyword)
);

-- ============================================
-- 5. Topic Clusters
-- ============================================
CREATE TABLE IF NOT EXISTS topic_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',

  -- Matching rules (OR logic)
  match_keywords TEXT[] DEFAULT '{}',
  match_regex TEXT,

  -- Aggregated metrics (calculated)
  query_count INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id, name)
);

-- ============================================
-- 6. Topic Cluster Query Mapping (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS topic_cluster_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES topic_clusters(id) ON DELETE CASCADE,
  query_id UUID NOT NULL REFERENCES search_console_queries(id) ON DELETE CASCADE,

  matched_by TEXT, -- 'keyword', 'regex', 'manual'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(cluster_id, query_id)
);

-- ============================================
-- 7. Content Groups
-- ============================================
CREATE TABLE IF NOT EXISTS content_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#10b981',

  -- Matching rules (OR logic)
  url_patterns TEXT[] DEFAULT '{}',
  url_regex TEXT,

  -- Aggregated metrics
  page_count INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id, name)
);

-- ============================================
-- 8. Content Group Page Mapping
-- ============================================
CREATE TABLE IF NOT EXISTS content_group_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES content_groups(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,

  -- Page metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,

  matched_by TEXT, -- 'pattern', 'regex', 'manual'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(group_id, page_url)
);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_scq_client ON search_console_queries(client_id);
CREATE INDEX IF NOT EXISTS idx_scq_watching ON search_console_queries(client_id, is_watching) WHERE is_watching = TRUE;
CREATE INDEX IF NOT EXISTS idx_scq_branded ON search_console_queries(client_id, is_branded);
CREATE INDEX IF NOT EXISTS idx_scq_impressions ON search_console_queries(client_id, unique_impressions DESC);
CREATE INDEX IF NOT EXISTS idx_scq_position ON search_console_queries(client_id, best_position);

CREATE INDEX IF NOT EXISTS idx_scqh_query ON search_console_query_history(query_id);
CREATE INDEX IF NOT EXISTS idx_scqh_dates ON search_console_query_history(query_id, date_start, date_end);

CREATE INDEX IF NOT EXISTS idx_scqp_query ON search_console_query_pages(query_id);
CREATE INDEX IF NOT EXISTS idx_scqp_page ON search_console_query_pages(page_url);

CREATE INDEX IF NOT EXISTS idx_bk_client ON branded_keywords(client_id);

CREATE INDEX IF NOT EXISTS idx_tc_client ON topic_clusters(client_id);
CREATE INDEX IF NOT EXISTS idx_tcq_cluster ON topic_cluster_queries(cluster_id);
CREATE INDEX IF NOT EXISTS idx_tcq_query ON topic_cluster_queries(query_id);

CREATE INDEX IF NOT EXISTS idx_cg_client ON content_groups(client_id);
CREATE INDEX IF NOT EXISTS idx_cgp_group ON content_group_pages(group_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE search_console_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_console_query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_console_query_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE branded_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_cluster_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_group_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (assuming authenticated users can access their client's data)
-- These may need adjustment based on your auth setup

CREATE POLICY "Users can view their client's queries"
  ON search_console_queries FOR SELECT
  USING (true); -- Adjust based on your auth model

CREATE POLICY "Users can insert queries for their clients"
  ON search_console_queries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their client's queries"
  ON search_console_queries FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their client's queries"
  ON search_console_queries FOR DELETE
  USING (true);

-- Similar policies for other tables
CREATE POLICY "query_history_select" ON search_console_query_history FOR SELECT USING (true);
CREATE POLICY "query_history_insert" ON search_console_query_history FOR INSERT WITH CHECK (true);
CREATE POLICY "query_history_update" ON search_console_query_history FOR UPDATE USING (true);
CREATE POLICY "query_history_delete" ON search_console_query_history FOR DELETE USING (true);

CREATE POLICY "query_pages_select" ON search_console_query_pages FOR SELECT USING (true);
CREATE POLICY "query_pages_insert" ON search_console_query_pages FOR INSERT WITH CHECK (true);
CREATE POLICY "query_pages_update" ON search_console_query_pages FOR UPDATE USING (true);
CREATE POLICY "query_pages_delete" ON search_console_query_pages FOR DELETE USING (true);

CREATE POLICY "branded_keywords_select" ON branded_keywords FOR SELECT USING (true);
CREATE POLICY "branded_keywords_insert" ON branded_keywords FOR INSERT WITH CHECK (true);
CREATE POLICY "branded_keywords_update" ON branded_keywords FOR UPDATE USING (true);
CREATE POLICY "branded_keywords_delete" ON branded_keywords FOR DELETE USING (true);

CREATE POLICY "topic_clusters_select" ON topic_clusters FOR SELECT USING (true);
CREATE POLICY "topic_clusters_insert" ON topic_clusters FOR INSERT WITH CHECK (true);
CREATE POLICY "topic_clusters_update" ON topic_clusters FOR UPDATE USING (true);
CREATE POLICY "topic_clusters_delete" ON topic_clusters FOR DELETE USING (true);

CREATE POLICY "topic_cluster_queries_select" ON topic_cluster_queries FOR SELECT USING (true);
CREATE POLICY "topic_cluster_queries_insert" ON topic_cluster_queries FOR INSERT WITH CHECK (true);
CREATE POLICY "topic_cluster_queries_update" ON topic_cluster_queries FOR UPDATE USING (true);
CREATE POLICY "topic_cluster_queries_delete" ON topic_cluster_queries FOR DELETE USING (true);

CREATE POLICY "content_groups_select" ON content_groups FOR SELECT USING (true);
CREATE POLICY "content_groups_insert" ON content_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "content_groups_update" ON content_groups FOR UPDATE USING (true);
CREATE POLICY "content_groups_delete" ON content_groups FOR DELETE USING (true);

CREATE POLICY "content_group_pages_select" ON content_group_pages FOR SELECT USING (true);
CREATE POLICY "content_group_pages_insert" ON content_group_pages FOR INSERT WITH CHECK (true);
CREATE POLICY "content_group_pages_update" ON content_group_pages FOR UPDATE USING (true);
CREATE POLICY "content_group_pages_delete" ON content_group_pages FOR DELETE USING (true);

-- ============================================
-- Helper Functions
-- ============================================

-- Function to update topic cluster metrics
CREATE OR REPLACE FUNCTION update_topic_cluster_metrics(p_cluster_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE topic_clusters tc
  SET
    query_count = (
      SELECT COUNT(*) FROM topic_cluster_queries tcq WHERE tcq.cluster_id = tc.id
    ),
    total_impressions = (
      SELECT COALESCE(SUM(scq.unique_impressions), 0)
      FROM topic_cluster_queries tcq
      JOIN search_console_queries scq ON scq.id = tcq.query_id
      WHERE tcq.cluster_id = tc.id
    ),
    total_clicks = (
      SELECT COALESCE(SUM(scq.total_clicks), 0)
      FROM topic_cluster_queries tcq
      JOIN search_console_queries scq ON scq.id = tcq.query_id
      WHERE tcq.cluster_id = tc.id
    ),
    updated_at = NOW()
  WHERE tc.id = p_cluster_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update content group metrics
CREATE OR REPLACE FUNCTION update_content_group_metrics(p_group_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE content_groups cg
  SET
    page_count = (
      SELECT COUNT(*) FROM content_group_pages cgp WHERE cgp.group_id = cg.id
    ),
    total_impressions = (
      SELECT COALESCE(SUM(cgp.impressions), 0)
      FROM content_group_pages cgp
      WHERE cgp.group_id = cg.id
    ),
    total_clicks = (
      SELECT COALESCE(SUM(cgp.clicks), 0)
      FROM content_group_pages cgp
      WHERE cgp.group_id = cg.id
    ),
    updated_at = NOW()
  WHERE cg.id = p_group_id;
END;
$$ LANGUAGE plpgsql;
