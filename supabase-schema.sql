-- Run this in your Supabase project → SQL Editor

-- Deals table
CREATE TABLE IF NOT EXISTS deals (
  id              BIGSERIAL PRIMARY KEY,
  headline        TEXT NOT NULL,
  summary         TEXT,
  buyer           TEXT,
  target          TEXT,
  value           NUMERIC DEFAULT 0,
  currency        TEXT DEFAULT 'EUR',
  type            TEXT DEFAULT 'M&A',
  sector          TEXT DEFAULT 'General',
  status          TEXT DEFAULT 'Signed',
  date            TEXT,
  advisor         TEXT,
  source          TEXT,
  source_channel  TEXT DEFAULT 'news',
  data_source     TEXT DEFAULT 'live',
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent duplicates
ALTER TABLE deals 
  ADD CONSTRAINT deals_headline_unique UNIQUE (headline);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS deals_fetched_at_idx ON deals (fetched_at DESC);
CREATE INDEX IF NOT EXISTS deals_type_idx ON deals (type);
CREATE INDEX IF NOT EXISTS deals_status_idx ON deals (status);

-- Enable Row Level Security
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Allow public reads (for the frontend)
CREATE POLICY "Public can read deals"
  ON deals FOR SELECT
  TO anon
  USING (true);

-- Allow service role to write (for the cron job)
CREATE POLICY "Service role can insert deals"
  ON deals FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update deals"
  ON deals FOR UPDATE
  TO service_role
  USING (true);
